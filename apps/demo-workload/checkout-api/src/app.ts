import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { checkDbHealth } from "./db.js";
import { metricsCollector } from "./metrics.js";
import { processCheckout, CheckoutError } from "./checkout.js";
import {
  CheckoutRequestSchema,
  type WorkloadHealth,
  type WorkloadVersion,
} from "@runsafe/shared";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: false, // Using our structured JSON logger
    disableRequestLogging: true,
  });

  app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  // Track request timing & metrics
  app.addHook("onRequest", async (request, reply) => {
    (request as any).startTime = Date.now();
  });

  app.addHook("onResponse", async (request, reply) => {
    const startTime = (request as any).startTime || Date.now();
    const durationMs = Date.now() - startTime;
    metricsCollector.recordRequest(reply.statusCode, durationMs);

    // Pass custom metadata headers
    reply.header("X-RunSafe-Version", config.appVersion);
    reply.header("X-RunSafe-Replica", config.replicaId);
  });

  // GET /health
  app.get("/health", async (request, reply) => {
    const isDbConnected = await checkDbHealth();
    const uptimeSeconds = Math.max(0, Math.floor(process.uptime()));

    const health: WorkloadHealth = {
      status: isDbConnected ? "healthy" : "unhealthy",
      service: "checkout-api",
      version: config.appVersion,
      replica: config.replicaId,
      environment: config.environment,
      db: isDbConnected ? "connected" : "disconnected",
      uptimeSeconds,
      timestamp: new Date().toISOString(),
    };

    if (!isDbConnected) {
      return reply.status(503).send(health);
    }
    return reply.status(200).send(health);
  });

  // GET /version
  app.get("/version", async (request, reply) => {
    const version: WorkloadVersion = {
      service: "checkout-api",
      version: config.appVersion,
      replica: config.replicaId,
      environment: config.environment,
      faultProfile: config.faultProfile,
      buildId: config.buildId,
    };
    return reply.status(200).send(version);
  });

  // GET /metrics
  app.get("/metrics", async (request, reply) => {
    const snapshot = metricsCollector.getSnapshot();
    return reply.status(200).send(snapshot);
  });

  // POST /checkout
  app.post("/checkout", async (request, reply) => {
    const parseResult = CheckoutRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        version: config.appVersion,
        replica: config.replicaId,
        environment: config.environment,
        error: `Validation error: ${parseResult.error.issues.map((i) => i.message).join(", ")}`,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const response = await processCheckout(parseResult.data);
      return reply.status(200).send(response);
    } catch (err: any) {
      const statusCode = err instanceof CheckoutError ? err.statusCode : 500;
      return reply.status(statusCode).send({
        success: false,
        version: config.appVersion,
        replica: config.replicaId,
        environment: config.environment,
        error: err.message || "An unexpected error occurred during checkout",
        timestamp: new Date().toISOString(),
      });
    }
  });

  return app;
}

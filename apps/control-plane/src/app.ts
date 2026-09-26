import fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { readinessRoutes } from "./routes/readiness.js";
import { devTrueForgeRoutes } from "./routes/dev-trueforge.js";
import { runbookRoutes } from "./routes/runbooks.js";
import { evidenceRoutes } from "./routes/evidence.js";

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: req.url,
            hostname: req.hostname,
            remoteAddress: req.ip,
          };
        },
      },
    },
  });

  // Enable CORS for frontend and development tooling
  app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  // Register routes
  app.register(healthRoutes);
  app.register(readinessRoutes);
  app.register(devTrueForgeRoutes);
  app.register(runbookRoutes);
  app.register(evidenceRoutes);

  // Global structured error handler
  app.setErrorHandler((error: any, request, reply) => {
    app.log.error({ err: error, url: request.url }, "Unhandled request error");
    const statusCode = typeof error?.statusCode === "number" ? error.statusCode : 500;
    const message = typeof error?.message === "string" ? error.message : "Internal Server Error";
    reply.status(statusCode).send({
      error: {
        message,
        statusCode,
      },
    });
  });

  return app;
}

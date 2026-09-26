import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  compileRunbook,
  runbookRepository,
} from "@runsafe/runbooks";

export const runbookRoutes: FastifyPluginAsync = async (app) => {
  // 1. List all runbooks
  app.get("/api/v1/runbooks", async () => {
    const list = runbookRepository.listRunbooks();
    return { data: list };
  });

  // 2. Get runbook by ID with versions
  app.get("/api/v1/runbooks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const runbook = runbookRepository.getRunbook(id);
    if (!runbook) {
      return reply.status(404).send({ error: { message: `Runbook '${id}' not found` } });
    }

    const versions = runbookRepository.getVersionsByRunbook(id);
    return { data: { runbook, versions } };
  });

  // 3. Compile a Markdown runbook into a RecoveryContract
  app.post("/api/v1/runbooks/compile", async (request, reply) => {
    const bodySchema = z.object({
      markdownSource: z.string().min(1),
      runbookId: z.string().min(1),
      version: z.string().default("v1.0.0"),
      targetService: z.string().default("checkout-service"),
      author: z.string().default("SRE"),
      isRehearsalContract: z.boolean().default(false),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { message: "Invalid payload", details: parsed.error.issues } });
    }

    const result = await compileRunbook(parsed.data.markdownSource, {
      runbookId: parsed.data.runbookId,
      version: parsed.data.version,
      targetService: parsed.data.targetService,
      author: parsed.data.author,
      isRehearsalContract: parsed.data.isRehearsalContract,
    });

    if (!result.success) {
      return reply.status(422).send({
        error: {
          message: "Contract compilation failed deterministic validation",
          validationStatus: result.validationStatus,
          errors: result.errors,
        },
      });
    }

    return {
      data: {
        success: true,
        contractId: result.contractId,
        validationStatus: result.validationStatus,
        contract: result.contract,
      },
    };
  });

  // 4. Activate a recovery contract
  app.post("/api/v1/runbooks/contracts/:id/activate", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const activated = runbookRepository.activateContract(id);
      return { data: activated };
    } catch (err: any) {
      return reply.status(400).send({ error: { message: err.message } });
    }
  });

  // 5. Get active contract for a service
  app.get("/api/v1/runbooks/active/:service", async (request, reply) => {
    const { service } = request.params as { service: string };
    const active = runbookRepository.getActiveContract(service);
    if (!active) {
      return reply.status(404).send({ error: { message: `No active contract for service '${service}'` } });
    }
    return { data: active };
  });
};

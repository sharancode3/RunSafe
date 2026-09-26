import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  rehearsalRepository,
  rehearsalRunner,
} from "@runsafe/recovery-engine";

const RunRehearsalRequestSchema = z.object({
  scenarioId: z.string().min(1),
  contractId: z.string().optional(),
});

export const rehearsalRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/rehearsals/scenarios
  fastify.get("/api/v1/rehearsals/scenarios", async (_request, reply) => {
    const scenarios = rehearsalRepository.getScenarios();
    return reply.status(200).send({
      scenarios,
      count: scenarios.length,
    });
  });

  // GET /api/v1/rehearsals/summary
  fastify.get("/api/v1/rehearsals/summary", async (_request, reply) => {
    const scenarios = rehearsalRepository.getScenarios();
    const runs = rehearsalRepository.listRehearsalRuns(50);

    const verifiedScenarioIds = new Set<string>();
    for (const run of runs) {
      if (run.outcome === "PASS") {
        verifiedScenarioIds.add(run.scenarioId);
      }
    }

    const totalScenarios = scenarios.length;
    const verifiedScenarios = verifiedScenarioIds.size;
    const coveragePercentage =
      totalScenarios > 0 ? Math.round((verifiedScenarios / totalScenarios) * 100) : 0;

    return reply.status(200).send({
      totalScenarios,
      verifiedScenarios,
      coveragePercentage,
      coverageFormatted: `${coveragePercentage}% (${verifiedScenarios}/${totalScenarios} verified)`,
      lastRunAt: runs[0]?.executedAt || null,
      totalRunsCount: runs.length,
    });
  });

  // GET /api/v1/rehearsals
  fastify.get("/api/v1/rehearsals", async (request, reply) => {
    const query = request.query as any;
    const limit = query?.limit ? parseInt(query.limit, 10) : 50;
    const runs = rehearsalRepository.listRehearsalRuns(limit);
    return reply.status(200).send({
      runs,
      count: runs.length,
    });
  });

  // GET /api/v1/rehearsals/:id
  fastify.get("/api/v1/rehearsals/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = rehearsalRepository.getRehearsalRun(id);
    if (!run) {
      return reply.status(404).send({
        error: { message: `Rehearsal run '${id}' not found.`, statusCode: 404 },
      });
    }
    return reply.status(200).send(run);
  });

  // POST /api/v1/rehearsals/run
  fastify.post("/api/v1/rehearsals/run", async (request, reply) => {
    const parseResult = RunRehearsalRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          message: `Invalid rehearsal run request: ${parseResult.error.issues.map((i) => i.message).join(", ")}`,
          statusCode: 400,
        },
      });
    }

    const { scenarioId, contractId } = parseResult.data;
    try {
      const result = await rehearsalRunner.runScenario(scenarioId, { contractId });
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(500).send({
        error: {
          message: `Failed to execute rehearsal scenario: ${err.message}`,
          statusCode: 500,
        },
      });
    }
  });
};

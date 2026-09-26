import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  evidenceRepository,
  normalizeToolOutputToEvidence,
  executeSandboxDiagnostic,
  formulateHypothesis,
  evaluateSufficiency,
} from "@runsafe/evidence";
import { TargetEnvironmentSchema } from "@runsafe/shared";

export const evidenceRoutes: FastifyPluginAsync = async (app) => {
  // 1. Query evidence records
  app.get("/api/v1/evidence", async (request) => {
    const query = request.query as {
      incidentId?: string;
      targetResource?: string;
      evidenceType?: string;
    };
    const list = evidenceRepository.listEvidence(query);
    return { data: list, evidence: list, count: list.length };
  });

  // 2. Collect tool output into normalized evidence
  app.post("/api/v1/evidence/collect", async (request, reply) => {
    const bodySchema = z.object({
      toolId: z.string().min(1),
      rawOutput: z.unknown(),
      environment: TargetEnvironmentSchema.default("LOCAL"),
      targetResource: z.string().min(1),
      incidentId: z.string().optional().nullable(),
      sourceExecutionId: z.string().optional().nullable(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { message: "Invalid payload", details: parsed.error.issues } });
    }

    const evidence = normalizeToolOutputToEvidence(
      parsed.data.toolId,
      parsed.data.rawOutput,
      {
        environment: parsed.data.environment,
        targetResource: parsed.data.targetResource,
        incidentId: parsed.data.incidentId,
        sourceExecutionId: parsed.data.sourceExecutionId,
      }
    );

    evidenceRepository.saveEvidence(evidence);
    return { data: evidence };
  });

  // 3. Execute isolated sandbox diagnostic
  app.post("/api/v1/evidence/sandbox/analyze", async (request, reply) => {
    const bodySchema = z.object({
      rawLogs: z.union([z.string(), z.array(z.string()), z.record(z.unknown())]),
      sourceEvidenceIds: z.array(z.string()).default([]),
      targetResource: z.string().default("checkout-service"),
      environment: TargetEnvironmentSchema.default("LOCAL"),
      incidentId: z.string().optional().nullable(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { message: "Invalid payload", details: parsed.error.issues } });
    }

    const result = await executeSandboxDiagnostic({
      rawInput: parsed.data.rawLogs,
      sourceEvidenceIds: parsed.data.sourceEvidenceIds,
      targetResource: parsed.data.targetResource,
      environment: parsed.data.environment,
      incidentId: parsed.data.incidentId,
    });

    if (!result.success) {
      return reply.status(500).send({
        error: { message: "Sandbox diagnostic failed", details: result.error },
      });
    }

    if (result.derivedEvidence) {
      evidenceRepository.saveEvidence(result.derivedEvidence);
    }

    return { data: result };
  });

  // 4. Formulate and save hypothesis
  app.post("/api/v1/evidence/hypotheses", async (request, reply) => {
    const bodySchema = z.object({
      contextId: z.string().min(1),
      evidenceIds: z.array(z.string()).min(1),
      useTrueForgeAgent: z.boolean().default(false),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { message: "Invalid payload", details: parsed.error.issues } });
    }

    const evidenceList = parsed.data.evidenceIds
      .map((id) => evidenceRepository.getEvidence(id))
      .filter((e): e is NonNullable<typeof e> => e !== null);

    if (evidenceList.length === 0) {
      return reply.status(400).send({ error: { message: "None of the specified evidenceIds exist." } });
    }

    try {
      const hyp = await formulateHypothesis({
        contextId: parsed.data.contextId,
        evidenceList,
        useTrueForgeAgent: parsed.data.useTrueForgeAgent,
      });
      return { data: hyp };
    } catch (err: any) {
      return reply.status(422).send({ error: { message: err.message } });
    }
  });

  // 5. List hypotheses
  app.get("/api/v1/evidence/hypotheses", async (request) => {
    const { contextId } = request.query as { contextId?: string };
    const list = evidenceRepository.listHypotheses(contextId);
    return { data: list };
  });

  // 6. Check evidence sufficiency
  app.post("/api/v1/evidence/sufficiency", async (request, reply) => {
    const bodySchema = z.object({
      requiredTypes: z.array(z.string()),
      evidenceIds: z.array(z.string()).default([]),
      maxAgeSeconds: z.number().default(120),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { message: "Invalid payload", details: parsed.error.issues } });
    }

    const evidenceList = parsed.data.evidenceIds
      .map((id) => evidenceRepository.getEvidence(id))
      .filter((e): e is NonNullable<typeof e> => e !== null);

    const result = evaluateSufficiency(
      parsed.data.requiredTypes as any,
      evidenceList,
      { maxAgeSeconds: parsed.data.maxAgeSeconds }
    );

    return { data: result };
  });
};

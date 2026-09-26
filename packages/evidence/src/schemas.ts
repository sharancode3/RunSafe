import { z } from "zod";
import { TargetEnvironmentSchema } from "@runsafe/shared";

export const EvidenceTypeSchema = z.enum([
  "SERVICE_HEALTH",
  "RECENT_LOGS",
  "METRICS",
  "DATABASE_HEALTH",
  "DEPLOYMENT_STATE",
  "REPLICA_STATE",
  "DEPENDENCY_STATE",
  "SYNTHETIC_CHECKOUT",
  "SANDBOX_ANALYSIS",
]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const EvidenceFreshnessSchema = z.enum(["FRESH", "STALE"]);
export type EvidenceFreshness = z.infer<typeof EvidenceFreshnessSchema>;

export const EvidenceSourceTypeSchema = z.enum([
  "OBSERVATION_TOOL",
  "SANDBOX_DIAGNOSTIC",
  "VERIFICATION_PROBE",
]);
export type EvidenceSourceType = z.infer<typeof EvidenceSourceTypeSchema>;

export const EvidenceRecordSchema = z.object({
  id: z.string().min(1),
  incidentId: z.string().optional().nullable(),
  environment: TargetEnvironmentSchema.default("LOCAL"),
  targetResource: z.string().min(1),
  evidenceType: EvidenceTypeSchema,
  sourceType: EvidenceSourceTypeSchema.default("OBSERVATION_TOOL"),
  sourceTool: z.string().min(1),
  sourceExecutionId: z.string().optional().nullable(),
  observedAt: z.string(),
  collectedAt: z.string(),
  summary: z.string(),
  structuredValue: z.record(z.unknown()),
  boundedRawExcerpt: z.string().optional().nullable(),
  freshnessStatus: EvidenceFreshnessSchema.default("FRESH"),
  derived: z.boolean().default(false),
  sourceEvidenceIds: z.array(z.string()).default([]),
  sandboxExecutionId: z.string().optional().nullable(),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

export const EvidenceStrengthSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type EvidenceStrength = z.infer<typeof EvidenceStrengthSchema>;

export const HypothesisSchema = z.object({
  id: z.string().min(1),
  contextId: z.string().min(1),
  statement: z.string().min(1),
  supportingEvidenceIds: z.array(z.string()).default([]),
  contradictingEvidenceIds: z.array(z.string()).default([]),
  missingEvidenceTypes: z.array(EvidenceTypeSchema).default([]),
  evidenceStrength: EvidenceStrengthSchema.default("MEDIUM"),
  modelProvider: z.string().default("openai/gpt-4o"),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type Hypothesis = z.infer<typeof HypothesisSchema>;

export const DiagnosticResultSchema = z.object({
  errorType: z.string(),
  rootCauseSuspect: z.string(),
  affectedComponents: z.array(z.string()).default([]),
  errorCount: z.number().int().nonnegative().default(1),
  firstOccurrence: z.string().optional(),
  lastOccurrence: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.85),
  findings: z.array(z.string()).default([]),
});
export type DiagnosticResult = z.infer<typeof DiagnosticResultSchema>;

export const SufficiencyStatusSchema = z.enum(["SATISFIED", "MISSING", "CONFLICTING"]);
export type SufficiencyStatus = z.infer<typeof SufficiencyStatusSchema>;

export const SufficiencyEvaluationSchema = z.object({
  status: SufficiencyStatusSchema,
  satisfiedTypes: z.array(EvidenceTypeSchema),
  missingTypes: z.array(EvidenceTypeSchema),
  conflicts: z.array(z.string()),
  staleCount: z.number().int().nonnegative(),
});
export type SufficiencyEvaluation = z.infer<typeof SufficiencyEvaluationSchema>;

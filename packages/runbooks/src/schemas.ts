import { z } from "zod";
import { ToolRiskSchema } from "@runsafe/shared";

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

export const StepPreconditionSchema = z.object({
  id: z.string(),
  description: z.string(),
  evidenceType: EvidenceTypeSchema,
  assertion: z.string(), // e.g. "STATUS_DEGRADED", "ERROR_RATE_GT_5", "PROCESS_CRASHED", "DB_HEALTHY"
});
export type StepPrecondition = z.infer<typeof StepPreconditionSchema>;

export const ProbeTypeSchema = z.enum([
  "INGRESS_HEALTH",
  "REPLICA_HEALTH",
  "DB_LATENCY",
  "SYNTHETIC_ORDER",
  "ERROR_RATE_DELTA",
]);
export type ProbeType = z.infer<typeof ProbeTypeSchema>;

export const SuccessCriterionSchema = z.object({
  probeType: ProbeTypeSchema,
  targetResource: z.string(),
  expected: z.union([z.string(), z.number(), z.boolean(), z.record(z.unknown())]),
  description: z.string(),
});
export type SuccessCriterion = z.infer<typeof SuccessCriterionSchema>;

export const EvidenceRequirementSchema = z.object({
  evidenceType: EvidenceTypeSchema,
  minFreshnessSeconds: z.number().int().positive().default(120),
  mandatory: z.boolean().default(true),
});
export type EvidenceRequirement = z.infer<typeof EvidenceRequirementSchema>;

export const RecoveryContractStepSchema = z.object({
  id: z.string().min(1, "Step ID is required"),
  title: z.string(),
  description: z.string(),
  toolName: z.string().min(1, "toolName is required"),
  defaultArguments: z.record(z.unknown()).default({}),
  targetResource: z.string().min(1, "targetResource is required"),
  riskLevel: ToolRiskSchema,
  isReversible: z.boolean().default(false),
  rollbackStepId: z.string().optional(),
  requiresApproval: z.boolean().default(false),
  preconditions: z.array(StepPreconditionSchema).default([]),
  successCriteria: z.array(SuccessCriterionSchema).default([]),
  evidenceRequirements: z.array(EvidenceRequirementSchema).default([]),
  onSuccess: z.string().min(1, "onSuccess branch target is required"),
  onFailure: z.string().min(1, "onFailure branch target is required"),
});
export type RecoveryContractStep = z.infer<typeof RecoveryContractStepSchema>;

export const RecoveryContractSchema = z.object({
  id: z.string().min(1),
  runbookId: z.string().min(1),
  runbookVersionId: z.string().min(1),
  targetService: z.string().min(1),
  schemaVersion: z.literal("1.0.0").default("1.0.0"),
  contractVersion: z.string().default("v1.0.0"),
  title: z.string(),
  description: z.string(),
  entryStepId: z.string().min(1),
  steps: z.array(RecoveryContractStepSchema).min(1, "Contract must have at least one step"),
  terminalStates: z.array(z.string()).default(["RESOLVED", "ESCALATED", "ABSTAINED"]),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type RecoveryContract = z.infer<typeof RecoveryContractSchema>;

export const RunbookRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  target_service: z.string(),
  active_version_id: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  created_at: z.string(),
  updated_at: z.string(),
});
export type RunbookRecord = z.infer<typeof RunbookRecordSchema>;

export const RunbookVersionRecordSchema = z.object({
  id: z.string(),
  runbook_id: z.string(),
  version: z.string(),
  markdown_source: z.string(),
  author: z.string().default("SRE"),
  compilation_status: z.enum(["PENDING", "COMPILED", "FAILED_VALIDATION"]).default("PENDING"),
  contract_id: z.string().nullable().optional(),
  created_at: z.string(),
});
export type RunbookVersionRecord = z.infer<typeof RunbookVersionRecordSchema>;

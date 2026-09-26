import { z } from "zod";

export const SafetyDecisionTypeSchema = z.enum([
  "AUTO_ALLOW",
  "APPROVAL_REQUIRED",
  "BLOCKED",
  "UNKNOWN_ESCALATE",
]);
export type SafetyDecisionType = z.infer<typeof SafetyDecisionTypeSchema>;

export const ReasonCodeSchema = z.enum([
  // Allow
  "AUTONOMOUS_LOW_RISK_APPROVED",
  "READ_ONLY_OBSERVATION_ALLOWED",
  // Approval required
  "HUMAN_APPROVAL_MANDATORY_HIGH_RISK",
  "CONTRACT_STEP_REQUIRES_APPROVAL",
  // Blocked / Errors
  "CONTRACT_NOT_FOUND",
  "CONTRACT_INACTIVE",
  "CONTRACT_STEP_NOT_FOUND",
  "TOOL_STEP_MISMATCH",
  "RESOURCE_MISMATCH",
  "UNKNOWN_TOOL",
  "REHEARSAL_TOOL_IN_RECOVERY",
  "MISSING_SUPPORTING_EVIDENCE",
  "STALE_EVIDENCE",
  "PRECONDITION_FAILED",
  "EVIDENCE_CONFLICT",
  "FINGERPRINT_TAMPERED",
  "INVALID_ACTION_STATE",
  "CONFIDENCE_BELOW_THRESHOLD",
]);
export type ReasonCode = z.infer<typeof ReasonCodeSchema>;

export const ChecksSummarySchema = z.object({
  toolCheck: z.boolean(),
  fingerprintCheck: z.boolean(),
  contractCheck: z.boolean(),
  evidenceCheck: z.boolean(),
  preconditionCheck: z.boolean(),
  details: z.record(z.unknown()).default({}),
});
export type ChecksSummary = z.infer<typeof ChecksSummarySchema>;

export const SafetyPolicyDecisionSchema = z.object({
  id: z.string().min(1),
  actionId: z.string().min(1),
  policyDecision: SafetyDecisionTypeSchema,
  reasonCode: ReasonCodeSchema,
  reasonMessage: z.string(),
  matchedRule: z.string(),
  preconditionsPassed: z.boolean().default(true),
  checksSummary: ChecksSummarySchema,
  evaluatedAt: z.string().default(() => new Date().toISOString()),
});
export type SafetyPolicyDecision = z.infer<typeof SafetyPolicyDecisionSchema>;

export const ApprovalRequestSchema = z.object({
  id: z.string().min(1),
  actionId: z.string().min(1),
  payloadHash: z.string().min(1),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED"]).default("PENDING"),
  decidedBy: z.string().nullable().optional(),
  operatorNote: z.string().nullable().optional(),
  decidedAt: z.string().nullable().optional(),
  expiresAt: z.string(),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export const ToolExecutionRecordSchema = z.object({
  id: z.string().min(1),
  actionId: z.string().min(1),
  incidentId: z.string().min(1),
  toolName: z.string().min(1),
  argumentsSnapshot: z.record(z.unknown()),
  executionToken: z.string().min(1),
  status: z.enum(["PENDING", "SUCCESS", "FAILURE"]).default("PENDING"),
  exitCode: z.number().nullable().optional(),
  durationMs: z.number().nullable().optional(),
  rawOutputExcerpt: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  executedAt: z.string().default(() => new Date().toISOString()),
});
export type ToolExecutionRecord = z.infer<typeof ToolExecutionRecordSchema>;

import { z } from "zod";
import { ProbeTypeSchema } from "@runsafe/runbooks";

export const VerificationStatusSchema = z.enum(["PASS", "FAIL", "UNKNOWN"]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const ProbeEvaluationSchema = z.object({
  probeType: ProbeTypeSchema,
  targetResource: z.string(),
  expected: z.unknown(),
  actual: z.unknown(),
  status: VerificationStatusSchema,
  latencyMs: z.number().optional(),
  message: z.string().optional(),
});
export type ProbeEvaluation = z.infer<typeof ProbeEvaluationSchema>;

export const VerificationRunSchema = z.object({
  id: z.string(),
  incidentId: z.string(),
  actionId: z.string().nullable().optional(),
  contractStepId: z.string(),
  overallStatus: VerificationStatusSchema,
  details: z.array(ProbeEvaluationSchema),
  durationMs: z.number().int().nonnegative().default(0),
  verifiedAt: z.string(),
});
export type VerificationRun = z.infer<typeof VerificationRunSchema>;

export interface VerificationResult extends VerificationRun {
  evidenceRecords: any[];
  negativeEvidenceDetected: boolean;
}

import { z } from "zod";

export const RunSafeEventTypeSchema = z.enum([
  "AGENT_RUN_STARTED",
  "MODEL_ACTIVITY",
  "TOOL_CALL_STARTED",
  "TOOL_CALL_COMPLETED",
  "SANDBOX_STARTED",
  "SANDBOX_COMPLETED",
  "APPROVAL_WAITING",
  "APPROVAL_RESOLVED",
  "AGENT_RUN_COMPLETED",
  "AGENT_RUN_FAILED",
]);
export type RunSafeEventType = z.infer<typeof RunSafeEventTypeSchema>;

export const RunSafeEventEnvelopeSchema = z.object({
  id: z.string(),
  type: RunSafeEventTypeSchema,
  sessionId: z.string(),
  turnId: z.string().optional(),
  timestamp: z.string().datetime(),
  payload: z.record(z.unknown()),
});
export type RunSafeEventEnvelope = z.infer<typeof RunSafeEventEnvelopeSchema>;

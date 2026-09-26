import { z } from "zod";
import { TargetEnvironmentSchema } from "@runsafe/shared";

export const IncidentStatusSchema = z.enum([
  "DETECTED",
  "TRIAGING",
  "INVESTIGATING",
  "REMEDIATING",
  "VERIFYING",
  "VERIFIED_RECOVERY",
  "ESCALATED",
  "ABSTAINED",
]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const IncidentRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  target_service: z.string().min(1),
  environment: TargetEnvironmentSchema.default("LOCAL"),
  status: IncidentStatusSchema.default("DETECTED"),
  active_contract_id: z.string().nullable().optional(),
  current_step_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  resolved_at: z.string().nullable().optional(),
});
export type IncidentRecord = z.infer<typeof IncidentRecordSchema>;

export const IncidentEventTypeSchema = z.enum([
  "INCIDENT_DETECTED",
  "STATE_TRANSITION",
  "STEP_STARTED",
  "EVIDENCE_COLLECTED",
  "ACTION_PROPOSED",
  "SAFETY_EVALUATED",
  "APPROVAL_REQUESTED",
  "APPROVAL_GRANTED",
  "APPROVAL_REJECTED",
  "ACTION_EXECUTED",
  "ACTION_FAILED",
  "VERIFICATION_RUN",
  "BRANCH_PROGRESSION",
  "INCIDENT_RESOLVED",
  "INCIDENT_ESCALATED",
  "INCIDENT_ABSTAINED",
  "AGENT_INVESTIGATION_COMPLETED",
  "AGENT_INVESTIGATION_SKIPPED",
]);
export type IncidentEventType = z.infer<typeof IncidentEventTypeSchema>;

export const IncidentEventSchema = z.object({
  id: z.string().min(1),
  incident_id: z.string().min(1),
  event_type: IncidentEventTypeSchema,
  payload: z.record(z.unknown()),
  created_at: z.string(),
});
export type IncidentEvent = z.infer<typeof IncidentEventSchema>;

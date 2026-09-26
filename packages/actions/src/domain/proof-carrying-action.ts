import { z } from "zod";
import { ToolRiskSchema } from "@runsafe/shared";

export const ActionStatusSchema = z.enum([
  "PROPOSED",
  "EVALUATED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "EXECUTING",
  "EXECUTED",
  "FAILED",
]);
export type ActionStatus = z.infer<typeof ActionStatusSchema>;

export const BlastRadiusSchema = z.enum([
  "CONTAINER",
  "SERVICE",
  "ENVIRONMENT",
  "FLEET",
]);
export type BlastRadius = z.infer<typeof BlastRadiusSchema>;

export const ProofCarryingActionSchema = z.object({
  id: z.string().min(1, "Action ID is required"),
  incidentId: z.string().min(1, "Incident ID is required"),
  contractId: z.string().min(1, "Contract ID is required"),
  stepId: z.string().min(1, "Step ID is required"),
  toolName: z.string().min(1, "Tool name is required"),
  toolArguments: z.record(z.unknown()).default({}),
  payloadHash: z.string().min(1, "Payload hash is required"),
  justificationSummary: z.string().min(1, "Justification is required"),
  confidenceScore: z.number().min(0).max(1),
  supportingEvidenceIds: z.array(z.string()).default([]),
  riskTier: ToolRiskSchema,
  blastRadius: BlastRadiusSchema,
  isReversible: z.boolean().default(false),
  rollbackProcedure: z.string().nullable().optional(),
  verificationCriteria: z.union([z.array(z.unknown()), z.record(z.unknown())]),
  status: ActionStatusSchema.default("PROPOSED"),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});
export type ProofCarryingAction = z.infer<typeof ProofCarryingActionSchema>;

export const ActionProposalInputSchema = z.object({
  incidentId: z.string().min(1, "incidentId is required"),
  contractId: z.string().min(1, "contractId is required"),
  stepId: z.string().min(1, "stepId is required"),
  toolName: z.string().min(1, "toolName is required"),
  toolArguments: z.record(z.unknown()).default({}),
  justificationSummary: z.string().min(1, "justificationSummary is required"),
  confidenceScore: z.number().min(0).max(1).default(0.9),
  supportingEvidenceIds: z.array(z.string()).min(1, "At least one supporting evidence ID is required"),
  operatorNote: z.string().optional(),
});
export type ActionProposalInput = z.infer<typeof ActionProposalInputSchema>;

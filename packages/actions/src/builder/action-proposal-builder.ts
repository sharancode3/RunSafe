import { randomUUID } from "node:crypto";
import {
  type ActionProposalInput,
  ActionProposalInputSchema,
  type ProofCarryingAction,
  ProofCarryingActionSchema,
} from "../domain/proof-carrying-action.js";
import { computeActionFingerprint } from "../domain/action-fingerprint.js";
import { enrichAction } from "./action-enricher.js";
import type { RecoveryContractStep } from "@runsafe/runbooks";

export function buildProofCarryingAction(
  input: ActionProposalInput,
  step?: RecoveryContractStep
): ProofCarryingAction {
  // Validate input
  const validatedInput = ActionProposalInputSchema.parse(input);

  // Authoritative enrichment
  const enrichment = enrichAction(
    validatedInput.toolName,
    validatedInput.toolArguments,
    step
  );

  // Compute deterministic SHA-256 fingerprint
  const payloadHash = computeActionFingerprint({
    incidentId: validatedInput.incidentId,
    contractId: validatedInput.contractId,
    stepId: validatedInput.stepId,
    toolName: validatedInput.toolName,
    toolArguments: validatedInput.toolArguments,
    riskTier: enrichment.riskTier,
    blastRadius: enrichment.blastRadius,
  });

  const now = new Date().toISOString();

  const pcaPayload: ProofCarryingAction = {
    id: `pca_${randomUUID()}`,
    incidentId: validatedInput.incidentId,
    contractId: validatedInput.contractId,
    stepId: validatedInput.stepId,
    toolName: validatedInput.toolName,
    toolArguments: validatedInput.toolArguments,
    payloadHash,
    justificationSummary: validatedInput.justificationSummary,
    confidenceScore: validatedInput.confidenceScore,
    supportingEvidenceIds: validatedInput.supportingEvidenceIds,
    riskTier: enrichment.riskTier,
    blastRadius: enrichment.blastRadius,
    isReversible: enrichment.isReversible,
    rollbackProcedure: enrichment.rollbackProcedure,
    verificationCriteria: enrichment.verificationCriteria,
    status: "PROPOSED",
    createdAt: now,
    updatedAt: now,
  };

  return ProofCarryingActionSchema.parse(pcaPayload);
}

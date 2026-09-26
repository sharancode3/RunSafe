import { evidenceRepository, evaluateFreshness, type EvidenceRecord } from "@runsafe/evidence";
import type { RecoveryContractStep } from "@runsafe/runbooks";
import type { ProofCarryingAction } from "@runsafe/actions";
import type { ReasonCode } from "../kernel/safety-decision.js";

export interface EvidencePolicyResult {
  passed: boolean;
  evidenceRecords: EvidenceRecord[];
  reasonCode?: ReasonCode;
  message?: string;
}

export function evaluateEvidencePolicy(
  action: ProofCarryingAction,
  step?: RecoveryContractStep
): EvidencePolicyResult {
  if (!action.supportingEvidenceIds || action.supportingEvidenceIds.length === 0) {
    return {
      passed: false,
      evidenceRecords: [],
      reasonCode: "MISSING_SUPPORTING_EVIDENCE",
      message: "Action contains no supporting evidence IDs to justify execution.",
    };
  }

  const records: EvidenceRecord[] = [];

  for (const evId of action.supportingEvidenceIds) {
    const record = evidenceRepository.getEvidence(evId);
    if (!record) {
      return {
        passed: false,
        evidenceRecords: [],
        reasonCode: "MISSING_SUPPORTING_EVIDENCE",
        message: `Supporting evidence ID '${evId}' not found in evidence store.`,
      };
    }

    // Default 120s TTL if not specified by contract step
    const freshness = evaluateFreshness(record, 120);
    if (freshness === "STALE") {
      return {
        passed: false,
        evidenceRecords: [],
        reasonCode: "STALE_EVIDENCE",
        message: `Supporting evidence '${evId}' (${record.evidenceType}) is stale (> 120s old). Fresh telemetry required.`,
      };
    }

    records.push(record);
  }

  // Check mandatory contract step requirements if step is provided
  if (step?.evidenceRequirements && step.evidenceRequirements.length > 0) {
    const presentTypes = new Set(records.map((r) => r.evidenceType));

    for (const req of step.evidenceRequirements) {
      if (req.mandatory && !presentTypes.has(req.evidenceType)) {
        return {
          passed: false,
          evidenceRecords: records,
          reasonCode: "MISSING_SUPPORTING_EVIDENCE",
          message: `Mandatory contract evidence requirement '${req.evidenceType}' is missing from supporting evidence.`,
        };
      }
    }
  }

  return {
    passed: true,
    evidenceRecords: records,
  };
}

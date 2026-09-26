import type { EvidenceRecord, EvidenceType, SufficiencyEvaluation } from "../schemas.js";
import { evaluateFreshness } from "./freshness-evaluator.js";
import { detectEvidenceConflicts } from "./conflict-detector.js";

export function evaluateSufficiency(
  requiredTypes: EvidenceType[],
  evidenceList: EvidenceRecord[],
  options: { maxAgeSeconds?: number; checkConflicts?: boolean; referenceNowMs?: number } = {}
): SufficiencyEvaluation {
  const maxAgeSeconds = options.maxAgeSeconds ?? 120;
  const checkConflicts = options.checkConflicts ?? true;
  const referenceNowMs = options.referenceNowMs ?? Date.now();

  const satisfiedTypes: EvidenceType[] = [];
  const missingTypes: EvidenceType[] = [];
  let staleCount = 0;

  for (const reqType of requiredTypes) {
    const matching = evidenceList.filter((e) => e.evidenceType === reqType);
    if (matching.length === 0) {
      missingTypes.push(reqType);
      continue;
    }

    const freshMatch = matching.find(
      (e) => evaluateFreshness(e, maxAgeSeconds, referenceNowMs) === "FRESH"
    );

    if (freshMatch) {
      satisfiedTypes.push(reqType);
    } else {
      staleCount += matching.length;
      missingTypes.push(reqType);
    }
  }

  const conflictReport = checkConflicts
    ? detectEvidenceConflicts(evidenceList)
    : { hasConflict: false, conflicts: [] };

  let status: "SATISFIED" | "MISSING" | "CONFLICTING" = "SATISFIED";
  if (missingTypes.length > 0) {
    status = "MISSING";
  } else if (conflictReport.hasConflict) {
    status = "CONFLICTING";
  }

  return {
    status,
    satisfiedTypes,
    missingTypes,
    conflicts: conflictReport.conflicts,
    staleCount,
  };
}

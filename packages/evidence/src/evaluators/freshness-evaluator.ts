import type { EvidenceRecord, EvidenceFreshness } from "../schemas.js";

/**
 * Deterministically evaluates freshness of an evidence record against a TTL window.
 * Default maxAgeSeconds is 120 seconds.
 */
export function evaluateFreshness(
  evidence: EvidenceRecord,
  maxAgeSeconds = 120,
  referenceNowMs: number = Date.now()
): EvidenceFreshness {
  const observedTime = new Date(evidence.observedAt).getTime();
  if (isNaN(observedTime)) {
    return "STALE";
  }

  const ageSeconds = (referenceNowMs - observedTime) / 1000;
  return ageSeconds <= maxAgeSeconds ? "FRESH" : "STALE";
}

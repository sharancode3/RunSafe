import { createHash } from "node:crypto";
import type { ProofCarryingAction } from "./proof-carrying-action.js";

/**
 * Deterministically sorts object keys deeply to guarantee reproducible JSON serialization
 */
export function canonicalizeJson(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalizeJson);
  }
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    result[key] = canonicalizeJson((obj as Record<string, unknown>)[key]);
  }
  return result;
}

export interface FingerprintPayload {
  incidentId: string;
  contractId: string;
  stepId: string;
  toolName: string;
  toolArguments: Record<string, unknown>;
  riskTier: string;
  blastRadius: string;
}

/**
 * Computes a deterministic SHA-256 fingerprint of the core operational payload.
 * Changing any argument, tool, step, target, or risk tier alters this fingerprint.
 */
export function computeActionFingerprint(payload: FingerprintPayload): string {
  const canonicalPayload = {
    incidentId: payload.incidentId,
    contractId: payload.contractId,
    stepId: payload.stepId,
    toolName: payload.toolName,
    toolArguments: canonicalizeJson(payload.toolArguments),
    riskTier: payload.riskTier,
    blastRadius: payload.blastRadius,
  };

  const rawJson = JSON.stringify(canonicalPayload);
  return createHash("sha256").update(rawJson, "utf8").digest("hex");
}

/**
 * Verifies whether a given ProofCarryingAction's payloadHash matches an expected hash
 */
export function verifyActionFingerprint(action: ProofCarryingAction, expectedHash: string): boolean {
  if (!expectedHash || !action.payloadHash) {
    return false;
  }
  const recalculated = computeActionFingerprint({
    incidentId: action.incidentId,
    contractId: action.contractId,
    stepId: action.stepId,
    toolName: action.toolName,
    toolArguments: action.toolArguments,
    riskTier: action.riskTier,
    blastRadius: action.blastRadius,
  });

  return recalculated === expectedHash && action.payloadHash === expectedHash;
}

import type { BlastRadius, ProofCarryingAction } from "@runsafe/actions";
import type { ReasonCode } from "../kernel/safety-decision.js";

export interface BlastRadiusPolicyResult {
  passed: boolean;
  blastRadius: BlastRadius;
  reasonCode?: ReasonCode;
  message?: string;
}

export function evaluateBlastRadiusPolicy(action: ProofCarryingAction): BlastRadiusPolicyResult {
  // If blast radius is FLEET or broader without explicit human approval flag, block or escalate
  if (action.blastRadius === "FLEET") {
    return {
      passed: false,
      blastRadius: "FLEET",
      reasonCode: "INVALID_ACTION_STATE",
      message: "Fleet-wide blast radius is not permitted for automated single-step execution.",
    };
  }

  return {
    passed: true,
    blastRadius: action.blastRadius,
  };
}

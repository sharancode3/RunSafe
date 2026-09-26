import { TOOL_REGISTRY, type ToolRisk } from "@runsafe/shared";
import type { RecoveryContract } from "../schemas.js";

const RISK_RANKS: Record<ToolRisk, number> = {
  READ_ONLY: 1,
  LOW_RISK_REVERSIBLE: 2,
  STATE_CHANGING: 3,
  HIGH_RISK: 4,
  DESTRUCTIVE: 5,
};

export function validateRiskMetadata(contract: RecoveryContract): string[] {
  const errors: string[] = [];

  for (const step of contract.steps) {
    const tool = TOOL_REGISTRY[step.toolName];
    if (!tool) continue; // Handled by tool-reference-validator

    const declaredRank = RISK_RANKS[step.riskLevel] ?? 0;
    const requiredRank = RISK_RANKS[tool.risk] ?? 0;

    if (declaredRank < requiredRank) {
      errors.push(
        `Risk downgrade prohibited: step '${step.id}' declared risk tier '${step.riskLevel}' for tool '${step.toolName}', but the registry requires minimum risk tier '${tool.risk}'. AI models cannot downgrade operational risk.`
      );
    }
  }

  return errors;
}

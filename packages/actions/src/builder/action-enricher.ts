import { TOOL_REGISTRY, type ToolRisk } from "@runsafe/shared";
import type { RecoveryContractStep } from "@runsafe/runbooks";
import type { BlastRadius } from "../domain/proof-carrying-action.js";

export interface ActionEnrichmentResult {
  riskTier: ToolRisk;
  blastRadius: BlastRadius;
  isReversible: boolean;
  rollbackProcedure: string | null;
  verificationCriteria: Array<unknown> | Record<string, unknown>;
}

export function enrichAction(
  toolName: string,
  toolArguments: Record<string, unknown>,
  step?: RecoveryContractStep
): ActionEnrichmentResult {
  const toolDef = TOOL_REGISTRY[toolName];

  // If tool is not in registry, fail-closed to highest risk
  const riskTier: ToolRisk = toolDef?.risk ?? "DESTRUCTIVE";
  const isReversible: boolean = toolDef?.reversible ?? false;

  // Determine Blast Radius
  let blastRadius: BlastRadius = "SERVICE";
  const target = (toolArguments.target as string) || (toolArguments.replicaId as string) || (toolArguments.targetReplica as string);
  const service = (toolArguments.serviceId as string);

  if (target && (target.includes("replica") || target.includes("api-1") || target.includes("api-2"))) {
    blastRadius = "CONTAINER";
  } else if (service) {
    blastRadius = "SERVICE";
  } else if (toolName === "reset_environment") {
    blastRadius = "ENVIRONMENT";
  }

  // Bind rollback procedure from contract step if available
  let rollbackProcedure: string | null = null;
  if (step?.rollbackStepId) {
    rollbackProcedure = `Execute compensating contract step: ${step.rollbackStepId}`;
  } else if (isReversible) {
    rollbackProcedure = `Reversible operational tool action for ${toolName}`;
  }

  // Bind verification criteria
  const verificationCriteria = step?.successCriteria && step.successCriteria.length > 0
    ? step.successCriteria
    : [{ probeType: "REPLICA_HEALTH", description: "Default health probe verification" }];

  return {
    riskTier,
    blastRadius,
    isReversible,
    rollbackProcedure,
    verificationCriteria,
  };
}

import { TOOL_REGISTRY } from "@runsafe/shared";
import type { RecoveryContract } from "../schemas.js";

export function validateRehearsalIsolation(
  contract: RecoveryContract,
  isRehearsalContract = false
): string[] {
  const errors: string[] = [];

  if (isRehearsalContract) {
    return errors;
  }

  for (const step of contract.steps) {
    const tool = TOOL_REGISTRY[step.toolName];
    if (tool && tool.rehearsalOnly) {
      errors.push(
        `Rehearsal isolation violation: step '${step.id}' references rehearsal-only tool '${step.toolName}'. Rehearsal and fault injection tools must not be present in production recovery contracts.`
      );
    }
  }

  return errors;
}

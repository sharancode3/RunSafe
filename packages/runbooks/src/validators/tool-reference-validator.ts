import { TOOL_REGISTRY } from "@runsafe/shared";
import type { RecoveryContract } from "../schemas.js";

export function validateToolReferences(contract: RecoveryContract): string[] {
  const errors: string[] = [];

  for (const step of contract.steps) {
    const tool = TOOL_REGISTRY[step.toolName];
    if (!tool) {
      errors.push(
        `Tool reference violation in step '${step.id}': tool '${step.toolName}' is not registered in the immutable TOOL_REGISTRY.`
      );
    }
  }

  return errors;
}

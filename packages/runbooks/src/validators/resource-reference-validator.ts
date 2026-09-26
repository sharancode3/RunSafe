import { RESOURCE_REGISTRY } from "@runsafe/shared";
import type { RecoveryContract } from "../schemas.js";

export function validateResourceReferences(contract: RecoveryContract): string[] {
  const errors: string[] = [];

  for (const step of contract.steps) {
    const resource = RESOURCE_REGISTRY[step.targetResource];
    if (!resource) {
      errors.push(
        `Resource reference violation in step '${step.id}': targetResource '${step.targetResource}' is not registered in RESOURCE_REGISTRY.`
      );
    }
  }

  return errors;
}

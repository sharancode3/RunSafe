import {
  RecoveryContractSchema,
  type RecoveryContract,
} from "../schemas.js";
import { validateToolReferences } from "./tool-reference-validator.js";
import { validateResourceReferences } from "./resource-reference-validator.js";
import { validateRiskMetadata } from "./risk-consistency-validator.js";
import { validateRehearsalIsolation } from "./rehearsal-isolation-validator.js";
import { validateBranchGraph } from "./branch-validator.js";

export interface ContractValidationResult {
  valid: boolean;
  errors: string[];
  contract?: RecoveryContract;
}

export function validateRecoveryContract(
  rawInput: unknown,
  options: { isRehearsalContract?: boolean } = {}
): ContractValidationResult {
  const parseResult = RecoveryContractSchema.safeParse(rawInput);
  if (!parseResult.success) {
    const zodErrors = parseResult.error.issues.map(
      (issue) => `Schema error at '${issue.path.join(".")}': ${issue.message}`
    );
    return {
      valid: false,
      errors: zodErrors,
    };
  }

  const contract = parseResult.data;
  const errors: string[] = [
    ...validateToolReferences(contract),
    ...validateResourceReferences(contract),
    ...validateRiskMetadata(contract),
    ...validateRehearsalIsolation(contract, options.isRehearsalContract),
    ...validateBranchGraph(contract),
  ];

  return {
    valid: errors.length === 0,
    errors,
    contract,
  };
}

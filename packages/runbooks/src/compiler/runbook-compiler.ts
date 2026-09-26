import { parseRunbookMarkdown } from "./markdown-parser.js";
import { validateRecoveryContract, type ContractValidationResult } from "../validators/contract-validator.js";
import { runbookRepository } from "../repository/runbook-repository.js";
import type { RecoveryContract } from "../schemas.js";

export interface CompileRunbookOptions {
  runbookId: string;
  version: string;
  targetService: string;
  author?: string;
  contractVersion?: string;
  isRehearsalContract?: boolean;
}

export interface CompileRunbookResult {
  success: boolean;
  contract?: RecoveryContract;
  versionId: string;
  contractId?: string;
  validationStatus: "STRUCTURALLY_VALID" | "FAILED_VALIDATION";
  errors: string[];
}

export async function compileRunbook(
  markdownSource: string,
  options: CompileRunbookOptions
): Promise<CompileRunbookResult> {
  const versionId = `ver_${options.runbookId}_${options.version.replace(/[^a-zA-Z0-9]/g, "_")}`;

  // 1. Ensure parent runbook exists
  if (!runbookRepository.getRunbook(options.runbookId)) {
    runbookRepository.createRunbook({
      id: options.runbookId,
      name: options.runbookId,
      description: `Runbook for ${options.targetService}`,
      targetService: options.targetService,
    });
  }

  // 2. Persist the human version in SQLite
  runbookRepository.createVersion({
    id: versionId,
    runbookId: options.runbookId,
    version: options.version,
    markdownSource,
    author: options.author || "SRE",
    compilationStatus: "PENDING",
  });

  // 2. Parse markdown into candidate contract structure
  const rawContract = parseRunbookMarkdown(markdownSource, {
    runbookId: options.runbookId,
    runbookVersionId: versionId,
    targetService: options.targetService,
    contractVersion: options.contractVersion || options.version,
  });

  // 3. Deterministic Validation Gate
  const validation: ContractValidationResult = validateRecoveryContract(rawContract, {
    isRehearsalContract: options.isRehearsalContract,
  });

  if (!validation.valid || !validation.contract) {
    // If invalid, record in database as FAILED_VALIDATION
    if (validation.contract) {
      runbookRepository.saveContract(validation.contract, {
        validationStatus: "FAILED_VALIDATION",
      });
    }

    return {
      success: false,
      versionId,
      contractId: validation.contract?.id,
      validationStatus: "FAILED_VALIDATION",
      errors: validation.errors,
    };
  }

  // 4. Valid contract: persist as STRUCTURALLY_VALID
  const savedRecord = runbookRepository.saveContract(validation.contract, {
    validationStatus: "STRUCTURALLY_VALID",
  });

  return {
    success: true,
    contract: validation.contract,
    versionId,
    contractId: savedRecord.id,
    validationStatus: "STRUCTURALLY_VALID",
    errors: [],
  };
}

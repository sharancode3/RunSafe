import { RunbookRepository, type RecoveryContract, type RecoveryContractStep } from "@runsafe/runbooks";
import type { ProofCarryingAction } from "@runsafe/actions";
import type { ReasonCode } from "../kernel/safety-decision.js";

export interface ContractAuthorityPolicyResult {
  passed: boolean;
  contract?: RecoveryContract;
  step?: RecoveryContractStep;
  reasonCode?: ReasonCode;
  message?: string;
}

export function evaluateContractAuthorityPolicy(
  action: ProofCarryingAction,
  repo: RunbookRepository = new RunbookRepository()
): ContractAuthorityPolicyResult {
  const contractRecord = repo.getContract(action.contractId);
  if (!contractRecord) {
    return {
      passed: false,
      reasonCode: "CONTRACT_NOT_FOUND",
      message: `Referenced recovery contract '${action.contractId}' was not found in control plane database.`,
    };
  }

  if (contractRecord.is_active !== 1 && contractRecord.activation_status !== "ACTIVE") {
    return {
      passed: false,
      reasonCode: "CONTRACT_INACTIVE",
      message: `Recovery contract '${action.contractId}' is inactive. Only active recovery contracts can authorize actions.`,
    };
  }

  let contract: RecoveryContract;
  try {
    contract = JSON.parse(contractRecord.contract_payload);
  } catch (err) {
    return {
      passed: false,
      reasonCode: "CONTRACT_NOT_FOUND",
      message: `Failed to parse recovery contract payload for contract '${action.contractId}'.`,
    };
  }

  const step = contract.steps.find((s) => s.id === action.stepId);
  if (!step) {
    return {
      passed: false,
      reasonCode: "CONTRACT_STEP_NOT_FOUND",
      message: `Step '${action.stepId}' does not exist in recovery contract '${action.contractId}'.`,
    };
  }

  if (step.toolName !== action.toolName) {
    return {
      passed: false,
      reasonCode: "TOOL_STEP_MISMATCH",
      message: `Action specifies tool '${action.toolName}', but contract step '${step.id}' specifies tool '${step.toolName}'.`,
    };
  }

  return {
    passed: true,
    contract,
    step,
  };
}

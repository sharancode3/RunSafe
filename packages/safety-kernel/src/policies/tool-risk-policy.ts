import { TOOL_REGISTRY, type ToolRecord, type CapabilityMode } from "@runsafe/shared";
import type { ReasonCode } from "../kernel/safety-decision.js";

export interface ToolRiskPolicyResult {
  passed: boolean;
  toolRecord?: ToolRecord;
  reasonCode?: ReasonCode;
  message?: string;
}

export function evaluateToolRiskPolicy(
  toolName: string,
  mode: CapabilityMode = "RECOVERY"
): ToolRiskPolicyResult {
  const tool = TOOL_REGISTRY[toolName];
  if (!tool) {
    return {
      passed: false,
      reasonCode: "UNKNOWN_TOOL",
      message: `Tool '${toolName}' is not registered in the authoritative TOOL_REGISTRY.`,
    };
  }

  if (tool.rehearsalOnly && mode === "RECOVERY") {
    return {
      passed: false,
      reasonCode: "REHEARSAL_TOOL_IN_RECOVERY",
      message: `Tool '${toolName}' is marked rehearsal-only and is prohibited in RECOVERY mode.`,
    };
  }

  return {
    passed: true,
    toolRecord: tool,
  };
}

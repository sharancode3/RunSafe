import type { RecoveryContract, RecoveryContractStep } from "../schemas.js";

/**
 * Deterministic Markdown Parser for RunSafe Operational Runbooks.
 * Extracts structured metadata, steps, branch logic, risk tier, and criteria
 * from human-authored Markdown documents.
 */
export function parseRunbookMarkdown(
  markdown: string,
  defaults: {
    runbookId: string;
    runbookVersionId: string;
    targetService: string;
    contractVersion?: string;
  }
): Partial<RecoveryContract> {
  // If the markdown contains a fenced json block matching recovery contract, try extracting it
  const jsonMatch = markdown.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.steps && Array.isArray(parsed.steps)) {
        return {
          id: parsed.id || `contract_${defaults.runbookId}_${Date.now()}`,
          runbookId: defaults.runbookId,
          runbookVersionId: defaults.runbookVersionId,
          targetService: parsed.targetService || defaults.targetService,
          schemaVersion: "1.0.0",
          contractVersion: parsed.contractVersion || defaults.contractVersion || "v1.0.0",
          title: parsed.title || "Parsed Operational Runbook",
          description: parsed.description || "Compiled from embedded contract JSON",
          entryStepId: parsed.entryStepId || parsed.steps[0]?.id || "",
          steps: parsed.steps,
          terminalStates: parsed.terminalStates || ["RESOLVED", "ESCALATED", "ABSTAINED"],
          createdAt: parsed.createdAt || new Date().toISOString(),
        };
      }
    } catch {
      // Fall through to Markdown line-by-line parsing
    }
  }

  // Parse Markdown sections line by line
  const lines = markdown.split(/\r?\n/);
  let title = "Standard Operational Runbook";
  let description = "";
  const steps: RecoveryContractStep[] = [];
  let currentStep: Partial<RecoveryContractStep> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("# ")) {
      title = line.replace(/^#\s+/, "").trim();
      continue;
    }

    if (line.startsWith("## Description") || line.startsWith("## Summary")) {
      const descLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].startsWith("#")) {
        if (lines[j].trim()) descLines.push(lines[j].trim());
        j++;
      }
      description = descLines.join(" ");
      i = j - 1;
      continue;
    }

    // Step heading: "### Step 1: Title (STEP_ID)" or "### STEP_ID: Title"
    if (line.startsWith("### ")) {
      if (currentStep && currentStep.id && currentStep.toolName) {
        steps.push(finalizeStep(currentStep, defaults.targetService));
      }

      const heading = line.replace(/^###\s+/, "").trim();
      const idMatch = heading.match(/\((STEP_[A-Z0-9_]+)\)/) || heading.match(/^(STEP_[A-Z0-9_]+)[:\s]/);
      const stepId = idMatch ? (idMatch[1] || idMatch[0].replace(/[:\s]/g, "")) : `STEP_${steps.length + 1}`;
      const stepTitle = heading.replace(/\(STEP_[A-Z0-9_]+\)/, "").replace(/^STEP_[A-Z0-9_]+[:\s]*/, "").trim();

      currentStep = {
        id: stepId,
        title: stepTitle || `Step ${steps.length + 1}`,
        description: "",
        defaultArguments: {},
        preconditions: [],
        successCriteria: [],
        evidenceRequirements: [],
        isReversible: false,
        requiresApproval: false,
      };
      continue;
    }

    if (currentStep) {
      if (line.startsWith("- Tool:") || line.startsWith("* Tool:")) {
        currentStep.toolName = line.split(":")[1].trim();
      } else if (line.startsWith("- Target:") || line.startsWith("* Target:")) {
        currentStep.targetResource = line.split(":")[1].trim();
      } else if (line.startsWith("- Risk:") || line.startsWith("* Risk:")) {
        currentStep.riskLevel = line.split(":")[1].trim() as any;
      } else if (line.startsWith("- Reversible:") || line.startsWith("* Reversible:")) {
        currentStep.isReversible = line.split(":")[1].trim().toLowerCase() === "true";
      } else if (line.startsWith("- Approval:") || line.startsWith("* Approval:")) {
        currentStep.requiresApproval = line.split(":")[1].trim().toLowerCase() === "true";
      } else if (line.startsWith("- On Success:") || line.startsWith("* On Success:")) {
        currentStep.onSuccess = line.split(":")[1].trim();
      } else if (line.startsWith("- On Failure:") || line.startsWith("* On Failure:")) {
        currentStep.onFailure = line.split(":")[1].trim();
      } else if (line.startsWith("- Description:") || line.startsWith("* Description:")) {
        currentStep.description = line.substring(line.indexOf(":") + 1).trim();
      }
    }
  }

  if (currentStep && currentStep.id && currentStep.toolName) {
    steps.push(finalizeStep(currentStep, defaults.targetService));
  }

  const entryStepId = steps.length > 0 ? steps[0].id : "STEP_1";

  return {
    id: `contract_${defaults.runbookId}_${Date.now()}`,
    runbookId: defaults.runbookId,
    runbookVersionId: defaults.runbookVersionId,
    targetService: defaults.targetService,
    schemaVersion: "1.0.0",
    contractVersion: defaults.contractVersion || "v1.0.0",
    title,
    description: description || "Operational runbook compiled from markdown",
    entryStepId,
    steps,
    terminalStates: ["RESOLVED", "ESCALATED", "ABSTAINED"],
    createdAt: new Date().toISOString(),
  };
}

function finalizeStep(
  partial: Partial<RecoveryContractStep>,
  defaultTarget: string
): RecoveryContractStep {
  return {
    id: partial.id || "STEP_UNKNOWN",
    title: partial.title || partial.id || "Step",
    description: partial.description || "",
    toolName: partial.toolName || "get_service_health",
    defaultArguments: partial.defaultArguments || {},
    targetResource: partial.targetResource || defaultTarget,
    riskLevel: partial.riskLevel || "READ_ONLY",
    isReversible: partial.isReversible ?? false,
    rollbackStepId: partial.rollbackStepId,
    requiresApproval: partial.requiresApproval ?? false,
    preconditions: partial.preconditions || [],
    successCriteria: partial.successCriteria || [],
    evidenceRequirements: partial.evidenceRequirements || [],
    onSuccess: partial.onSuccess || "RESOLVED",
    onFailure: partial.onFailure || "ESCALATED",
  };
}

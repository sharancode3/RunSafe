import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  compileRunbook,
  validateRecoveryContract,
  runbookRepository,
  type RecoveryContract,
} from "@runsafe/runbooks";

describe("Runbook & Recovery Contract Subsystem", () => {
  const sampleMarkdown = fs.readFileSync(
    path.join(process.cwd(), "runbooks/checkout_recovery_runbook.md"),
    "utf-8"
  );
  const sampleMarkdownV2 = fs.readFileSync(
    path.join(process.cwd(), "runbooks/checkout_recovery_runbook_v2.md"),
    "utf-8"
  );

  it("should compile canonical human runbook into structurally valid RecoveryContract", async () => {
    const result = await compileRunbook(sampleMarkdown, {
      runbookId: "rb_test_checkout",
      version: "v1.0.0",
      targetService: "checkout-service",
      author: "Lead-SRE",
    });

    expect(result.success).toBe(true);
    expect(result.validationStatus).toBe("STRUCTURALLY_VALID");
    expect(result.errors).toHaveLength(0);
    expect(result.contract).toBeDefined();
    expect(result.contract?.steps.length).toBeGreaterThanOrEqual(7);
    expect(result.contract?.entryStepId).toBe("STEP_1_OBSERVE_INGRESS");
    expect(result.contract?.targetService).toBe("checkout-service");
  });

  it("should store and track multiple runbook versions in SQLite (v1 and v2)", async () => {
    const runbookId = `rb_version_test_${Date.now()}`;
    runbookRepository.createRunbook({
      id: runbookId,
      name: `Version Test Runbook ${Date.now()}`,
      targetService: "checkout-service",
    });

    const v1 = await compileRunbook(sampleMarkdown, {
      runbookId,
      version: "v1.0.0",
      targetService: "checkout-service",
    });
    const v2 = await compileRunbook(sampleMarkdownV2, {
      runbookId,
      version: "v2.0.0",
      targetService: "checkout-service",
    });

    expect(v1.success).toBe(true);
    expect(v2.success).toBe(true);

    const versions = runbookRepository.getVersionsByRunbook(runbookId);
    expect(versions.length).toBe(2);
    const verStrings = versions.map((v) => v.version);
    expect(verStrings).toContain("v1.0.0");
    expect(verStrings).toContain("v2.0.0");
  });

  it("should deterministically reject contract with unknown tool reference", () => {
    const invalidContract: any = {
      id: "contract_invalid_tool",
      runbookId: "rb_invalid",
      runbookVersionId: "ver_invalid",
      targetService: "checkout-service",
      schemaVersion: "1.0.0",
      contractVersion: "v1.0.0",
      title: "Adversarial Contract",
      description: "Tries to invoke unknown tool",
      entryStepId: "STEP_1",
      steps: [
        {
          id: "STEP_1",
          title: "Harmful Action",
          description: "Drop all databases",
          toolName: "drop_all_production_databases",
          defaultArguments: {},
          targetResource: "postgres",
          riskLevel: "DESTRUCTIVE",
          isReversible: false,
          requiresApproval: true,
          preconditions: [],
          successCriteria: [],
          evidenceRequirements: [],
          onSuccess: "RESOLVED",
          onFailure: "ESCALATED",
        },
      ],
      terminalStates: ["RESOLVED", "ESCALATED"],
      createdAt: new Date().toISOString(),
    };

    const res = validateRecoveryContract(invalidContract);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("TOOL_REGISTRY"))).toBe(true);
  });

  it("should deterministically reject contract with unknown resource reference", () => {
    const invalidContract: any = {
      id: "contract_invalid_res",
      runbookId: "rb_invalid",
      runbookVersionId: "ver_invalid",
      targetService: "checkout-service",
      schemaVersion: "1.0.0",
      contractVersion: "v1.0.0",
      title: "Unknown Target Contract",
      description: "Tries to target arbitrary cloud server",
      entryStepId: "STEP_1",
      steps: [
        {
          id: "STEP_1",
          title: "Observe Phantom Server",
          description: "Observe server",
          toolName: "get_service_health",
          defaultArguments: {},
          targetResource: "production-payment-gateway-external-cluster-999",
          riskLevel: "READ_ONLY",
          isReversible: true,
          requiresApproval: false,
          preconditions: [],
          successCriteria: [],
          evidenceRequirements: [],
          onSuccess: "RESOLVED",
          onFailure: "ESCALATED",
        },
      ],
      terminalStates: ["RESOLVED", "ESCALATED"],
      createdAt: new Date().toISOString(),
    };

    const res = validateRecoveryContract(invalidContract);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("RESOURCE_REGISTRY"))).toBe(true);
  });

  it("should prevent models from downgrading risk level", () => {
    const invalidContract: any = {
      id: "contract_risk_downgrade",
      runbookId: "rb_risk",
      runbookVersionId: "ver_risk",
      targetService: "checkout-service",
      schemaVersion: "1.0.0",
      contractVersion: "v1.0.0",
      title: "Risk Downgrade Attack",
      description: "Declares rollback_canary as READ_ONLY to bypass human approval",
      entryStepId: "STEP_1",
      steps: [
        {
          id: "STEP_1",
          title: "Spoofed Canary Rollback",
          description: "Rollback marked as read only",
          toolName: "rollback_canary",
          defaultArguments: { replicaId: "checkout-api-2" },
          targetResource: "checkout-api-2",
          riskLevel: "READ_ONLY", // Registry requires HIGH_RISK!
          isReversible: true,
          requiresApproval: false,
          preconditions: [],
          successCriteria: [],
          evidenceRequirements: [],
          onSuccess: "RESOLVED",
          onFailure: "ESCALATED",
        },
      ],
      terminalStates: ["RESOLVED", "ESCALATED"],
      createdAt: new Date().toISOString(),
    };

    const res = validateRecoveryContract(invalidContract);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("Risk downgrade prohibited"))).toBe(true);
  });

  it("should isolate rehearsal tools from recovery contracts", () => {
    const invalidContract: any = {
      id: "contract_rehearsal_leak",
      runbookId: "rb_rehearsal",
      runbookVersionId: "ver_rehearsal",
      targetService: "checkout-service",
      schemaVersion: "1.0.0",
      contractVersion: "v1.0.0",
      title: "Fault Tool in Recovery",
      description: "Accidentally injects fault during recovery",
      entryStepId: "STEP_1",
      steps: [
        {
          id: "STEP_1",
          title: "Accidental Fault Injection",
          description: "Calls inject_bad_deployment",
          toolName: "inject_bad_deployment",
          defaultArguments: {},
          targetResource: "checkout-api-2",
          riskLevel: "DESTRUCTIVE",
          isReversible: true,
          requiresApproval: true,
          preconditions: [],
          successCriteria: [],
          evidenceRequirements: [],
          onSuccess: "RESOLVED",
          onFailure: "ESCALATED",
        },
      ],
      terminalStates: ["RESOLVED", "ESCALATED"],
      createdAt: new Date().toISOString(),
    };

    const res = validateRecoveryContract(invalidContract, { isRehearsalContract: false });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("Rehearsal isolation violation"))).toBe(true);
  });

  it("should detect invalid branch graph transitions, unreachable steps, and infinite cycles", () => {
    // 1. Missing entryStepId
    const badEntry: any = {
      id: "bad_entry",
      runbookId: "rb_graph",
      runbookVersionId: "ver_graph",
      targetService: "checkout-service",
      schemaVersion: "1.0.0",
      contractVersion: "v1.0.0",
      title: "Bad Entry",
      description: "Non-existent entry step",
      entryStepId: "STEP_DOES_NOT_EXIST",
      steps: [
        {
          id: "STEP_1",
          title: "Step 1",
          description: "Desc",
          toolName: "get_service_health",
          defaultArguments: {},
          targetResource: "checkout-service",
          riskLevel: "READ_ONLY",
          isReversible: true,
          requiresApproval: false,
          preconditions: [],
          successCriteria: [],
          evidenceRequirements: [],
          onSuccess: "RESOLVED",
          onFailure: "ESCALATED",
        },
      ],
      terminalStates: ["RESOLVED", "ESCALATED"],
      createdAt: new Date().toISOString(),
    };
    expect(validateRecoveryContract(badEntry).valid).toBe(false);

    // 2. Unreachable dead step
    const unreachableStep: any = {
      ...badEntry,
      entryStepId: "STEP_1",
      steps: [
        {
          ...badEntry.steps[0],
          id: "STEP_1",
          onSuccess: "RESOLVED",
          onFailure: "ESCALATED",
        },
        {
          ...badEntry.steps[0],
          id: "STEP_DEAD_CODE",
          onSuccess: "RESOLVED",
          onFailure: "ESCALATED",
        },
      ],
    };
    const deadRes = validateRecoveryContract(unreachableStep);
    expect(deadRes.valid).toBe(false);
    expect(deadRes.errors.some((e) => e.includes("unreachable from entryStepId"))).toBe(true);

    // 3. Cycle with no terminal exit (infinite loop)
    const infiniteLoop: any = {
      ...badEntry,
      entryStepId: "STEP_A",
      steps: [
        {
          ...badEntry.steps[0],
          id: "STEP_A",
          onSuccess: "STEP_B",
          onFailure: "STEP_B",
        },
        {
          ...badEntry.steps[0],
          id: "STEP_B",
          onSuccess: "STEP_A",
          onFailure: "STEP_A",
        },
      ],
    };
    const loopRes = validateRecoveryContract(infiniteLoop);
    expect(loopRes.valid).toBe(false);
    expect(loopRes.errors.some((e) => e.includes("trapped in a cyclic subgraph"))).toBe(true);
  });

  it("should enforce contract activation guards and single active contract invariant", async () => {
    const runbookId = `rb_activation_${Date.now()}`;
    runbookRepository.createRunbook({
      id: runbookId,
      name: `Activation Runbook ${Date.now()}`,
      targetService: "checkout-service",
    });

    const v1 = await compileRunbook(sampleMarkdown, {
      runbookId,
      version: "v1.0.0",
      targetService: "checkout-service",
    });
    const v2 = await compileRunbook(sampleMarkdownV2, {
      runbookId,
      version: "v2.0.0",
      targetService: "checkout-service",
    });

    // 1. Activate v1
    const activatedV1 = runbookRepository.activateContract(v1.contractId!);
    expect(activatedV1.is_active).toBe(1);
    expect(activatedV1.activation_status).toBe("ACTIVE");

    let currentActive = runbookRepository.getActiveContract("checkout-service");
    expect(currentActive?.id).toBe(v1.contractId);

    // 2. Activate v2 (must atomically deactivate v1)
    const activatedV2 = runbookRepository.activateContract(v2.contractId!);
    expect(activatedV2.is_active).toBe(1);

    const oldV1 = runbookRepository.getContract(v1.contractId!);
    expect(oldV1?.is_active).toBe(0);
    expect(oldV1?.activation_status).toBe("INACTIVE");

    currentActive = runbookRepository.getActiveContract("checkout-service");
    expect(currentActive?.id).toBe(v2.contractId);
  });
});

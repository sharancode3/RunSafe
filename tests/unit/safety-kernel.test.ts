import { describe, it, expect, beforeEach } from "vitest";
import {
  SafetyKernel,
  ApprovalService,
  ExecutionAuthorizer,
} from "@runsafe/safety-kernel";
import {
  buildProofCarryingAction,
  computeActionFingerprint,
  ActionRepository,
} from "@runsafe/actions";
import {
  RunbookRepository,
  compileRunbook,
  type RecoveryContract,
} from "@runsafe/runbooks";
import {
  evidenceRepository,
  normalizeToolOutputToEvidence,
} from "@runsafe/evidence";

describe("Deterministic Safety Kernel Subsystem", () => {
  let safetyKernel: SafetyKernel;
  let approvalService: ApprovalService;
  let executionAuthorizer: ExecutionAuthorizer;
  let runbookRepo: RunbookRepository;
  let actionRepo: ActionRepository;
  let activeContract: RecoveryContract;

  beforeEach(() => {
    safetyKernel = new SafetyKernel();
    approvalService = new ApprovalService();
    executionAuthorizer = new ExecutionAuthorizer();
    runbookRepo = new RunbookRepository();
    actionRepo = new ActionRepository();

    const contractId = "contract_safety_test";
    runbookRepo.createRunbook({
      id: "rb_safety_test",
      name: "Safety Test Runbook",
      targetService: "checkout-service",
    });
    runbookRepo.createVersion({
      id: "ver_safety_001",
      runbookId: "rb_safety_test",
      version: "1.0.0",
      markdownSource: "# Safety Runbook",
      contractId,
      compilationStatus: "COMPILED",
    });

    activeContract = {
      id: contractId,
      runbookId: "rb_safety_test",
      runbookVersionId: "ver_safety_001",
      targetService: "checkout-service",
      schemaVersion: "1.0.0",
      contractVersion: "v1.0.0",
      title: "Safety Test Recovery Contract",
      description: "Direct contract for deterministic safety tests",
      entryStepId: "step_restart",
      steps: [
        {
          id: "step_restart",
          title: "Restart Replica",
          description: "Restart checkout replica 1",
          toolName: "restart_service",
          defaultArguments: { target: "checkout-api-1" },
          targetResource: "checkout-api-1",
          riskLevel: "LOW_RISK_REVERSIBLE",
          isReversible: true,
          requiresApproval: false,
          preconditions: [
            {
              id: "pre_degraded",
              description: "Service degraded",
              evidenceType: "SERVICE_HEALTH",
              assertion: "STATUS_DEGRADED",
            },
          ],
          successCriteria: [
            {
              probeType: "REPLICA_HEALTH",
              targetResource: "checkout-api-1",
              expected: "healthy",
              description: "Replica 1 healthy",
            },
          ],
          evidenceRequirements: [
            {
              evidenceType: "SERVICE_HEALTH",
              minFreshnessSeconds: 120,
              mandatory: true,
            },
          ],
          onSuccess: "RESOLVED",
          onFailure: "step_rollback",
        },
        {
          id: "step_rollback",
          title: "Rollback Canary",
          description: "Rollback canary replica 2",
          toolName: "rollback_canary",
          defaultArguments: { replicaId: "checkout-api-2", targetVersion: "v1.0.0" },
          targetResource: "checkout-api-2",
          riskLevel: "HIGH_RISK",
          isReversible: true,
          requiresApproval: true,
          preconditions: [
            {
              id: "pre_schema_lock",
              description: "Schema lock detected",
              evidenceType: "RECENT_LOGS",
              assertion: "SCHEMA_LOCK_DETECTED",
            },
          ],
          successCriteria: [
            {
              probeType: "REPLICA_HEALTH",
              targetResource: "checkout-api-2",
              expected: "healthy",
              description: "Replica 2 healthy",
            },
          ],
          evidenceRequirements: [
            {
              evidenceType: "RECENT_LOGS",
              minFreshnessSeconds: 120,
              mandatory: true,
            },
          ],
          onSuccess: "RESOLVED",
          onFailure: "ESCALATED",
        },
      ],
      terminalStates: ["RESOLVED", "ESCALATED", "ABSTAINED"],
      createdAt: new Date().toISOString(),
    };

    runbookRepo.saveContract(activeContract, { validationStatus: "STRUCTURALLY_VALID" });
    runbookRepo.activateContract(activeContract.id);
  });

  it("should AUTO_ALLOW low-risk reversible action when contract preconditions & fresh evidence pass", () => {
    // Generate fresh degraded health evidence
    const ev = normalizeToolOutputToEvidence(
      "get_service_health",
      { status: "degraded", replicas: [{ name: "checkout-api-1", status: "unhealthy" }] },
      { environment: "LOCAL", targetResource: "checkout-service" }
    );
    evidenceRepository.saveEvidence(ev);

    const step = activeContract.steps.find((s) => s.id === "step_restart")!;
    const pca = buildProofCarryingAction(
      {
        incidentId: "inc_001",
        contractId: activeContract.id,
        stepId: "step_restart",
        toolName: "restart_service",
        toolArguments: { target: "checkout-api-1" },
        justificationSummary: "Autonomous restart of unhealthy checkout replica 1",
        confidenceScore: 0.95,
        supportingEvidenceIds: [ev.id],
      },
      step
    );
    actionRepo.saveAction(pca);

    const decision = safetyKernel.evaluateAction(pca);

    expect(decision.policyDecision).toBe("AUTO_ALLOW");
    expect(decision.reasonCode).toBe("AUTONOMOUS_LOW_RISK_APPROVED");
    expect(decision.preconditionsPassed).toBe(true);
    expect(decision.checksSummary.preconditionCheck).toBe(true);
  });

  it("should require human APPROVAL for high-risk action", () => {
    // Generate fresh logs evidence showing schema lock
    const ev = normalizeToolOutputToEvidence(
      "get_recent_logs",
      { lines: ["ERROR: exclusive lock timeout on relation orders", "Transaction aborted"] },
      { environment: "LOCAL", targetResource: "checkout-api-2" }
    );
    evidenceRepository.saveEvidence(ev);

    const step = activeContract.steps.find((s) => s.id === "step_rollback")!;
    const pca = buildProofCarryingAction(
      {
        incidentId: "inc_002",
        contractId: activeContract.id,
        stepId: "step_rollback",
        toolName: "rollback_canary",
        toolArguments: { replicaId: "checkout-api-2", targetVersion: "v1.0.0" },
        justificationSummary: "Rollback canary due to schema lock defect",
        confidenceScore: 0.98,
        supportingEvidenceIds: [ev.id],
      },
      step
    );
    actionRepo.saveAction(pca);

    const decision = safetyKernel.evaluateAction(pca);

    expect(decision.policyDecision).toBe("APPROVAL_REQUIRED");
    expect(decision.preconditionsPassed).toBe(true);

    // Verify approval request was automatically registered
    const approvalReq = approvalService.getApprovalRequest(pca.id);
    expect(approvalReq).toBeDefined();
    expect(approvalReq?.status).toBe("PENDING");
    expect(approvalReq?.payloadHash).toBe(pca.payloadHash);
  });

  it("should BLOCK unknown tools not in authoritative TOOL_REGISTRY", () => {
    const fakePca = {
      id: "pca_fake_001",
      incidentId: "inc_003",
      contractId: activeContract.id,
      stepId: "step_restart",
      toolName: "drop_all_tables_now",
      toolArguments: {},
      payloadHash: "dummy",
      justificationSummary: "Fake destructive tool",
      confidenceScore: 0.99,
      supportingEvidenceIds: ["ev_fake"],
      riskTier: "DESTRUCTIVE" as const,
      blastRadius: "FLEET" as const,
      isReversible: false,
      verificationCriteria: [],
      status: "PROPOSED" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // Recompute fingerprint so anti-tamper passes to reach tool registry check
    fakePca.payloadHash = computeActionFingerprint({
      incidentId: fakePca.incidentId,
      contractId: fakePca.contractId,
      stepId: fakePca.stepId,
      toolName: fakePca.toolName,
      toolArguments: fakePca.toolArguments,
      riskTier: fakePca.riskTier,
      blastRadius: fakePca.blastRadius,
    });

    const decision = safetyKernel.evaluateAction(fakePca);
    expect(decision.policyDecision).toBe("BLOCKED");
    expect(decision.reasonCode).toBe("UNKNOWN_TOOL");
  });

  it("should BLOCK rehearsal-only tools in RECOVERY capability mode", () => {
    const rehearsalPca = {
      id: "pca_rehearsal_001",
      incidentId: "inc_004",
      contractId: activeContract.id,
      stepId: "step_restart",
      toolName: "inject_process_crash",
      toolArguments: { targetReplica: "checkout-api-1" },
      payloadHash: "",
      justificationSummary: "Attempting fault injection in recovery mode",
      confidenceScore: 0.9,
      supportingEvidenceIds: ["ev_fake"],
      riskTier: "DESTRUCTIVE" as const,
      blastRadius: "CONTAINER" as const,
      isReversible: true,
      verificationCriteria: [],
      status: "PROPOSED" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    rehearsalPca.payloadHash = computeActionFingerprint({
      incidentId: rehearsalPca.incidentId,
      contractId: rehearsalPca.contractId,
      stepId: rehearsalPca.stepId,
      toolName: rehearsalPca.toolName,
      toolArguments: rehearsalPca.toolArguments,
      riskTier: rehearsalPca.riskTier,
      blastRadius: rehearsalPca.blastRadius,
    });

    const decision = safetyKernel.evaluateAction(rehearsalPca, { mode: "RECOVERY" });
    expect(decision.policyDecision).toBe("BLOCKED");
    expect(decision.reasonCode).toBe("REHEARSAL_TOOL_IN_RECOVERY");
  });

  it("should BLOCK actions when supporting evidence is stale (> 120s)", () => {
    // Save stale evidence (collected 300s ago)
    const staleCollected = new Date(Date.now() - 300 * 1000).toISOString();
    const staleEv = {
      id: "ev_stale_001",
      incidentId: "inc_005",
      environment: "LOCAL" as const,
      targetResource: "checkout-service",
      evidenceType: "SERVICE_HEALTH" as const,
      sourceType: "OBSERVATION_TOOL" as const,
      sourceTool: "get_service_health",
      observedAt: staleCollected,
      collectedAt: staleCollected,
      summary: "Stale degraded health",
      structuredValue: { status: "degraded" },
      freshnessStatus: "STALE" as const,
      derived: false,
      sourceEvidenceIds: [],
      createdAt: staleCollected,
    };
    evidenceRepository.saveEvidence(staleEv);

    const step = activeContract.steps.find((s) => s.id === "step_restart")!;
    const pca = buildProofCarryingAction(
      {
        incidentId: "inc_005",
        contractId: activeContract.id,
        stepId: "step_restart",
        toolName: "restart_service",
        toolArguments: { target: "checkout-api-1" },
        justificationSummary: "Restarting based on stale evidence",
        confidenceScore: 0.8,
        supportingEvidenceIds: [staleEv.id],
      },
      step
    );

    const decision = safetyKernel.evaluateAction(pca);
    expect(decision.policyDecision).toBe("BLOCKED");
    expect(decision.reasonCode).toBe("STALE_EVIDENCE");
  });

  it("should BLOCK actions when contract preconditions fail", () => {
    // Evidence showing healthy (NOT degraded)
    const healthyEv = normalizeToolOutputToEvidence(
      "get_service_health",
      { status: "healthy", replicas: [{ name: "checkout-api-1", status: "healthy" }] },
      { environment: "LOCAL", targetResource: "checkout-service" }
    );
    evidenceRepository.saveEvidence(healthyEv);

    const step = activeContract.steps.find((s) => s.id === "step_restart")!;
    const pca = buildProofCarryingAction(
      {
        incidentId: "inc_006",
        contractId: activeContract.id,
        stepId: "step_restart",
        toolName: "restart_service",
        toolArguments: { target: "checkout-api-1" },
        justificationSummary: "Precondition should fail because service is healthy",
        confidenceScore: 0.9,
        supportingEvidenceIds: [healthyEv.id],
      },
      step
    );

    const decision = safetyKernel.evaluateAction(pca);
    expect(decision.policyDecision).toBe("BLOCKED");
    expect(decision.reasonCode).toBe("PRECONDITION_FAILED");
    expect(decision.preconditionsPassed).toBe(false);
  });

  it("should BLOCK tampered actions where payload hash does not match content", () => {
    const ev = normalizeToolOutputToEvidence(
      "get_service_health",
      { status: "degraded" },
      { environment: "LOCAL", targetResource: "checkout-service" }
    );
    evidenceRepository.saveEvidence(ev);

    const step = activeContract.steps.find((s) => s.id === "step_restart")!;
    const pca = buildProofCarryingAction(
      {
        incidentId: "inc_007",
        contractId: activeContract.id,
        stepId: "step_restart",
        toolName: "restart_service",
        toolArguments: { target: "checkout-api-1" },
        justificationSummary: "Tamper test",
        confidenceScore: 0.9,
        supportingEvidenceIds: [ev.id],
      },
      step
    );

    // Tamper with payload hash
    const tamperedPca = { ...pca, payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" };

    const decision = safetyKernel.evaluateAction(tamperedPca);
    expect(decision.policyDecision).toBe("BLOCKED");
    expect(decision.reasonCode).toBe("FINGERPRINT_TAMPERED");
  });

  it("should enforce exact cryptographic fingerprint binding during approval", () => {
    const ev = normalizeToolOutputToEvidence(
      "get_recent_logs",
      { lines: ["exclusive lock timeout on relation orders"] },
      { environment: "LOCAL", targetResource: "checkout-api-2" }
    );
    evidenceRepository.saveEvidence(ev);

    const step = activeContract.steps.find((s) => s.id === "step_rollback")!;
    const pca = buildProofCarryingAction(
      {
        incidentId: "inc_appr_01",
        contractId: activeContract.id,
        stepId: "step_rollback",
        toolName: "rollback_canary",
        toolArguments: { replicaId: "checkout-api-2", targetVersion: "v1.0.0" },
        justificationSummary: "Rollback canary approval test",
        confidenceScore: 0.95,
        supportingEvidenceIds: [ev.id],
      },
      step
    );
    actionRepo.saveAction(pca);

    // Evaluate
    safetyKernel.evaluateAction(pca);

    // Attempt approval with wrong fingerprint
    const wrongApproval = approvalService.approveAction({
      actionId: pca.id,
      operatorId: "lead-sre-alice",
      payloadHash: "wrong_sha256_hash_12345",
      operatorNote: "Trying to approve with forged hash",
    });
    expect(wrongApproval.success).toBe(false);
    expect(wrongApproval.error).toContain("FINGERPRINT_MISMATCH");

    // Approve with exact cryptographic fingerprint
    const validApproval = approvalService.approveAction({
      actionId: pca.id,
      operatorId: "lead-sre-alice",
      payloadHash: pca.payloadHash,
      operatorNote: "Approved verified rollback of checkout-api-2",
    });
    expect(validApproval.success).toBe(true);

    const updatedPca = actionRepo.getActionById(pca.id);
    expect(updatedPca?.status).toBe("APPROVED");
  });

  it("should atomically claim execution and prevent duplicate execution", () => {
    // Set up auto-allow action
    const ev = normalizeToolOutputToEvidence(
      "get_service_health",
      { status: "degraded", replicas: [{ name: "checkout-api-1", status: "unhealthy" }] },
      { environment: "LOCAL", targetResource: "checkout-service" }
    );
    evidenceRepository.saveEvidence(ev);

    const step = activeContract.steps.find((s) => s.id === "step_restart")!;
    const pca = buildProofCarryingAction(
      {
        incidentId: "inc_exec_01",
        contractId: activeContract.id,
        stepId: "step_restart",
        toolName: "restart_service",
        toolArguments: { target: "checkout-api-1" },
        justificationSummary: "Execution claim test",
        confidenceScore: 0.95,
        supportingEvidenceIds: [ev.id],
      },
      step
    );
    actionRepo.saveAction(pca);

    // Evaluate
    safetyKernel.evaluateAction(pca);

    // First claim must succeed
    const claim1 = executionAuthorizer.claimExecution(pca.id);
    expect(claim1.claimed).toBe(true);
    expect(claim1.executionToken).toBeDefined();

    // Second claim immediately fails (atomic claim prevents double clicks!)
    const claim2 = executionAuthorizer.claimExecution(pca.id);
    expect(claim2.claimed).toBe(false);
    expect(claim2.reason).toContain("DUPLICATE_EXECUTION_BLOCKED");

    // Complete execution
    executionAuthorizer.recordExecutionResult(pca.id, claim1.executionToken!, {
      exitCode: 0,
      durationMs: 450,
      rawOutputExcerpt: "Container restarted successfully",
    });

    const finalPca = actionRepo.getActionById(pca.id);
    expect(finalPca?.status).toBe("EXECUTED");

    // Subsequent claim after EXECUTED still blocked
    const claim3 = executionAuthorizer.claimExecution(pca.id);
    expect(claim3.claimed).toBe(false);
    expect(claim3.reason).toContain("DUPLICATE_EXECUTION_BLOCKED");
  });
});

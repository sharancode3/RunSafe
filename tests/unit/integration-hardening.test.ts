import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import {
  getControlPlaneDb,
  TargetEnvironment,
  RunSafeOperationalError,
} from "@runsafe/shared";
import {
  buildProofCarryingAction,
  ActionRepository,
  computeActionFingerprint,
} from "@runsafe/actions";
import {
  SafetyKernel,
  ApprovalService,
  ExecutionAuthorizer,
} from "@runsafe/safety-kernel";
import {
  getInfrastructureAdapter,
} from "@runsafe/infrastructure-adapter";
import { IndependentVerifier } from "@runsafe/verifier";
import { incidentRepository } from "../../packages/recovery-engine/src/incident/incident-repository.js";
import { RecoveryOrchestrator } from "../../packages/recovery-engine/src/orchestrator/recovery-orchestrator.js";
import { evidenceRepository, type EvidenceRecord } from "@runsafe/evidence";
import type { RecoveryContractStep, SuccessCriterion } from "@runsafe/runbooks";

describe("Stage 10 Integration & Reliability Hardening", () => {
  let safetyKernel: SafetyKernel;
  let approvalService: ApprovalService;
  let executionAuthorizer: ExecutionAuthorizer;
  let actionRepo: ActionRepository;

  beforeEach(() => {
    safetyKernel = new SafetyKernel();
    approvalService = new ApprovalService();
    executionAuthorizer = new ExecutionAuthorizer();
    actionRepo = new ActionRepository();
  });

  describe("Anti-Tamper & Cryptographic Fingerprinting", () => {
    it("should reject action evaluation when payload hash has been tampered with", () => {
      // 1. Seed supporting evidence
      const evId = `ev_test_${randomUUID()}`;
      const ev: EvidenceRecord = {
        id: evId,
        incidentId: "inc_test_hardening",
        environment: "LOCAL",
        targetResource: "checkout-api-1",
        evidenceType: "SERVICE_HEALTH",
        sourceType: "OBSERVATION_TOOL",
        sourceTool: "get_service_health",
        observedAt: new Date().toISOString(),
        collectedAt: new Date().toISOString(),
        summary: "Service replica is healthy",
        structuredValue: { status: "healthy", httpStatus: 200 },
        freshnessStatus: "FRESH",
        derived: false,
        sourceEvidenceIds: [],
        createdAt: new Date().toISOString(),
      };
      evidenceRepository.saveEvidence(ev);

      const step: RecoveryContractStep = {
        id: "STEP_TEST_1",
        title: "Test Step",
        description: "Test step description",
        toolName: "restart_service",
        targetResource: "checkout-api-1",
        riskLevel: "LOW_RISK_REVERSIBLE",
        isReversible: true,
        requiresApproval: false,
        onSuccess: "RESOLVED",
        onFailure: "ESCALATED",
        defaultArguments: { target: "checkout-api-1" },
        evidenceRequirements: [],
        preconditions: [],
        successCriteria: [],
      };

      const pca = buildProofCarryingAction(
        {
          incidentId: "inc_test_hardening",
          contractId: "contract_checkout_recovery_v1",
          stepId: "STEP_TEST_1",
          toolName: "restart_service",
          toolArguments: { target: "checkout-api-1" },
          justificationSummary: "Tamper test",
          confidenceScore: 0.95,
          supportingEvidenceIds: [evId],
        },
        step
      );

      // Save action
      actionRepo.saveAction(pca);

      // Tamper with payload hash
      const tamperedPca = {
        ...pca,
        payloadHash: "0000000000000000000000000000000000000000000000000000000000000000",
      };

      const decision = safetyKernel.evaluateAction(tamperedPca);
      expect(decision.policyDecision).toBe("BLOCKED");
      expect(decision.reasonCode).toBe("FINGERPRINT_TAMPERED");
      expect(decision.checksSummary.fingerprintCheck).toBe(false);
    });

    it("should reject approval when operator submits mismatched payload hash", () => {
      const actionId = `pca_tamper_${randomUUID()}`;
      const originalHash = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
      const db = getControlPlaneDb();
      const now = new Date().toISOString();

      // Seed parent action first to satisfy foreign key
      db.prepare(`
        INSERT INTO proof_carrying_actions (
          id, incident_id, contract_id, step_id, tool_name, tool_arguments,
          payload_hash, justification_summary, confidence_score, supporting_evidence_ids,
          risk_tier, blast_radius, is_reversible, verification_criteria, status, created_at, updated_at
        ) VALUES (?, 'inc_hardening', 'contract_checkout_recovery_v1', 'STEP_5_ROLLBACK_CANARY',
                  'rollback_canary', '{}', ?, 'Justification', 0.95, '[]',
                  'HIGH_RISK', 'CONTAINER', 1, '[]', 'PROPOSED', ?, ?)
      `).run(actionId, originalHash, now, now);

      // Seed approval request
      db.prepare(`
        INSERT INTO approval_requests (
          id, action_id, payload_hash, status, expires_at, created_at
        ) VALUES (?, ?, ?, 'PENDING', ?, ?)
      `).run(
        `appr_${randomUUID()}`,
        actionId,
        originalHash,
        new Date(Date.now() + 600000).toISOString(),
        now
      );

      // Attempt approval with tampered hash
      const result = approvalService.approveAction({
        actionId,
        operatorId: "operator_alice",
        payloadHash: "mismatched_hash_ffffffffffffffffffffffffffffffffffffff",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("FINGERPRINT_MISMATCH");
    });
  });

  describe("Single-Use Authorization & Replay Protection", () => {
    it("should prevent duplicate execution claims for an action already EXECUTING or EXECUTED", () => {
      const actionId = `pca_exec_${randomUUID()}`;
      const db = getControlPlaneDb();
      const now = new Date().toISOString();

      // Seed PCA in PROPOSED state with valid blastRadius enum value 'CONTAINER'
      db.prepare(`
        INSERT INTO proof_carrying_actions (
          id, incident_id, contract_id, step_id, tool_name, tool_arguments,
          payload_hash, justification_summary, confidence_score, supporting_evidence_ids,
          risk_tier, blast_radius, is_reversible, verification_criteria, status, created_at, updated_at
        ) VALUES (?, 'inc_hardening', 'contract_checkout_recovery_v1', 'STEP_4_RESTART_REPLICA',
                  'restart_service', '{"target":"checkout-api-1"}', 'hash123',
                  'Justification', 0.95, '[]', 'LOW_RISK_REVERSIBLE',
                  'CONTAINER', 1, '[]', 'PROPOSED', ?, ?)
      `).run(actionId, now, now);

      // Seed AUTO_ALLOW safety decision with full checks_summary
      db.prepare(`
        INSERT INTO safety_policy_decisions (
          id, action_id, policy_decision, reason_code, reason_message,
          matched_rule, preconditions_passed, checks_summary, evaluated_at
        ) VALUES (?, ?, 'AUTO_ALLOW', 'AUTONOMOUS_LOW_RISK_APPROVED', 'Allowed',
                  'RULE_ALLOW', 1, ?, ?)
      `).run(
        `dec_${randomUUID()}`,
        actionId,
        JSON.stringify({
          toolCheck: true,
          fingerprintCheck: true,
          contractCheck: true,
          evidenceCheck: true,
          preconditionCheck: true,
          details: {},
        }),
        now
      );

      // 1st Claim should succeed
      const firstClaim = executionAuthorizer.claimExecution(actionId);
      expect(firstClaim.claimed).toBe(true);
      expect(firstClaim.executionToken).toBeDefined();

      // 2nd Claim while EXECUTING should be BLOCKED (duplicate execution)
      const secondClaim = executionAuthorizer.claimExecution(actionId);
      expect(secondClaim.claimed).toBe(false);
      expect(secondClaim.reason).toContain("DUPLICATE_EXECUTION_BLOCKED");

      // Record completion
      executionAuthorizer.recordExecutionResult(actionId, firstClaim.executionToken!, {
        exitCode: 0,
        durationMs: 120,
      });

      // 3rd Claim after EXECUTED should also be BLOCKED
      const thirdClaim = executionAuthorizer.claimExecution(actionId);
      expect(thirdClaim.claimed).toBe(false);
      expect(thirdClaim.reason).toContain("DUPLICATE_EXECUTION_BLOCKED");
    });
  });

  describe("Target & Environment Binding Invariants", () => {
    it("should strictly reject unknown environments without fallback", () => {
      expect(() => {
        getInfrastructureAdapter("GCP" as any);
      }).toThrowError(RunSafeOperationalError);

      try {
        getInfrastructureAdapter("UNKNOWN_CLOUD" as any);
      } catch (err: any) {
        expect(err.code).toBe("UNKNOWN_ENVIRONMENT");
      }
    });

    it("should throw ADAPTER_NOT_CONFIGURED when AWS target is requested without credentials", async () => {
      const originalHost = process.env.RUNSAFE_AWS_HOST;
      const originalKey = process.env.AWS_ACCESS_KEY_ID;
      delete process.env.RUNSAFE_AWS_HOST;
      delete process.env.AWS_ACCESS_KEY_ID;

      const awsAdapter = getInfrastructureAdapter("AWS");
      expect(awsAdapter.environment).toBe("AWS");

      await expect(awsAdapter.getServiceHealth("checkout-service")).rejects.toThrowError(
        RunSafeOperationalError
      );

      // Restore
      if (originalHost) process.env.RUNSAFE_AWS_HOST = originalHost;
      if (originalKey) process.env.AWS_ACCESS_KEY_ID = originalKey;
    });
  });

  describe("Capability Mode Security Boundary", () => {
    it("should prohibit rehearsal-only fault injection tools in RECOVERY mode", () => {
      const actionId = `pca_fault_${randomUUID()}`;
      const basePayload = {
        actionId,
        incidentId: "inc_test",
        contractId: "contract_checkout_recovery_v1",
        stepId: "STEP_FAULT",
        toolName: "inject_bad_deployment",
        toolArguments: {},
        riskTier: "DESTRUCTIVE" as const,
        isReversible: true,
        blastRadius: "CONTAINER" as const,
        timeoutMs: 30000,
        requiresVerification: false,
        confidenceScore: 0.95,
        supportingEvidenceIds: ["ev_dummy"],
        justificationSummary: "Illegal fault injection",
      };

      const payloadHash = computeActionFingerprint(basePayload);

      const decision = safetyKernel.evaluateAction(
        {
          id: actionId,
          ...basePayload,
          payloadHash,
          status: "PROPOSED",
          verificationCriteria: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { mode: "RECOVERY" }
      );

      expect(decision.policyDecision).toBe("BLOCKED");
      expect(decision.reasonCode).toBe("REHEARSAL_TOOL_IN_RECOVERY");
      expect(decision.matchedRule).toBe("RULE_TOOL_REGISTRY_CHECK");
    });
  });

  describe("Independent Verifier Integrity", () => {
    it("should return overallStatus FAIL if any probe fails even when other probes pass", async () => {
      const verifier = new IndependentVerifier();
      const inc = incidentRepository.createIncident({
        title: "Verifier Probe Integrity Test",
        targetService: "checkout-service",
        environment: "LOCAL",
      });

      const mockAdapter: any = {
        environment: "LOCAL",
        getServiceHealth: async () => ({ status: "healthy", httpStatus: 200, reachable: true }),
        runSyntheticCheckout: async () => ({
          success: false,
          httpStatus: 500,
          error: "Synthetic transaction failed: schema lock contention",
        }),
      };

      const criteria: SuccessCriterion[] = [
        {
          probeType: "REPLICA_HEALTH",
          targetResource: "checkout-api-1",
          expected: "200",
          description: "Replica 1 health endpoint",
        },
        {
          probeType: "SYNTHETIC_ORDER",
          targetResource: "checkout-api-ingress",
          expected: "200",
          description: "Synthetic order execution probe",
        },
      ];

      const result = await verifier.verifyStep({
        incidentId: inc.id,
        contractStepId: "STEP_VERIFY_COMBINED",
        successCriteria: criteria,
        adapter: mockAdapter,
      });

      expect(result.overallStatus).toBe("FAIL");
      expect(result.negativeEvidenceDetected).toBe(true);
      expect(result.details.some((d) => d.status === "PASS")).toBe(true);
      expect(result.details.some((d) => d.status === "FAIL")).toBe(true);
    });
  });

  describe("Epistemic Abstention Guarantee (Zero Mutations)", () => {
    it("should abstain and dispatch ZERO mutations when diagnostic confidence is below 0.70", async () => {
      const orchestrator = new RecoveryOrchestrator();
      const incident = incidentRepository.createIncident({
        title: "Ambiguous Failure Test",
        targetService: "checkout-service",
        environment: "LOCAL",
      });

      incidentRepository.updateIncident(incident.id, {
        activeContractId: "contract_checkout_recovery_v1",
        currentStepId: "STEP_4_RESTART_REPLICA", // Target the mutation step directly
      });

      const beforeExecutionCount = getControlPlaneDb()
        .prepare("SELECT COUNT(*) as cnt FROM tool_executions WHERE incident_id = ?")
        .get(incident.id) as any;

      const result = await orchestrator.executeNextStep(incident.id, undefined, {
        confidenceScore: 0.52, // Below 0.70 threshold
      });

      expect(result.status).toBe("ABSTAINED");

      const updatedIncident = incidentRepository.getIncident(incident.id);
      expect(updatedIncident?.status).toBe("ABSTAINED");

      const afterExecutionCount = getControlPlaneDb()
        .prepare("SELECT COUNT(*) as cnt FROM tool_executions WHERE incident_id = ?")
        .get(incident.id) as any;

      // Zero mutations dispatched
      expect(afterExecutionCount.cnt).toBe(beforeExecutionCount.cnt);
    });
  });
});

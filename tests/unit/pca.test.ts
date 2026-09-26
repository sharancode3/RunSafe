import { describe, it, expect, beforeEach } from "vitest";
import {
  buildProofCarryingAction,
  computeActionFingerprint,
  verifyActionFingerprint,
  ActionRepository,
  type ProofCarryingAction,
} from "@runsafe/actions";
import type { RecoveryContractStep } from "@runsafe/runbooks";

describe("Proof-Carrying Actions (PCA)", () => {
  let repository: ActionRepository;

  beforeEach(() => {
    repository = new ActionRepository();
  });

  const mockContractStep: RecoveryContractStep = {
    id: "step_canary_rollback",
    title: "Rollback Canary Replica",
    description: "Rolls back checkout-api-2 to v1.0.0 after bad deploy",
    toolName: "rollback_canary",
    defaultArguments: {
      serviceId: "checkout-service",
      replicaId: "checkout-api-2",
      targetVersion: "v1.0.0",
    },
    targetResource: "checkout-api-2",
    riskLevel: "HIGH_RISK",
    isReversible: true,
    rollbackStepId: "step_verify_recovery",
    requiresApproval: true,
    preconditions: [
      {
        id: "pre_replica2_unhealthy",
        description: "Replica 2 must be unhealthy",
        evidenceType: "REPLICA_STATE",
        assertion: "STATUS_DEGRADED",
      },
    ],
    successCriteria: [
      {
        probeType: "REPLICA_HEALTH",
        targetResource: "checkout-api-2",
        expected: "healthy",
        description: "Replica 2 returns 200 OK",
      },
    ],
    evidenceRequirements: [
      {
        evidenceType: "REPLICA_STATE",
        minFreshnessSeconds: 120,
        mandatory: true,
      },
    ],
    onSuccess: "step_verify_recovery",
    onFailure: "ESCALATED",
  };

  it("should build a valid Proof-Carrying Action with authoritative risk enrichment", () => {
    const pca = buildProofCarryingAction(
      {
        incidentId: "inc_hero_001",
        contractId: "contract_checkout_v1",
        stepId: "step_canary_rollback",
        toolName: "rollback_canary",
        toolArguments: {
          serviceId: "checkout-service",
          replicaId: "checkout-api-2",
          targetVersion: "v1.0.0",
        },
        justificationSummary: "Rollback replica 2 because v2.0.0 caused database lock",
        confidenceScore: 0.95,
        supportingEvidenceIds: ["ev_replica_2_unhealthy"],
      },
      mockContractStep
    );

    expect(pca.id).toMatch(/^pca_/);
    expect(pca.riskTier).toBe("HIGH_RISK"); // Authoritative from TOOL_REGISTRY
    expect(pca.blastRadius).toBe("CONTAINER");
    expect(pca.isReversible).toBe(true);
    expect(pca.payloadHash).toBeDefined();
    expect(pca.status).toBe("PROPOSED");
    expect(pca.rollbackProcedure).toContain("step_verify_recovery");
  });

  it("should prevent risk tier downgrades by the model", () => {
    // Model attempts to call rollback_canary but claims it's low risk
    const pca = buildProofCarryingAction(
      {
        incidentId: "inc_002",
        contractId: "contract_checkout_v1",
        stepId: "step_canary_rollback",
        toolName: "rollback_canary",
        toolArguments: { replicaId: "checkout-api-2" },
        justificationSummary: "Trying to claim rollback is low risk",
        confidenceScore: 0.8,
        supportingEvidenceIds: ["ev_1"],
      },
      mockContractStep
    );

    // TOOL_REGISTRY dictates rollback_canary is HIGH_RISK
    expect(pca.riskTier).toBe("HIGH_RISK");
  });

  it("should compute deterministic SHA-256 fingerprints unaffected by object key order", () => {
    const hash1 = computeActionFingerprint({
      incidentId: "inc_001",
      contractId: "c_001",
      stepId: "s_001",
      toolName: "restart_service",
      toolArguments: { a: 1, b: 2, c: { x: "foo", y: "bar" } },
      riskTier: "LOW_RISK_REVERSIBLE",
      blastRadius: "CONTAINER",
    });

    const hash2 = computeActionFingerprint({
      incidentId: "inc_001",
      contractId: "c_001",
      stepId: "s_001",
      toolName: "restart_service",
      toolArguments: { c: { y: "bar", x: "foo" }, b: 2, a: 1 },
      riskTier: "LOW_RISK_REVERSIBLE",
      blastRadius: "CONTAINER",
    });

    expect(hash1).toBe(hash2);
  });

  it("should produce a different fingerprint if arguments, target, or tools are altered", () => {
    const baseHash = computeActionFingerprint({
      incidentId: "inc_001",
      contractId: "c_001",
      stepId: "s_001",
      toolName: "restart_service",
      toolArguments: { target: "checkout-api-1" },
      riskTier: "LOW_RISK_REVERSIBLE",
      blastRadius: "CONTAINER",
    });

    const modifiedTargetHash = computeActionFingerprint({
      incidentId: "inc_001",
      contractId: "c_001",
      stepId: "s_001",
      toolName: "restart_service",
      toolArguments: { target: "checkout-api-2" }, // Different target!
      riskTier: "LOW_RISK_REVERSIBLE",
      blastRadius: "CONTAINER",
    });

    expect(baseHash).not.toBe(modifiedTargetHash);
  });

  it("should verify fingerprint integrity and detect tampering", () => {
    const pca = buildProofCarryingAction(
      {
        incidentId: "inc_003",
        contractId: "c_001",
        stepId: "s_001",
        toolName: "restart_service",
        toolArguments: { target: "checkout-api-1" },
        justificationSummary: "Restarting crashed container",
        confidenceScore: 0.99,
        supportingEvidenceIds: ["ev_crash_01"],
      }
    );

    // Valid check
    expect(verifyActionFingerprint(pca, pca.payloadHash)).toBe(true);

    // Tampered payload argument
    const tampered = { ...pca, toolArguments: { target: "production-database" } };
    expect(verifyActionFingerprint(tampered, pca.payloadHash)).toBe(false);
  });

  it("should persist and retrieve actions from SQLite repository", () => {
    const pca = buildProofCarryingAction(
      {
        incidentId: "inc_repo_test",
        contractId: "c_repo_001",
        stepId: "s_001",
        toolName: "restart_service",
        toolArguments: { target: "checkout-api-1" },
        justificationSummary: "Test persistence",
        confidenceScore: 0.92,
        supportingEvidenceIds: ["ev_100"],
      }
    );

    repository.saveAction(pca);
    const retrieved = repository.getActionById(pca.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(pca.id);
    expect(retrieved?.payloadHash).toBe(pca.payloadHash);
    expect(retrieved?.riskTier).toBe(pca.riskTier);
    expect(retrieved?.status).toBe("PROPOSED");
  });

  it("should atomically update status and prevent invalid transitions", () => {
    const pca = buildProofCarryingAction(
      {
        incidentId: "inc_atomic_test",
        contractId: "c_repo_002",
        stepId: "s_002",
        toolName: "restart_service",
        toolArguments: { target: "checkout-api-1" },
        justificationSummary: "Test atomic transition",
        confidenceScore: 0.92,
        supportingEvidenceIds: ["ev_101"],
      }
    );

    repository.saveAction(pca);

    // Transition from PROPOSED to EVALUATED with check
    const success1 = repository.updateActionStatus(pca.id, "EVALUATED", "PROPOSED");
    expect(success1).toBe(true);

    // Attempt invalid transition expecting PROPOSED when current is EVALUATED
    const failedTransition = repository.updateActionStatus(pca.id, "EXECUTING", "PROPOSED");
    expect(failedTransition).toBe(false);

    // Valid transition from EVALUATED to EXECUTING
    const success2 = repository.updateActionStatus(pca.id, "EXECUTING", "EVALUATED");
    expect(success2).toBe(true);

    const updated = repository.getActionById(pca.id);
    expect(updated?.status).toBe("EXECUTING");
  });
});

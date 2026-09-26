import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { buildApp } from "../../apps/control-plane/src/app.js";
import { type FastifyInstance } from "fastify";
import { RunbookRepository, type RecoveryContract } from "@runsafe/runbooks";
import { normalizeToolOutputToEvidence, evidenceRepository } from "@runsafe/evidence";

describe("Control Plane Action Endpoints (Fastify)", () => {
  let app: FastifyInstance;
  let runbookRepo: RunbookRepository;
  let activeContract: RecoveryContract;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    runbookRepo = new RunbookRepository();

    const contractId = "contract_cp_action_test";
    runbookRepo.createRunbook({
      id: "rb_cp_test",
      name: "Control Plane Action Test",
      targetService: "checkout-service",
    });
    runbookRepo.createVersion({
      id: "ver_cp_001",
      runbookId: "rb_cp_test",
      version: "1.0.0",
      markdownSource: "# CP Runbook",
      contractId,
      compilationStatus: "COMPILED",
    });

    activeContract = {
      id: contractId,
      runbookId: "rb_cp_test",
      runbookVersionId: "ver_cp_001",
      targetService: "checkout-service",
      schemaVersion: "1.0.0",
      contractVersion: "v1.0.0",
      title: "CP Action Contract",
      description: "Contract for testing control plane routes",
      entryStepId: "step_auto_restart",
      steps: [
        {
          id: "step_auto_restart",
          title: "Autonomous Restart",
          description: "Restart checkout replica 1",
          toolName: "restart_service",
          defaultArguments: { target: "checkout-api-1" },
          targetResource: "checkout-api-1",
          riskLevel: "LOW_RISK_REVERSIBLE",
          isReversible: true,
          requiresApproval: false,
          preconditions: [
            {
              id: "pre_deg",
              description: "Degraded status",
              evidenceType: "SERVICE_HEALTH",
              assertion: "STATUS_DEGRADED",
            },
          ],
          successCriteria: [],
          evidenceRequirements: [
            { evidenceType: "SERVICE_HEALTH", minFreshnessSeconds: 120, mandatory: true },
          ],
          onSuccess: "RESOLVED",
          onFailure: "ESCALATED",
        },
        {
          id: "step_high_risk_rollback",
          title: "Canary Rollback Checkpoint",
          description: "Rollback canary replica 2",
          toolName: "rollback_canary",
          defaultArguments: { replicaId: "checkout-api-2", targetVersion: "v1.0.0" },
          targetResource: "checkout-api-2",
          riskLevel: "HIGH_RISK",
          isReversible: true,
          requiresApproval: true,
          preconditions: [
            {
              id: "pre_lock",
              description: "Schema lock in logs",
              evidenceType: "RECENT_LOGS",
              assertion: "SCHEMA_LOCK_DETECTED",
            },
          ],
          successCriteria: [],
          evidenceRequirements: [
            { evidenceType: "RECENT_LOGS", minFreshnessSeconds: 120, mandatory: true },
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

  beforeEach(() => {
    runbookRepo.activateContract(activeContract.id);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should propose a new Proof-Carrying Action via POST /api/v1/actions/propose", async () => {
    const ev = normalizeToolOutputToEvidence(
      "get_service_health",
      { status: "degraded", replicas: [{ name: "checkout-api-1", status: "unhealthy" }] },
      { environment: "LOCAL", targetResource: "checkout-service" }
    );
    evidenceRepository.saveEvidence(ev);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/actions/propose",
      payload: {
        incidentId: "inc_route_001",
        contractId: activeContract.id,
        stepId: "step_auto_restart",
        toolName: "restart_service",
        toolArguments: { target: "checkout-api-1" },
        justificationSummary: "Propose restart for replica 1",
        confidenceScore: 0.95,
        supportingEvidenceIds: [ev.id],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.data.id).toMatch(/^pca_/);
    expect(body.data.status).toBe("PROPOSED");
    expect(body.data.riskTier).toBe("LOW_RISK_REVERSIBLE");
    expect(body.data.payloadHash).toBeDefined();
  });

  it("should evaluate an action via POST /api/v1/actions/:id/evaluate", async () => {
    const ev = normalizeToolOutputToEvidence(
      "get_recent_logs",
      { lines: ["exclusive lock timeout on relation orders"] },
      { environment: "LOCAL", targetResource: "checkout-api-2" }
    );
    evidenceRepository.saveEvidence(ev);

    // Propose
    const proposeRes = await app.inject({
      method: "POST",
      url: "/api/v1/actions/propose",
      payload: {
        incidentId: "inc_route_002",
        contractId: activeContract.id,
        stepId: "step_high_risk_rollback",
        toolName: "rollback_canary",
        toolArguments: { replicaId: "checkout-api-2", targetVersion: "v1.0.0" },
        justificationSummary: "Rollback canary replica 2 due to lock",
        confidenceScore: 0.98,
        supportingEvidenceIds: [ev.id],
      },
    });
    const pca = proposeRes.json().data;

    // Evaluate
    const evalRes = await app.inject({
      method: "POST",
      url: `/api/v1/actions/${pca.id}/evaluate`,
    });

    expect(evalRes.statusCode).toBe(200);
    const evalBody = evalRes.json().data;
    expect(evalBody.decision.policyDecision).toBe("APPROVAL_REQUIRED");
    expect(evalBody.approvalRequest).toBeDefined();
    expect(evalBody.approvalRequest.status).toBe("PENDING");
    expect(evalBody.approvalRequest.payloadHash).toBe(pca.payloadHash);
  });

  it("should get action details via GET /api/v1/actions/:id", async () => {
    const ev = normalizeToolOutputToEvidence(
      "get_service_health",
      { status: "degraded", replicas: [{ name: "checkout-api-1", status: "unhealthy" }] },
      { environment: "LOCAL", targetResource: "checkout-service" }
    );
    evidenceRepository.saveEvidence(ev);

    const proposeRes = await app.inject({
      method: "POST",
      url: "/api/v1/actions/propose",
      payload: {
        incidentId: "inc_route_003",
        contractId: activeContract.id,
        stepId: "step_auto_restart",
        toolName: "restart_service",
        toolArguments: { target: "checkout-api-1" },
        justificationSummary: "Testing GET endpoint",
        confidenceScore: 0.9,
        supportingEvidenceIds: [ev.id],
      },
    });
    const pca = proposeRes.json().data;

    await app.inject({
      method: "POST",
      url: `/api/v1/actions/${pca.id}/evaluate`,
    });

    const getRes = await app.inject({
      method: "GET",
      url: `/api/v1/actions/${pca.id}`,
    });

    expect(getRes.statusCode).toBe(200);
    const body = getRes.json().data;
    expect(body.action.id).toBe(pca.id);
    expect(body.decision).toBeDefined();
    expect(body.decision.policyDecision).toBe("AUTO_ALLOW");
  });

  it("should handle approval with fingerprint check via POST /api/v1/actions/:id/approval", async () => {
    const ev = normalizeToolOutputToEvidence(
      "get_recent_logs",
      { lines: ["exclusive lock timeout on relation orders"] },
      { environment: "LOCAL", targetResource: "checkout-api-2" }
    );
    evidenceRepository.saveEvidence(ev);

    const proposeRes = await app.inject({
      method: "POST",
      url: "/api/v1/actions/propose",
      payload: {
        incidentId: "inc_route_004",
        contractId: activeContract.id,
        stepId: "step_high_risk_rollback",
        toolName: "rollback_canary",
        toolArguments: { replicaId: "checkout-api-2", targetVersion: "v1.0.0" },
        justificationSummary: "Approval route test",
        confidenceScore: 0.98,
        supportingEvidenceIds: [ev.id],
      },
    });
    const pca = proposeRes.json().data;

    // Evaluate to create approval request
    await app.inject({
      method: "POST",
      url: `/api/v1/actions/${pca.id}/evaluate`,
    });

    // Attempt approval with wrong fingerprint
    const wrongRes = await app.inject({
      method: "POST",
      url: `/api/v1/actions/${pca.id}/approval`,
      payload: {
        decision: "APPROVE",
        operatorId: "lead-sre-bob",
        payloadHash: "fake_hash_12345",
      },
    });
    expect(wrongRes.statusCode).toBe(422);

    // Approve with correct fingerprint
    const validRes = await app.inject({
      method: "POST",
      url: `/api/v1/actions/${pca.id}/approval`,
      payload: {
        decision: "APPROVE",
        operatorId: "lead-sre-bob",
        payloadHash: pca.payloadHash,
        operatorNote: "Approved rollback for replica 2",
      },
    });
    expect(validRes.statusCode).toBe(200);
    expect(validRes.json().data.action.status).toBe("APPROVED");
    expect(validRes.json().data.approval.status).toBe("APPROVED");
  });

  it("should execute action and prevent duplicate execution via POST /api/v1/actions/:id/execute", async () => {
    const ev = normalizeToolOutputToEvidence(
      "get_service_health",
      { status: "degraded", replicas: [{ name: "checkout-api-1", status: "unhealthy" }] },
      { environment: "LOCAL", targetResource: "checkout-service" }
    );
    evidenceRepository.saveEvidence(ev);

    const proposeRes = await app.inject({
      method: "POST",
      url: "/api/v1/actions/propose",
      payload: {
        incidentId: "inc_route_005",
        contractId: activeContract.id,
        stepId: "step_auto_restart",
        toolName: "restart_service",
        toolArguments: { target: "checkout-api-1" },
        justificationSummary: "Execution route test",
        confidenceScore: 0.95,
        supportingEvidenceIds: [ev.id],
      },
    });
    const pca = proposeRes.json().data;

    // Evaluate to auto-allow
    await app.inject({
      method: "POST",
      url: `/api/v1/actions/${pca.id}/evaluate`,
    });

    // Execute first time
    const execRes1 = await app.inject({
      method: "POST",
      url: `/api/v1/actions/${pca.id}/execute`,
    });
    expect(execRes1.statusCode).toBe(200);
    expect(execRes1.json().data.executed).toBe(true);
    expect(execRes1.json().data.action.status).toBe("EXECUTED");

    // Execute second time (must fail with 409 Conflict due to atomic claim guard!)
    const execRes2 = await app.inject({
      method: "POST",
      url: `/api/v1/actions/${pca.id}/execute`,
    });
    expect(execRes2.statusCode).toBe(409);
    expect(execRes2.json().error.message).toContain("DUPLICATE_EXECUTION_BLOCKED");
  });
});

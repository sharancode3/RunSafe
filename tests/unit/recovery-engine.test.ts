import { describe, it, expect, beforeEach } from "vitest";
import {
  incidentRepository,
  recoveryOrchestrator,
  type IncidentRecord,
} from "@runsafe/recovery-engine";
import { runbookRepository, compileRunbook } from "@runsafe/runbooks";
import { evidenceRepository } from "@runsafe/evidence";
import { getControlPlaneDb } from "@runsafe/shared";
import type { InfrastructureAdapter } from "@runsafe/infrastructure-adapter";
import fs from "fs";
import path from "path";

describe("Recovery Engine & Orchestrator (@runsafe/recovery-engine)", () => {
  let contractId: string;

  const mockAdapter: InfrastructureAdapter = {
    provider: "MOCK",
    environment: "LOCAL",
    getServiceHealth: async (serviceId: string) => ({
      reachable: true,
      httpStatus: 200,
      status: "degraded",
      replicas: [{ id: "checkout-api-1", status: "unhealthy" }],
    }),
    getRecentLogs: async () => [
      { timestamp: new Date().toISOString(), message: "Error 500: Database schema lock detected" },
    ],
    getMetrics: async () => ({ requestsTotal: 250, errorRate: 0, avgLatencyMs: 15 }),
    getDatabaseHealth: async () => ({
      database: "checkout_db",
      reachable: true,
      querySucceeded: true,
      latencyMs: 12,
      status: "healthy",
    }),
    getDeploymentState: async () => ({
      replicas: [{ replicaId: "checkout-api-2", version: "v2.0.0", faultProfile: "schema_lock" }],
    }),
    getReplicaState: async (replicaId: string) => ({
      exists: true,
      running: true,
      reachable: true,
      faultProfile: replicaId === "checkout-api-2" ? "none" : "none",
    }),
    getDependencies: async () => ({}),
    runSyntheticCheckout: async () => ({
      success: true,
      httpStatus: 200,
      orderId: "ord-mock-recovered",
      durationMs: 35,
    }),
    restartService: async () => ({
      technicalStatus: "RESTARTED_HEALTHY",
      operationId: "op-restart-1",
    }),
    rollbackCanary: async () => ({
      technicalStatus: "ROLLED_BACK",
      fromVersion: "v2.0.0",
      toVersion: "v1.0.0",
      targetReplica: "checkout-api-2",
      operationId: "op-canary-1",
    }),
    rollbackFull: async () => ({
      technicalStatus: "FULL_ROLLBACK_COMPLETED",
      affectedReplicas: ["checkout-api-1", "checkout-api-2"],
      targetVersion: "v1.0.0",
      operationId: "op-full-1",
    }),
    injectProcessCrash: async () => ({}),
    injectBadDeployment: async () => ({}),
    injectAmbiguousFailure: async () => ({}),
    resetEnvironment: async () => ({}),
  };

  beforeEach(async () => {
    // Compile and activate canonical runbook
    const runbookPath = path.join(process.cwd(), "runbooks", "checkout_recovery_runbook.md");
    const markdown = fs.readFileSync(runbookPath, "utf-8");
    const compiled = await compileRunbook(markdown, {
      runbookId: "rb_checkout_recovery",
      version: "v1.0.0",
      targetService: "checkout-service",
    });
    const contract = compiled.contract!;
    runbookRepository.activateContract(contract.id);
    contractId = contract.id;
  });

  it("should create incident in DETECTED state and record event", () => {
    const inc = incidentRepository.createIncident({
      title: "Elevated 500 error rate on checkout fleet",
      targetService: "checkout-service",
      activeContractId: contractId,
    });

    expect(inc.id).toBeDefined();
    expect(inc.status).toBe("DETECTED");
    expect(inc.target_service).toBe("checkout-service");

    const events = incidentRepository.getEvents(inc.id);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].event_type).toBe("INCIDENT_DETECTED");
  });

  it("should execute observation steps automatically and advance to next step", async () => {
    const inc = incidentRepository.createIncident({
      title: "Checkout Latency Anomaly",
      targetService: "checkout-service",
      activeContractId: contractId,
    });

    // Step 1: Ingress Observation
    const step1Result = await recoveryOrchestrator.executeNextStep(inc.id, mockAdapter);
    expect(step1Result.status).toBe("STEP_COMPLETED");
    expect(step1Result.stepId).toBe("STEP_1_OBSERVE_INGRESS");
    expect(step1Result.nextStepId).toBe("STEP_2_OBSERVE_LOGS");

    // Step 2: Logs Observation
    const step2Result = await recoveryOrchestrator.executeNextStep(inc.id, mockAdapter);
    expect(step2Result.status).toBe("STEP_COMPLETED");
    expect(step2Result.stepId).toBe("STEP_2_OBSERVE_LOGS");
    expect(step2Result.nextStepId).toBe("STEP_3_CHECK_DB");

    // Step 3: DB Health Check
    const step3Result = await recoveryOrchestrator.executeNextStep(inc.id, mockAdapter);
    expect(step3Result.status).toBe("STEP_COMPLETED");
    expect(step3Result.stepId).toBe("STEP_3_CHECK_DB");
    expect(step3Result.nextStepId).toBe("STEP_4_RESTART_REPLICA");
  });

  it("should auto-allow reversible restart, but take onFailure branch if verifier fails", async () => {
    // Adapter where restart technically succeeds, but synthetic checkout fails (e.g. bad deploy)
    const failingVerifierAdapter: InfrastructureAdapter = {
      ...mockAdapter,
      runSyntheticCheckout: async () => ({
        success: false,
        httpStatus: 500,
        error: "Schema lock active on checkout-api-2",
        durationMs: 40,
      }),
      restartService: async () => ({
        technicalStatus: "RESTARTED_HEALTHY",
        operationId: "op-restart-2",
      }),
    };

    const inc = incidentRepository.createIncident({
      title: "Hero incident: Bad Deployment Simulation",
      targetService: "checkout-service",
      activeContractId: contractId,
      currentStepId: "STEP_4_RESTART_REPLICA",
    });

    const result = await recoveryOrchestrator.executeNextStep(inc.id, failingVerifierAdapter);

    expect(result.status).toBe("VERIFICATION_FAILED");
    expect(result.stepId).toBe("STEP_4_RESTART_REPLICA");
    expect(result.nextStepId).toBe("STEP_5_ROLLBACK_CANARY");
    expect(result.verifierResult?.overallStatus).toBe("FAIL");

    // Incident remains OPEN and moved to STEP_5_ROLLBACK_CANARY
    const updatedInc = incidentRepository.getIncident(inc.id);
    expect(updatedInc?.current_step_id).toBe("STEP_5_ROLLBACK_CANARY");
    expect(updatedInc?.status).toBe("REMEDIATING");
  });

  it("should pause for human approval on high-risk rollback and resume upon valid signature", async () => {
    const inc = incidentRepository.createIncident({
      title: "Canary Rollback Checkpoint",
      targetService: "checkout-service",
      activeContractId: contractId,
      currentStepId: "STEP_5_ROLLBACK_CANARY",
    });

    // Seed required evidence for canary rollback step
    const now = new Date().toISOString();
    evidenceRepository.saveEvidence({
      id: `ev_logs_${Date.now()}`,
      incidentId: inc.id,
      environment: "LOCAL",
      targetResource: "checkout-service",
      evidenceType: "RECENT_LOGS",
      sourceType: "OBSERVATION_TOOL",
      sourceTool: "get_recent_logs",
      observedAt: now,
      collectedAt: now,
      summary: "Regression confirmed: v2.0.0 image anomaly with exclusive relation lock",
      structuredValue: { errorType: "SCHEMA_LOCK", regression: true },
      freshnessStatus: "FRESH",
      derived: false,
      sourceEvidenceIds: [],
      createdAt: now,
    });
    evidenceRepository.saveEvidence({
      id: `ev_dep_${Date.now()}`,
      incidentId: inc.id,
      environment: "LOCAL",
      targetResource: "checkout-service",
      evidenceType: "DEPLOYMENT_STATE",
      sourceType: "OBSERVATION_TOOL",
      sourceTool: "get_deployment_state",
      observedAt: now,
      collectedAt: now,
      summary: "Deployment state shows checkout-api-2 running v2.0.0",
      structuredValue: { replicas: [{ replicaId: "checkout-api-2", version: "v2.0.0" }] },
      freshnessStatus: "FRESH",
      derived: false,
      sourceEvidenceIds: [],
      createdAt: now,
    });

    // 1. Attempt step 5 -> Must PAUSE for approval
    const pauseResult = await recoveryOrchestrator.executeNextStep(inc.id, mockAdapter);
    expect(pauseResult.status).toBe("PAUSED_FOR_APPROVAL");
    expect(pauseResult.actionId).toBeDefined();
    expect(pauseResult.payloadHash).toBeDefined();

    // Verify event
    const events = incidentRepository.getEvents(inc.id);
    const approvalReq = events.find((e) => e.event_type === "APPROVAL_REQUESTED");
    expect(approvalReq).toBeDefined();

    // 2. Submit approval with matching fingerprint
    const resumeResult = await recoveryOrchestrator.resumeWithApproval(
      inc.id,
      pauseResult.actionId!,
      {
        approvedBy: "alice-sre-lead",
        payloadHash: pauseResult.payloadHash!,
        operatorNote: "Approved canary rollback to v1.0.0 after root cause confirmed",
      },
      mockAdapter
    );

    expect(resumeResult.status).toBe("STEP_COMPLETED");
    expect(resumeResult.stepId).toBe("STEP_5_ROLLBACK_CANARY");
    expect(resumeResult.nextStepId).toBe("STEP_6_ROLLBACK_FULL");

    // 3. Verify event trail includes APPROVAL_GRANTED and ACTION_EXECUTED
    const finalEvents = incidentRepository.getEvents(inc.id);
    expect(finalEvents.some((e) => e.event_type === "APPROVAL_GRANTED")).toBe(true);
    expect(finalEvents.some((e) => e.event_type === "ACTION_EXECUTED")).toBe(true);
  });
});

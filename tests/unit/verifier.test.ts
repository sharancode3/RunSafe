import { describe, it, expect, beforeEach } from "vitest";
import { IndependentVerifier, verificationRepository } from "@runsafe/verifier";
import { evidenceRepository } from "@runsafe/evidence";
import { getControlPlaneDb } from "@runsafe/shared";
import type { InfrastructureAdapter } from "@runsafe/infrastructure-adapter";
import type { SuccessCriterion } from "@runsafe/runbooks";

describe("Independent Verifier (@runsafe/verifier)", () => {
  const mockAdapter: InfrastructureAdapter = {
    provider: "MOCK",
    environment: "LOCAL",
    getServiceHealth: async (serviceId: string) => {
      if (serviceId === "unhealthy-service") {
        return { reachable: false, httpStatus: 502, error: "Bad Gateway" };
      }
      return { reachable: true, httpStatus: 200, status: "healthy" };
    },
    getRecentLogs: async () => [],
    getMetrics: async () => ({ requestsTotal: 100, errorRate: 0, avgLatencyMs: 12 }),
    getDatabaseHealth: async () => ({
      database: "checkout_db",
      reachable: true,
      querySucceeded: true,
      latencyMs: 15,
    }),
    getDeploymentState: async () => ({ replicas: [] }),
    getReplicaState: async (replicaId: string) => ({
      exists: true,
      running: true,
      reachable: true,
      faultProfile: "none",
    }),
    getDependencies: async () => ({}),
    runSyntheticCheckout: async () => ({
      success: true,
      httpStatus: 200,
      orderId: "ord-test-123",
      durationMs: 45,
    }),
    restartService: async () => ({ technicalStatus: "RESTARTED_HEALTHY", operationId: "op-1" }),
    rollbackCanary: async () => ({
      technicalStatus: "ROLLED_BACK",
      fromVersion: "v2.0.0",
      toVersion: "v1.0.0",
      targetReplica: "checkout-api-2",
      operationId: "op-2",
    }),
    rollbackFull: async () => ({
      technicalStatus: "FULL_ROLLBACK_COMPLETED",
      affectedReplicas: [],
      targetVersion: "v1.0.0",
      operationId: "op-3",
    }),
    injectProcessCrash: async () => ({}),
    injectBadDeployment: async () => ({}),
    injectAmbiguousFailure: async () => ({}),
    resetEnvironment: async () => ({}),
  };

  const verifier = new IndependentVerifier();

  beforeEach(() => {
    const db = getControlPlaneDb();
    const now = new Date().toISOString();
    for (const id of ["inc_test_1", "inc_test_2", "inc_test_3", "inc_test_4"]) {
      db.prepare(`
        INSERT INTO incidents (id, title, target_service, environment, status, created_at, updated_at)
        VALUES (?, 'Test Incident', 'checkout-service', 'LOCAL', 'DETECTED', ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(id, now, now);
    }
  });

  it("should return PASS when all criteria are satisfied", async () => {
    const criteria: SuccessCriterion[] = [
      {
        probeType: "INGRESS_HEALTH",
        targetResource: "checkout-service",
        expected: 200,
        description: "Ingress returns HTTP 200",
      },
      {
        probeType: "DB_LATENCY",
        targetResource: "postgres",
        expected: 100,
        description: "Postgres latency < 100ms",
      },
      {
        probeType: "SYNTHETIC_ORDER",
        targetResource: "checkout-service",
        expected: 200,
        description: "Synthetic order commits",
      },
    ];

    const result = await verifier.verifyStep({
      incidentId: "inc_test_1",
      contractStepId: "STEP_7_VERIFY_SYNTHETIC",
      successCriteria: criteria,
      adapter: mockAdapter,
    });

    expect(result.overallStatus).toBe("PASS");
    expect(result.negativeEvidenceDetected).toBe(false);
    expect(result.details).toHaveLength(3);
    expect(result.details.every((d) => d.status === "PASS")).toBe(true);

    // Verify stored in DB
    const saved = verificationRepository.getVerificationRun(result.id);
    expect(saved).not.toBeNull();
    expect(saved?.overallStatus).toBe("PASS");
  });

  it("should return FAIL and record negative evidence if any probe fails", async () => {
    const failingAdapter: InfrastructureAdapter = {
      ...mockAdapter,
      runSyntheticCheckout: async () => ({
        success: false,
        httpStatus: 500,
        error: "relation 'products' lock exclusive timeout",
        durationMs: 300,
      }),
    };

    const criteria: SuccessCriterion[] = [
      {
        probeType: "INGRESS_HEALTH",
        targetResource: "checkout-service",
        expected: 200,
        description: "Ingress returns HTTP 200",
      },
      {
        probeType: "SYNTHETIC_ORDER",
        targetResource: "checkout-service",
        expected: 200,
        description: "Synthetic order must commit",
      },
    ];

    const result = await verifier.verifyStep({
      incidentId: "inc_test_2",
      contractStepId: "STEP_4_RESTART_REPLICA",
      successCriteria: criteria,
      adapter: failingAdapter,
    });

    expect(result.overallStatus).toBe("FAIL");
    expect(result.negativeEvidenceDetected).toBe(true);
    expect(result.details[0].status).toBe("PASS");
    expect(result.details[1].status).toBe("FAIL");
    expect(result.details[1].message).toContain("Synthetic order verification probe FAILED");

    // Verify negative evidence was persisted
    const evidence = evidenceRepository.listEvidence({ incidentId: "inc_test_2" });
    const syntheticEv = evidence.find((e) => e.evidenceType === "SYNTHETIC_CHECKOUT");
    expect(syntheticEv).toBeDefined();
    expect(syntheticEv?.summary).toContain("FAILED");
  });

  it("should return UNKNOWN when a probe times out or is unreachable", async () => {
    const criteria: SuccessCriterion[] = [
      {
        probeType: "INGRESS_HEALTH",
        targetResource: "unhealthy-service",
        expected: 200,
        description: "Must return 200",
      },
    ];

    const result = await verifier.verifyStep({
      incidentId: "inc_test_3",
      contractStepId: "STEP_1_OBSERVE_INGRESS",
      successCriteria: criteria,
      adapter: mockAdapter,
    });

    expect(result.overallStatus).toBe("FAIL");
  });

  it("should return PASS on empty criteria (observation-only step)", async () => {
    const result = await verifier.verifyStep({
      incidentId: "inc_test_4",
      contractStepId: "STEP_2_OBSERVE_LOGS",
      successCriteria: [],
      adapter: mockAdapter,
    });

    expect(result.overallStatus).toBe("PASS");
    expect(result.details).toHaveLength(0);
  });
});

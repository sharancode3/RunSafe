import { describe, it, expect, beforeEach } from "vitest";
import {
  rehearsalRepository,
  type RehearsalRunRecord,
} from "@runsafe/recovery-engine";

describe("Runbook CI Rehearsals Repository & Schemas", () => {
  it("should have seeded 3 default rehearsal scenarios", () => {
    const scenarios = rehearsalRepository.getScenarios();
    expect(scenarios.length).toBeGreaterThanOrEqual(3);

    const ids = scenarios.map((s) => s.id);
    expect(ids).toContain("scenario_crash");
    expect(ids).toContain("scenario_bad_deployment");
    expect(ids).toContain("scenario_ambiguous");

    const crash = rehearsalRepository.getScenarioById("scenario_crash");
    expect(crash).toBeDefined();
    expect(crash?.faultType).toBe("PROCESS_CRASH");
    expect(crash?.expectedRecoveryTool).toBe("restart_service");

    const ambiguous = rehearsalRepository.getScenarioById("scenario_ambiguous");
    expect(ambiguous).toBeDefined();
    expect(ambiguous?.faultType).toBe("AMBIGUOUS_LATENCY");
  });

  it("should save and retrieve rehearsal run records with outcome and duration", () => {
    const runId = `test_run_${Date.now()}`;
    const testRecord: RehearsalRunRecord = {
      id: runId,
      scenarioId: "scenario_crash",
      contractId: "contract_checkout_recovery_v1",
      incidentId: "inc_test_123",
      targetEnvironment: "LOCAL",
      outcome: "PASS",
      durationMs: 4200,
      details: {
        baseline: "OK",
        stepsAttempted: 4,
        verifier: "PASS",
      },
      executedAt: new Date().toISOString(),
    };

    rehearsalRepository.saveRehearsalRun(testRecord);

    const retrieved = rehearsalRepository.getRehearsalRun(runId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(runId);
    expect(retrieved?.scenarioId).toBe("scenario_crash");
    expect(retrieved?.outcome).toBe("PASS");
    expect(retrieved?.durationMs).toBe(4200);
    expect(retrieved?.details).toHaveProperty("verifier", "PASS");

    const list = rehearsalRepository.listRehearsalRuns(10);
    expect(list.some((r) => r.id === runId)).toBe(true);
  });
});

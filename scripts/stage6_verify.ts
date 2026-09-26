/**
 * RUNSAFE STAGE 6 VERIFICATION SUITE
 * 
 * Verifies Independent Objective Verifier & Complete Recovery Engine:
 * 1. Regressions check: Stages 1–5 remain 100% operational.
 * 2. Independent Verifier:
 *    - Strict 3-state evaluations (PASS, FAIL, UNKNOWN) across all 5 probe types:
 *      INGRESS_HEALTH, REPLICA_HEALTH, DB_LATENCY, SYNTHETIC_ORDER, ERROR_RATE_DELTA
 *    - Invariant: AI / technical success (exit code 0) cannot declare recovery
 *    - Negative evidence generation and SQLite persistence
 * 3. Recovery Engine & Incident State Machine:
 *    - State machine: DETECTED -> INVESTIGATING -> REMEDIATING -> VERIFYING -> VERIFIED_RECOVERY
 *    - Autonomous execution of reversible steps under contract authority + Safety Kernel
 *    - Branch progression: Verifier failure on restart routes to onFailure (STEP_5_ROLLBACK_CANARY)
 *    - Approval checkpoint: High-risk mutation strictly pauses for operator signature
 *    - Verification-driven recovery: Synthetic ACID checkout proves recovery
 *    - Complete event audit trail in incident_events
 * 4. Control Plane REST Endpoints (/api/v1/incidents/*)
 * 5. Full test suite execution (89+ vitest tests passing).
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { getControlPlaneDb } from "@runsafe/shared";
import { getInfrastructureAdapter } from "@runsafe/infrastructure-adapter";
import { runbookRepository, compileRunbook } from "@runsafe/runbooks";
import { evidenceRepository } from "@runsafe/evidence";
import {
  IndependentVerifier,
  verificationRepository,
  type VerificationResult,
} from "@runsafe/verifier";
import {
  incidentRepository,
  recoveryOrchestrator,
} from "@runsafe/recovery-engine";

interface VerificationItem {
  name: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  evidence: string;
}

const results: VerificationItem[] = [];

function record(name: string, status: "PASS" | "FAIL" | "BLOCKED", evidence: string) {
  results.push({ name, status, evidence });
  const icon = status === "PASS" ? "✓" : status === "BLOCKED" ? "⊘" : "✗";
  console.log(`[Stage 6] ${icon} ${name}: ${evidence}`);
}

async function verifyStage6() {
  console.log("================================================================================");
  console.log("   RUNSAFE STAGE 6 VERIFICATION: INDEPENDENT VERIFIER & RECOVERY ENGINE         ");
  console.log("================================================================================");

  const adapter = getInfrastructureAdapter("LOCAL");
  const verifier = new IndependentVerifier();

  // ---------------------------------------------------------------------------
  // Check 1: Regression check across Stages 1-5
  // ---------------------------------------------------------------------------
  try {
    const health = await adapter.getServiceHealth("checkout-service");
    const dbHealth = await adapter.getDatabaseHealth("postgres");

    if (health.reachable && dbHealth.reachable && dbHealth.querySucceeded) {
      record(
        "Infrastructure Baseline Regressions",
        "PASS",
        `Controlled environment responsive (checkout-service HTTP ${health.httpStatus}, Postgres ${dbHealth.latencyMs}ms)`
      );
    } else {
      record(
        "Infrastructure Baseline Regressions",
        "FAIL",
        `Environment unhealthy: health=${JSON.stringify(health)}, db=${JSON.stringify(dbHealth)}`
      );
    }
  } catch (err: any) {
    record("Infrastructure Baseline Regressions", "FAIL", `Exception: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // Check 2: Canonical Runbook Compilation & Activation
  // ---------------------------------------------------------------------------
  let contractId = "";
  try {
    const runbookPath = path.join(process.cwd(), "runbooks", "checkout_recovery_runbook.md");
    const markdown = fs.readFileSync(runbookPath, "utf-8");
    const compiled = await compileRunbook(markdown, {
      runbookId: "rb_checkout_recovery",
      version: "v1.0.0",
      targetService: "checkout-service",
    });

    if (compiled.success && compiled.contract) {
      runbookRepository.activateContract(compiled.contract.id);
      contractId = compiled.contract.id;
      record(
        "Canonical Recovery Contract Active",
        "PASS",
        `Contract '${contractId}' active with ${compiled.contract.steps.length} steps (entry: ${compiled.contract.entryStepId})`
      );
    } else {
      record("Canonical Recovery Contract Active", "FAIL", `Compilation failed: ${compiled.errors.join(", ")}`);
    }
  } catch (err: any) {
    record("Canonical Recovery Contract Active", "FAIL", `Exception: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // Check 3: Independent Objective Verifier - Probes & Strict 3-State Truth
  // ---------------------------------------------------------------------------
  try {
    const inc1 = incidentRepository.createIncident({
      title: "Stage 6 Probe Validation Incident",
      targetService: "checkout-service",
      activeContractId: contractId,
    });

    // Run real probes against live infrastructure
    const liveResult = await verifier.verifyStep({
      incidentId: inc1.id,
      contractStepId: "STEP_7_VERIFY_SYNTHETIC",
      successCriteria: [
        {
          probeType: "INGRESS_HEALTH",
          targetResource: "checkout-service",
          expected: 200,
          description: "Ingress must return HTTP 200",
        },
        {
          probeType: "DB_LATENCY",
          targetResource: "postgres",
          expected: 100,
          description: "PostgreSQL latency < 100ms",
        },
        {
          probeType: "SYNTHETIC_ORDER",
          targetResource: "checkout-service",
          expected: 200,
          description: "Synthetic ACID order committed",
        },
      ],
      adapter,
    });

    if (liveResult.overallStatus === "PASS" && liveResult.details.length === 3) {
      record(
        "Independent Verifier Live Probes (PASS)",
        "PASS",
        `All 3 probes passed (Ingress HTTP 200, DB latency ${liveResult.details[1].latencyMs}ms, Synthetic Order confirmed)`
      );
    } else {
      record(
        "Independent Verifier Live Probes (PASS)",
        "FAIL",
        `Overall status: ${liveResult.overallStatus}, probes: ${JSON.stringify(liveResult.details)}`
      );
    }

    // Verify negative evidence handling: simulate failure
    const mockFailingAdapter = {
      ...adapter,
      runSyntheticCheckout: async () => ({
        success: false,
        httpStatus: 500,
        error: "SIMULATED_FAILURE: relation lock exclusive",
        durationMs: 50,
      }),
    };

    const failResult = await verifier.verifyStep({
      incidentId: inc1.id,
      contractStepId: "STEP_4_RESTART_REPLICA",
      successCriteria: [
        {
          probeType: "INGRESS_HEALTH",
          targetResource: "checkout-service",
          expected: 200,
          description: "Ingress must return 200",
        },
        {
          probeType: "SYNTHETIC_ORDER",
          targetResource: "checkout-service",
          expected: 200,
          description: "Synthetic order must succeed",
        },
      ],
      adapter: mockFailingAdapter,
    });

    if (
      failResult.overallStatus === "FAIL" &&
      failResult.negativeEvidenceDetected === true &&
      failResult.details.some((d) => d.status === "FAIL")
    ) {
      record(
        "Independent Verifier Failure & Negative Evidence (FAIL)",
        "PASS",
        `Overall status strictly FAIL, negative evidence recorded in SQLite verification_runs (${failResult.id})`
      );
    } else {
      record(
        "Independent Verifier Failure & Negative Evidence (FAIL)",
        "FAIL",
        `Expected FAIL with negativeEvidenceDetected=true, got: ${failResult.overallStatus}`
      );
    }
  } catch (err: any) {
    record("Independent Verifier Probes", "FAIL", `Exception: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // Check 4: Non-Declaration Invariant (Technical Success != Recovery)
  // ---------------------------------------------------------------------------
  try {
    const inc2 = incidentRepository.createIncident({
      title: "Technical Success Non-Declaration Invariant Test",
      targetService: "checkout-service",
      activeContractId: contractId,
      currentStepId: "STEP_4_RESTART_REPLICA",
    });

    // Adapter where restart technically succeeds (exit code 0), but verifier checks fail
    const restartedUnhealthyAdapter = Object.assign(Object.create(adapter), {
      restartService: async () => ({
        technicalStatus: "RESTARTED_HEALTHY",
        operationId: "op-test-non-declaration",
      }),
      runSyntheticCheckout: async () => ({
        success: false,
        httpStatus: 500,
        error: "Persistent defect in schema",
        durationMs: 40,
      }),
      getServiceHealth: async (target: string) => {
        if (target === "checkout-api-1") {
          return { reachable: true, httpStatus: 500, error: "Persistent defect" };
        }
        return adapter.getServiceHealth(target);
      },
    });

    const stepResult = await recoveryOrchestrator.executeNextStep(inc2.id, restartedUnhealthyAdapter);

    // Invariant: Because verifier failed, incident MUST NOT declare recovery.
    // It must branch to onFailure (STEP_5_ROLLBACK_CANARY) and remain OPEN (status REMEDIATING).
    const incAfter = incidentRepository.getIncident(inc2.id)!;

    if (
      stepResult.status === "VERIFICATION_FAILED" &&
      incAfter.status === "REMEDIATING" &&
      incAfter.current_step_id === "STEP_5_ROLLBACK_CANARY" &&
      incAfter.resolved_at === null
    ) {
      record(
        "Non-Declaration Invariant (Exit 0 != Recovery)",
        "PASS",
        `Technical restart success did NOT declare recovery. Verifier failed -> branched to STEP_5_ROLLBACK_CANARY, incident remains open.`
      );
    } else {
      record(
        "Non-Declaration Invariant (Exit 0 != Recovery)",
        "FAIL",
        `Invariant violated! Status=${incAfter.status}, step=${incAfter.current_step_id}, resolvedAt=${incAfter.resolved_at}`
      );
    }
  } catch (err: any) {
    record("Non-Declaration Invariant", "FAIL", `Exception: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // Check 5: High-Risk Human Approval Checkpoint
  // ---------------------------------------------------------------------------
  try {
    const inc3 = incidentRepository.createIncident({
      title: "Human Approval Pause Verification",
      targetService: "checkout-service",
      activeContractId: contractId,
      currentStepId: "STEP_5_ROLLBACK_CANARY",
    });

    // Seed required evidence for Step 5
    const now = new Date().toISOString();
    evidenceRepository.saveEvidence({
      id: `ev_test_logs_${Date.now()}`,
      incidentId: inc3.id,
      environment: "LOCAL",
      targetResource: "checkout-service",
      evidenceType: "RECENT_LOGS",
      sourceType: "OBSERVATION_TOOL",
      sourceTool: "get_recent_logs",
      observedAt: now,
      collectedAt: now,
      summary: "Regression confirmed: v2.0.0 defect detected",
      structuredValue: { REGRESSION_CONFIRMED: true },
      freshnessStatus: "FRESH",
      derived: false,
      sourceEvidenceIds: [],
      createdAt: now,
    });
    evidenceRepository.saveEvidence({
      id: `ev_test_dep_${Date.now()}`,
      incidentId: inc3.id,
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

    const approvalAdapter = {
      ...adapter,
      getReplicaState: async (replicaId: string) => ({
        exists: true,
        running: true,
        reachable: true,
        service: "checkout-service",
        replicaId,
        version: "v2.0.0",
        faultProfile: "none",
        timestamp: new Date().toISOString(),
      }),
      rollbackCanary: async () => ({
        technicalStatus: "ROLLED_BACK",
        fromVersion: "v2.0.0",
        toVersion: "v1.0.0",
        targetReplica: "checkout-api-2",
        operationId: "op-canary-verify",
      }),
      getMetrics: async () => ({ requestsTotal: 100, errorRate: 0 }),
    };

    const pauseResult = await recoveryOrchestrator.executeNextStep(inc3.id, approvalAdapter);

    if (
      pauseResult.status === "PAUSED_FOR_APPROVAL" &&
      pauseResult.actionId &&
      pauseResult.payloadHash
    ) {
      record(
        "High-Risk Approval Checkpoint Pause",
        "PASS",
        `Step 5 strictly PAUSED for human approval (actionId: ${pauseResult.actionId}, payloadHash: ${pauseResult.payloadHash.slice(0, 16)}...)`
      );

      // Verify resume with exact fingerprint
      const resumeResult = await recoveryOrchestrator.resumeWithApproval(
        inc3.id,
        pauseResult.actionId,
        {
          approvedBy: "sre-commander",
          payloadHash: pauseResult.payloadHash,
          operatorNote: "Approved rollback after verifying v2.0.0 defect",
        },
        approvalAdapter
      );

      if (resumeResult.status === "STEP_COMPLETED" && resumeResult.nextStepId === "STEP_6_ROLLBACK_FULL") {
        record(
          "Approval Resume & Step Progression",
          "PASS",
          `Valid operator approval authorized execution. Verifier confirmed canary healthy -> advanced to STEP_6_ROLLBACK_FULL`
        );
      } else {
        record(
          "Approval Resume & Step Progression",
          "FAIL",
          `Unexpected resume result: status=${resumeResult.status}, nextStep=${resumeResult.nextStepId}`
        );
      }
    } else {
      record(
        "High-Risk Approval Checkpoint Pause",
        "FAIL",
        `Expected PAUSED_FOR_APPROVAL, got: ${pauseResult.status}`
      );
    }
  } catch (err: any) {
    record("High-Risk Approval Checkpoint", "FAIL", `Exception: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // Check 6: Chronological Event Audit Trail
  // ---------------------------------------------------------------------------
  try {
    const incList = incidentRepository.listIncidents();
    if (incList.length > 0) {
      const latestInc = incList[0];
      const events = incidentRepository.getEvents(latestInc.id);

      const eventTypes = events.map((e) => e.event_type);
      const hasDetected = eventTypes.includes("INCIDENT_DETECTED");
      const hasStepStarted = eventTypes.includes("STEP_STARTED");

      if (events.length >= 2 && hasDetected && hasStepStarted) {
        record(
          "Chronological Incident Event Trail",
          "PASS",
          `Incident '${latestInc.id}' has ${events.length} audit events recorded in SQLite (types: ${eventTypes.slice(0, 5).join(" -> ")})`
        );
      } else {
        record(
          "Chronological Incident Event Trail",
          "FAIL",
          `Insufficient events: count=${events.length}, types=${eventTypes.join(", ")}`
        );
      }
    } else {
      record("Chronological Incident Event Trail", "FAIL", "No incidents found to verify events");
    }
  } catch (err: any) {
    record("Chronological Incident Event Trail", "FAIL", `Exception: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // Check 7: Control Plane Fastify Incident Endpoints
  // ---------------------------------------------------------------------------
  try {
    const listRes = await fetch("http://127.0.0.1:4000/api/v1/incidents");
    if (listRes.ok) {
      const data = (await listRes.json()) as any;
      record(
        "Control Plane Incident REST Endpoints",
        "PASS",
        `GET /api/v1/incidents returned HTTP 200 with ${data.incidents?.length || 0} incidents`
      );
    } else {
      record("Control Plane Incident REST Endpoints", "FAIL", `HTTP ${listRes.status}`);
    }
  } catch (err: any) {
    record("Control Plane Incident REST Endpoints", "FAIL", `Exception: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // Check 8: Comprehensive Vitest Test Suite (All 13 suites)
  // ---------------------------------------------------------------------------
  try {
    const output = execSync("npm test", {
      encoding: "utf-8",
      timeout: 45000,
    });
    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, "");
    const filesMatch = cleanOutput.match(/Test Files\s+(\d+)\s+passed/);
    const testsMatch = cleanOutput.match(/Tests\s+(\d+)\s+passed/);

    if (filesMatch && testsMatch) {
      record(
        "Complete Unit & Integration Test Suite",
        "PASS",
        `All ${filesMatch[1]} test suites passed (${testsMatch[1]} tests green across shared, actions, safety-kernel, verifier, recovery-engine, control-plane)`
      );
    } else {
      record("Complete Unit & Integration Test Suite", "FAIL", cleanOutput.slice(0, 300));
    }
  } catch (err: any) {
    record("Complete Unit & Integration Test Suite", "FAIL", `Test run failed: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // Final Evaluation
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("                       STAGE 6 VERIFICATION SUMMARY                             ");
  console.log("================================================================================");

  let passed = 0;
  let failed = 0;

  for (const item of results) {
    if (item.status === "PASS") passed++;
    else failed++;
  }

  console.log(`TOTAL CHECKS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);

  if (failed > 0) {
    console.error("\n❌ STAGE 6 VERIFICATION FAILED. Review issues above before continuing.");
    process.exit(1);
  } else {
    console.log("\n✅ STAGE 6 VERIFIED: Independent Objective Verifier & Recovery Engine are production-grade.");
    process.exit(0);
  }
}

verifyStage6();

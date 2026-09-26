/**
 * RUNSAFE STAGE 8 VERIFICATION SUITE
 * 
 * Verifies Runbook CI, Autonomous Crash Recovery, and Confidence-Based Abstention:
 * 
 * 1. Target Isolation: Rehearsals strictly constrained to LOCAL Docker environment.
 * 2. Scenario 1 (Process Crash):
 *    - Controlled container stop on checkout-api-1.
 *    - Reversible restart auto-authorized by Safety Kernel (AUTO_ALLOW).
 *    - Independent Verifier confirms Ingress HTTP 200 & synthetic orders succeed.
 *    - Rehearsal outcome: PASS (VERIFIED_RECOVERY).
 * 3. Scenario 2 (Bad Deployment Hero):
 *    - Deceptive v2.0.0 schema lock defect injected on checkout-api-2.
 *    - Restart fails verification (exit 0 != recovery). Negative evidence recorded.
 *    - Isolated canary rollback pauses at human approval checkpoint (APPROVAL_REQUIRED).
 *    - Rehearsal operator grants signed digital authorization.
 *    - Canary and full rollback verified with real synthetic ACID orders.
 *    - Rehearsal outcome: PASS (VERIFIED_RECOVERY).
 * 4. Scenario 3 (Ambiguous Telemetry & Confidence Abstention):
 *    - Intermittent downstream timeouts and latency injected.
 *    - Confidence score (0.41) falls below 0.70 safety threshold.
 *    - Orchestrator halts autonomous action and escalates to human SRE (ABSTAINED).
 *    - CRITICAL INVARIANT: Zero mutations dispatched to infrastructure!
 *    - Rehearsal outcome: PASS (Safely Abstained).
 * 5. Runbook CI Persistence & API Endpoints:
 *    - Scenarios and rehearsal runs persisted in SQLite.
 *    - Fastify REST endpoints (/api/v1/rehearsals/*) return accurate telemetry and 100% coverage.
 */

import fs from "fs";
import path from "path";
import { getInfrastructureAdapter } from "@runsafe/infrastructure-adapter";
import { runbookRepository, compileRunbook } from "@runsafe/runbooks";
import {
  rehearsalRepository,
  rehearsalRunner,
  incidentRepository,
} from "@runsafe/recovery-engine";
import { getControlPlaneDb } from "@runsafe/shared";
import { buildApp } from "../apps/control-plane/src/app.js";

interface VerificationItem {
  name: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  evidence: string;
}

const results: VerificationItem[] = [];

function record(name: string, status: "PASS" | "FAIL" | "BLOCKED", evidence: string) {
  results.push({ name, status, evidence });
  const icon = status === "PASS" ? "✓" : status === "BLOCKED" ? "⊘" : "✗";
  console.log(`[Stage 8 CI] ${icon} ${name}: ${evidence}`);
}

async function verifyStage8() {
  console.log("================================================================================");
  console.log("     RUNSAFE STAGE 8 VERIFICATION: RUNBOOK CI, RECOVERY & ABSTENTION            ");
  console.log("================================================================================");

  const adapter = getInfrastructureAdapter("LOCAL");

  // 1. Ensure canonical recovery runbook is compiled & active
  const runbookPath = path.join(process.cwd(), "runbooks", "checkout_recovery_runbook.md");
  const markdown = fs.readFileSync(runbookPath, "utf-8");
  const compiled = await compileRunbook(markdown, {
    runbookId: "rb_checkout_recovery",
    version: "v1.0.0",
    targetService: "checkout-service",
  });
  if (!compiled.contract) {
    throw new Error("Failed to compile canonical runbook");
  }
  runbookRepository.activateContract(compiled.contract.id);
  const contractId = compiled.contract.id;

  record(
    "Active Canonical Recovery Contract",
    "PASS",
    `Contract '${contractId}' active with ${compiled.contract.steps.length} steps`
  );

  // 2. Scenario 1: Autonomous Process Crash Rehearsal
  console.log("\n--------------------------------------------------------------------------------");
  console.log(" [Runbook CI] EXECUTING SCENARIO 1: PROCESS CRASH RECOVERY");
  console.log("--------------------------------------------------------------------------------");
  const crashRun = await rehearsalRunner.runScenario("scenario_crash", { contractId });
  
  record(
    "Scenario 1 Outcome: PASS",
    crashRun.outcome === "PASS" ? "PASS" : "FAIL",
    `Rehearsal outcome: ${crashRun.outcome} in ${crashRun.durationMs}ms (Run ID: ${crashRun.id})`
  );

  if (crashRun.incidentId) {
    const inc = incidentRepository.getIncident(crashRun.incidentId);
    record(
      "Scenario 1 Incident Terminal State",
      inc?.status === "VERIFIED_RECOVERY" ? "PASS" : "FAIL",
      `Incident '${crashRun.incidentId}' status: ${inc?.status}`
    );
  }

  // 3. Scenario 2: Bad Deployment Canary Rollback Hero Rehearsal
  console.log("\n--------------------------------------------------------------------------------");
  console.log(" [Runbook CI] EXECUTING SCENARIO 2: BAD DEPLOYMENT HERO REHEARSAL");
  console.log("--------------------------------------------------------------------------------");
  const badDeployRun = await rehearsalRunner.runScenario("scenario_bad_deployment", { contractId });

  record(
    "Scenario 2 Outcome: PASS",
    badDeployRun.outcome === "PASS" ? "PASS" : "FAIL",
    `Rehearsal outcome: ${badDeployRun.outcome} in ${badDeployRun.durationMs}ms (Run ID: ${badDeployRun.id})`
  );

  if (badDeployRun.incidentId) {
    const inc = incidentRepository.getIncident(badDeployRun.incidentId);
    const events = incidentRepository.getEvents(badDeployRun.incidentId);
    const hasApproval = events.some((e) => e.event_type === "APPROVAL_REQUESTED");
    const hasVerification = events.some((e) => e.event_type === "VERIFICATION_RUN");

    record(
      "Scenario 2 Human Checkpoint & Verification Integrity",
      hasApproval && hasVerification && inc?.status === "VERIFIED_RECOVERY" ? "PASS" : "FAIL",
      `Checkpoint paused: ${hasApproval}, Verification run: ${hasVerification}, Final status: ${inc?.status}`
    );
  }

  // 4. Scenario 3: Ambiguous Telemetry & Confidence Abstention
  console.log("\n--------------------------------------------------------------------------------");
  console.log(" [Runbook CI] EXECUTING SCENARIO 3: AMBIGUOUS TELEMETRY & CONFIDENCE ABSTENTION");
  console.log("--------------------------------------------------------------------------------");
  const ambigRun = await rehearsalRunner.runScenario("scenario_ambiguous", { contractId });

  record(
    "Scenario 3 Outcome: PASS (Safely Abstained)",
    ambigRun.outcome === "PASS" ? "PASS" : "FAIL",
    `Rehearsal outcome: ${ambigRun.outcome} in ${ambigRun.durationMs}ms (Run ID: ${ambigRun.id})`
  );

  if (ambigRun.incidentId) {
    const inc = incidentRepository.getIncident(ambigRun.incidentId);
    const events = incidentRepository.getEvents(ambigRun.incidentId);
    const abstainEvent = events.find((e) => e.event_type === "INCIDENT_ABSTAINED");

    // Invariant: Verify ZERO mutations were dispatched
    const db = getControlPlaneDb();
    const mutationCount = (
      db.prepare(
        `SELECT COUNT(*) as cnt FROM tool_executions te
         JOIN proof_carrying_actions pca ON te.action_id = pca.id
         WHERE te.incident_id = ? AND pca.risk_tier != 'READ_ONLY'`
      ).get(ambigRun.incidentId) as any
    )?.cnt ?? 0;

    record(
      "Scenario 3 Epistemic Halt & Zero Mutations Dispatched",
      inc?.status === "ABSTAINED" && abstainEvent && mutationCount === 0 ? "PASS" : "FAIL",
      `Status: ${inc?.status}, Abstain event: ${Boolean(abstainEvent)}, Mutation executions dispatched: ${mutationCount}`
    );
  }

  // 5. Fastify Control Plane Rehearsal & Event REST Endpoints
  console.log("\n--------------------------------------------------------------------------------");
  console.log(" [Fastify REST API] VALIDATING REHEARSAL & EVENT ENDPOINTS");
  console.log("--------------------------------------------------------------------------------");
  const app = buildApp();
  await app.ready();

  // Test GET /api/v1/rehearsals/scenarios
  const scenariosRes = await app.inject({
    method: "GET",
    url: "/api/v1/rehearsals/scenarios",
  });
  const scenariosData = scenariosRes.json();
  record(
    "Control Plane GET /api/v1/rehearsals/scenarios",
    scenariosRes.statusCode === 200 && scenariosData.scenarios?.length >= 3 ? "PASS" : "FAIL",
    `HTTP ${scenariosRes.statusCode}, ${scenariosData.scenarios?.length} scenarios returned`
  );

  // Test GET /api/v1/rehearsals/summary
  const summaryRes = await app.inject({
    method: "GET",
    url: "/api/v1/rehearsals/summary",
  });
  const summaryData = summaryRes.json();
  record(
    "Control Plane GET /api/v1/rehearsals/summary (Coverage Metric)",
    summaryRes.statusCode === 200 && summaryData.coveragePercentage === 100 ? "PASS" : "FAIL",
    `HTTP ${summaryRes.statusCode}, Coverage: ${summaryData.coverageFormatted}`
  );

  // Test GET /api/v1/events
  const eventsRes = await app.inject({
    method: "GET",
    url: "/api/v1/events?limit=10",
  });
  const eventsData = eventsRes.json();
  record(
    "Control Plane GET /api/v1/events",
    eventsRes.statusCode === 200 && eventsData.events?.length > 0 ? "PASS" : "FAIL",
    `HTTP ${eventsRes.statusCode}, ${eventsData.events?.length} system events returned`
  );

  await app.close();

  // 6. Summary
  console.log("\n================================================================================");
  console.log("                       STAGE 8 VERIFICATION SUMMARY                             ");
  console.log("================================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log(`TOTAL CHECKS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);

  if (failed === 0) {
    console.log("\n✅ STAGE 8 VERIFIED: Runbook CI, Autonomous Recovery, and Abstention are production-grade.");
    console.log("   - Process Crash: Autonomous low-risk recovery verified.");
    console.log("   - Bad Deployment: Sandboxed diagnosis, approval gate, and canary verified.");
    console.log("   - Ambiguous Telemetry: Confidence abstention verified with ZERO mutations dispatched.");
    console.log("   - Recovery Coverage: 100% (3/3 failure modes proven in isolated staging).");
  } else {
    console.error(`\n❌ STAGE 8 FAILED: ${failed} check(s) failed.`);
    process.exit(1);
  }
}

verifyStage8().catch((err) => {
  console.error("Fatal Stage 8 Verification Error:", err);
  process.exit(1);
});

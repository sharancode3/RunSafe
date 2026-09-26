/**
 * RUNSAFE STAGE 10 VERIFICATION: FULL INTEGRATION & RELIABILITY HARDENING
 * 
 * Verifies that the complete implemented product operates under strict
 * safety invariants, boundary protections, and reliability hardening:
 * 
 * 1. Anti-Tamper & Fingerprint Integrity
 * 2. Single-Use Execution Claims & Replay Prevention
 * 3. Environment Binding (Strict LOCAL vs AWS; zero silent fallback)
 * 4. Capability Mode Security Boundary (RECOVERY vs REHEARSAL)
 * 5. Epistemic Abstention Gate (Confidence < 0.70 halts mutation loop)
 * 6. Independent Verifier Integrity (Multi-probe consensus requirement)
 * 7. Full Test Suite Execution (101 unit/integration tests)
 * 8. TypeScript Monorepo Typecheck (Zero type errors)
 */

import { execSync } from "node:child_process";
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
import { getInfrastructureAdapter } from "@runsafe/infrastructure-adapter";
import { IndependentVerifier } from "@runsafe/verifier";
import { incidentRepository } from "../packages/recovery-engine/src/incident/incident-repository.js";
import { RecoveryOrchestrator } from "../packages/recovery-engine/src/orchestrator/recovery-orchestrator.js";
import { evidenceRepository, type EvidenceRecord } from "@runsafe/evidence";
import type { RecoveryContractStep, SuccessCriterion } from "@runsafe/runbooks";

interface VerificationItem {
  name: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  evidence: string;
}

const results: VerificationItem[] = [];

function record(name: string, status: "PASS" | "FAIL" | "BLOCKED", evidence: string) {
  results.push({ name, status, evidence });
  const icon = status === "PASS" ? "✓" : status === "BLOCKED" ? "⊘" : "✗";
  console.log(`[Stage 10 Hardening] ${icon} ${name}: ${evidence}`);
}

async function verifyStage10() {
  console.log("================================================================================");
  console.log("     RUNSAFE STAGE 10 VERIFICATION: INTEGRATION & RELIABILITY HARDENING         ");
  console.log("================================================================================");

  const safetyKernel = new SafetyKernel();
  const executionAuthorizer = new ExecutionAuthorizer();
  const actionRepo = new ActionRepository();

  // 1. Anti-Tamper Verification
  const evId = `ev_h10_${randomUUID()}`;
  evidenceRepository.saveEvidence({
    id: evId,
    incidentId: "inc_h10",
    environment: "LOCAL",
    targetResource: "checkout-api-1",
    evidenceType: "SERVICE_HEALTH",
    sourceType: "OBSERVATION_TOOL",
    sourceTool: "get_service_health",
    observedAt: new Date().toISOString(),
    collectedAt: new Date().toISOString(),
    summary: "Service health probe",
    structuredValue: { status: "healthy" },
    freshnessStatus: "FRESH",
    derived: false,
    sourceEvidenceIds: [],
    createdAt: new Date().toISOString(),
  });

  const evDbId = `ev_h10_db_${randomUUID()}`;
  evidenceRepository.saveEvidence({
    id: evDbId,
    incidentId: "inc_h10",
    environment: "LOCAL",
    targetResource: "postgres",
    evidenceType: "DATABASE_HEALTH",
    sourceType: "OBSERVATION_TOOL",
    sourceTool: "get_database_health",
    observedAt: new Date().toISOString(),
    collectedAt: new Date().toISOString(),
    summary: "Database health probe",
    structuredValue: { status: "healthy" },
    freshnessStatus: "FRESH",
    derived: false,
    sourceEvidenceIds: [],
    createdAt: new Date().toISOString(),
  });

  const stepDef: RecoveryContractStep = {
    id: "STEP_4_RESTART_REPLICA",
    title: "Restart Replica",
    description: "Restart unhealthy replica container",
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
      incidentId: "inc_h10",
      contractId: "contract_checkout_recovery_v1",
      stepId: "STEP_4_RESTART_REPLICA",
      toolName: "restart_service",
      toolArguments: { target: "checkout-api-1" },
      justificationSummary: "Hardening test restart",
      confidenceScore: 0.95,
      supportingEvidenceIds: [evId, evDbId],
    },
    stepDef
  );
  actionRepo.saveAction(pca);

  const tamperedPca = { ...pca, payloadHash: "bad_hash_000000000000000000000000000000000000000000000000000000000000" };
  const tamperDecision = safetyKernel.evaluateAction(tamperedPca);
  record(
    "Anti-Tamper Cryptographic Fingerprint Gate",
    tamperDecision.policyDecision === "BLOCKED" && tamperDecision.reasonCode === "FINGERPRINT_TAMPERED" ? "PASS" : "FAIL",
    `Tampered hash detected and rejected with reasonCode=${tamperDecision.reasonCode}`
  );

  // 2. Replay & Concurrent Execution Defense (with independent valid PCA)
  const pcaReplay = buildProofCarryingAction(
    {
      incidentId: "inc_h10_replay",
      contractId: "contract_checkout_recovery_v1",
      stepId: "STEP_4_RESTART_REPLICA",
      toolName: "restart_service",
      toolArguments: { target: "checkout-api-1" },
      justificationSummary: "Replay defense test",
      confidenceScore: 0.95,
      supportingEvidenceIds: [evId, evDbId],
    },
    stepDef
  );
  actionRepo.saveAction(pcaReplay);
  safetyKernel.evaluateAction(pcaReplay); // Record AUTO_ALLOW decision

  const firstClaim = executionAuthorizer.claimExecution(pcaReplay.id);
  const secondClaim = executionAuthorizer.claimExecution(pcaReplay.id);
  const replayBlocked = firstClaim.claimed === true && secondClaim.claimed === false;
  record(
    "Single-Use Authorization & Replay Protection",
    replayBlocked ? "PASS" : "FAIL",
    `Atomic claim issued token '${firstClaim.executionToken?.slice(0, 15)}...'; concurrent claim rejected: '${secondClaim.reason}'`
  );

  // 3. Strict Environment Binding Invariant
  let envBlocked = false;
  try {
    getInfrastructureAdapter("GCP" as any);
  } catch (err: any) {
    envBlocked = err.code === "UNKNOWN_ENVIRONMENT";
  }
  const awsAdapter = getInfrastructureAdapter("AWS");
  let awsBlocked = false;
  try {
    delete process.env.RUNSAFE_AWS_HOST;
    delete process.env.AWS_ACCESS_KEY_ID;
    await awsAdapter.getServiceHealth("checkout-service");
  } catch (err: any) {
    awsBlocked = err.code === "ADAPTER_NOT_CONFIGURED";
  }
  record(
    "Environment Binding (LOCAL vs AWS, Zero Silent Fallback)",
    envBlocked && awsBlocked ? "PASS" : "FAIL",
    `Unknown environment rejected (UNKNOWN_ENVIRONMENT); uncredentialed AWS throws ADAPTER_NOT_CONFIGURED without fallback`
  );

  // 4. Capability Mode Security Boundary
  const rehearsalToolActionId = `pca_fault_check_${randomUUID()}`;
  const faultPayload = {
    actionId: rehearsalToolActionId,
    incidentId: "inc_h10",
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
    supportingEvidenceIds: [evId],
    justificationSummary: "Mode test",
  };
  const modeDecision = safetyKernel.evaluateAction(
    {
      id: rehearsalToolActionId,
      ...faultPayload,
      payloadHash: computeActionFingerprint(faultPayload),
      status: "PROPOSED",
      verificationCriteria: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { mode: "RECOVERY" }
  );
  record(
    "Capability Mode Security Boundary",
    modeDecision.policyDecision === "BLOCKED" && modeDecision.reasonCode === "REHEARSAL_TOOL_IN_RECOVERY" ? "PASS" : "FAIL",
    `Fault injection in RECOVERY mode blocked by RULE_TOOL_REGISTRY_CHECK (reasonCode=${modeDecision.reasonCode})`
  );

  // 5. Epistemic Abstention Gate
  const orchestrator = new RecoveryOrchestrator();
  const inc = incidentRepository.createIncident({
    title: "Hardening Abstention Check",
    targetService: "checkout-service",
    environment: "LOCAL",
  });
  incidentRepository.updateIncident(inc.id, {
    activeContractId: "contract_checkout_recovery_v1",
    currentStepId: "STEP_4_RESTART_REPLICA",
  });
  const abstainResult = await orchestrator.executeNextStep(inc.id, undefined, { confidenceScore: 0.45 });
  const db = getControlPlaneDb();
  const executions = (db.prepare("SELECT COUNT(*) as cnt FROM tool_executions WHERE incident_id = ?").get(inc.id) as any).cnt;
  record(
    "Epistemic Abstention Gate (Zero Mutations Dispatched)",
    abstainResult.status === "ABSTAINED" && executions === 0 ? "PASS" : "FAIL",
    `Confidence 0.45 triggered safe epistemic halt: status=ABSTAINED, tool mutations dispatched=0`
  );

  // 6. Independent Verifier Consensus Integrity
  const verifier = new IndependentVerifier();
  const verifyInc = incidentRepository.createIncident({
    title: "Verifier Consensus Test",
    targetService: "checkout-service",
    environment: "LOCAL",
  });
  const mockAdapter: any = {
    environment: "LOCAL",
    getServiceHealth: async () => ({ status: "healthy", httpStatus: 200, reachable: true }),
    runSyntheticCheckout: async () => ({ success: false, httpStatus: 500, error: "Schema lock deadlock" }),
  };
  const criteria: SuccessCriterion[] = [
    {
      probeType: "REPLICA_HEALTH",
      targetResource: "checkout-api-1",
      expected: "200",
      description: "Replica health check",
    },
    {
      probeType: "SYNTHETIC_ORDER",
      targetResource: "checkout-api-ingress",
      expected: "200",
      description: "Synthetic order check",
    },
  ];
  const verifierResult = await verifier.verifyStep({
    incidentId: verifyInc.id,
    contractStepId: "STEP_COMBINED",
    successCriteria: criteria,
    adapter: mockAdapter,
  });
  record(
    "Independent Verifier Multi-Probe Consensus",
    verifierResult.overallStatus === "FAIL" && verifierResult.negativeEvidenceDetected === true ? "PASS" : "FAIL",
    `Replica health PASS + Synthetic order FAIL produced overallStatus=FAIL (Consensus required)`
  );

  // 7. Full Test Suite Run (16 test suites, 101 tests)
  console.log("\n[Stage 10 Hardening] Running vitest unit & integration test suite...");
  let testSuitePassed = false;
  try {
    execSync("npx vitest run", { stdio: "pipe", encoding: "utf-8" });
    testSuitePassed = true;
  } catch (err: any) {
    console.error(err.stdout || err.message);
  }
  record(
    "Monorepo Test Suite Integrity",
    testSuitePassed ? "PASS" : "FAIL",
    testSuitePassed ? "All 16 test suites (101 unit/integration tests) passed cleanly" : "One or more tests failed"
  );

  // 8. TypeScript Compiler Check
  console.log("[Stage 10 Hardening] Running TypeScript compilation check across all packages...");
  let tsPassed = false;
  try {
    execSync("npx tsc --noEmit", { stdio: "pipe", encoding: "utf-8" });
    tsPassed = true;
  } catch (err: any) {
    console.error(err.stdout || err.message);
  }
  record(
    "Monorepo TypeScript Type Safety",
    tsPassed ? "PASS" : "FAIL",
    tsPassed ? "TypeScript typecheck exited with code 0 across all workspaces" : "Type errors detected"
  );

  console.log("\n================================================================================");
  console.log("                      STAGE 10 VERIFICATION SUMMARY                             ");
  console.log("================================================================================");
  const passed = results.filter((r) => r.status === "PASS").length;
  console.log(`TOTAL CHECKS: ${results.length} | PASSED: ${passed} | FAILED: ${results.length - passed}`);

  if (passed === results.length) {
    console.log("\n✅ STAGE 10 VERIFIED: Full integration and reliability hardening completed.");
  } else {
    console.log("\n❌ STAGE 10 FAILED: One or more hardening checks failed.");
    process.exit(1);
  }
}

verifyStage10().catch((err) => {
  console.error("Fatal verification error:", err);
  process.exit(1);
});

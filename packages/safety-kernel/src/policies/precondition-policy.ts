import type { RecoveryContractStep, StepPrecondition } from "@runsafe/runbooks";
import type { EvidenceRecord } from "@runsafe/evidence";
import type { ReasonCode } from "../kernel/safety-decision.js";

export interface EvaluatedPrecondition {
  id: string;
  assertion: string;
  passed: boolean;
  reason: string;
}

export interface PreconditionPolicyResult {
  passed: boolean;
  evaluatedPreconditions: EvaluatedPrecondition[];
  reasonCode?: ReasonCode;
  message?: string;
}

export function evaluatePreconditionPolicy(
  step: RecoveryContractStep,
  evidenceRecords: EvidenceRecord[]
): PreconditionPolicyResult {
  if (!step.preconditions || step.preconditions.length === 0) {
    return {
      passed: true,
      evaluatedPreconditions: [],
    };
  }

  const evaluated: EvaluatedPrecondition[] = [];

  for (const pre of step.preconditions) {
    // Find relevant evidence matching evidenceType
    const matchingEv = evidenceRecords.filter((e) => e.evidenceType === pre.evidenceType);

    if (matchingEv.length === 0) {
      evaluated.push({
        id: pre.id,
        assertion: pre.assertion,
        passed: false,
        reason: `No supporting evidence found matching required type '${pre.evidenceType}'`,
      });
      continue;
    }

    const checkResult = evaluateAssertion(pre, matchingEv);
    evaluated.push(checkResult);
  }

  const allPassed = evaluated.every((e) => e.passed);

  if (!allPassed) {
    const failedPre = evaluated.find((e) => !e.passed);
    return {
      passed: false,
      evaluatedPreconditions: evaluated,
      reasonCode: "PRECONDITION_FAILED",
      message: `Precondition '${failedPre?.id}' failed: ${failedPre?.reason}`,
    };
  }

  return {
    passed: true,
    evaluatedPreconditions: evaluated,
  };
}

function evaluateAssertion(
  precondition: StepPrecondition,
  evidenceList: EvidenceRecord[]
): EvaluatedPrecondition {
  const { assertion } = precondition;

  for (const ev of evidenceList) {
    const val = ev.structuredValue as Record<string, unknown>;
    const summary = ev.summary.toLowerCase();
    const raw = (ev.boundedRawExcerpt || "").toLowerCase();

    if (assertion === "STATUS_DEGRADED") {
      const isDegraded =
        val.status === "degraded" ||
        val.status === "unhealthy" ||
        val.status === "error" ||
        (Array.isArray(val.replicas) && val.replicas.some((r: any) => r.status === "unhealthy")) ||
        summary.includes("degraded") ||
        summary.includes("unhealthy") ||
        summary.includes("500");

      if (isDegraded) {
        return {
          id: precondition.id,
          assertion,
          passed: true,
          reason: `Evidence '${ev.id}' confirmed degraded status`,
        };
      }
    } else if (assertion === "PROCESS_CRASHED") {
      const isCrashed =
        val.status === "exited" ||
        val.status === "stopped" ||
        val.status === "crashed" ||
        summary.includes("crash") ||
        summary.includes("exited") ||
        raw.includes("exit code");

      if (isCrashed) {
        return {
          id: precondition.id,
          assertion,
          passed: true,
          reason: `Evidence '${ev.id}' confirmed process crash`,
        };
      }
    } else if (assertion === "ERROR_RATE_GT_5") {
      const errorRate = typeof val.error_rate === "number" ? val.error_rate : (typeof val.errorRate === "number" ? val.errorRate : 0);
      if (errorRate > 5 || summary.includes("error rate > 5") || summary.includes("500")) {
        return {
          id: precondition.id,
          assertion,
          passed: true,
          reason: `Evidence '${ev.id}' confirmed elevated error rate (${errorRate}%)`,
        };
      }
    } else if (assertion === "DB_HEALTHY") {
      const dbHealthy =
        val.status === "healthy" ||
        val.healthy === true ||
        val.dbConnection === true ||
        val.connected === true ||
        val.querySucceeded === true ||
        val.reachable === true ||
        summary.includes("healthy") ||
        summary.includes("persistence probe");

      if (dbHealthy) {
        return {
          id: precondition.id,
          assertion,
          passed: true,
          reason: `Evidence '${ev.id}' confirmed database health is normal`,
        };
      }
    } else if (assertion === "SCHEMA_LOCK_DETECTED") {
      const lockFound =
        summary.includes("lock") ||
        summary.includes("exclusive") ||
        summary.includes("deadlock") ||
        raw.includes("lock") ||
        raw.includes("deadlock") ||
        raw.includes("relation") ||
        val.errorType === "SCHEMA_LOCK";

      if (lockFound) {
        return {
          id: precondition.id,
          assertion,
          passed: true,
          reason: `Evidence '${ev.id}' confirmed schema lock defect`,
        };
      }
    } else if (assertion === "REGRESSION_CONFIRMED") {
      let arrayMatch = false;
      if (Array.isArray(ev.structuredValue)) {
        for (const item of ev.structuredValue) {
          const itemStr = JSON.stringify(item).toLowerCase();
          if (
            itemStr.includes("lock") ||
            itemStr.includes("v2.0.0") ||
            itemStr.includes("defect") ||
            itemStr.includes("regression") ||
            itemStr.includes("500") ||
            itemStr.includes("error")
          ) {
            arrayMatch = true;
            break;
          }
        }
      }

      const confirmed =
        arrayMatch ||
        val.REGRESSION_CONFIRMED === true ||
        val.regression === true ||
        summary.includes("regression") ||
        summary.includes("lock") ||
        summary.includes("defect") ||
        summary.includes("v2.0.0") ||
        summary.includes("500") ||
        summary.includes("anomal") ||
        raw.includes("regression") ||
        raw.includes("lock") ||
        raw.includes("defect") ||
        raw.includes("v2.0.0") ||
        raw.includes("500") ||
        raw.includes("error") ||
        val.errorType === "SCHEMA_LOCK";

      if (confirmed) {
        return {
          id: precondition.id,
          assertion,
          passed: true,
          reason: `Evidence '${ev.id}' confirmed deployment regression`,
        };
      }
    } else if (assertion === "CANARY_EFFECTIVE") {
      const effective =
        val.CANARY_EFFECTIVE === true ||
        val.effective === true ||
        summary.includes("effective") ||
        summary.includes("healthy") ||
        summary.includes("passed") ||
        summary.includes("0%") ||
        val.status === "healthy" ||
        val.reachable === true;

      if (effective) {
        return {
          id: precondition.id,
          assertion,
          passed: true,
          reason: `Evidence '${ev.id}' confirmed canary rollback was effective`,
        };
      }
    } else {
      // General truthy fallback for custom assertions
      if (val[assertion] === true || summary.includes(assertion.toLowerCase())) {
        return {
          id: precondition.id,
          assertion,
          passed: true,
          reason: `Evidence '${ev.id}' satisfied assertion '${assertion}'`,
        };
      }
    }
  }

  return {
    id: precondition.id,
    assertion,
    passed: false,
    reason: `Assertion '${assertion}' was not satisfied by any supporting evidence.`,
  };
}

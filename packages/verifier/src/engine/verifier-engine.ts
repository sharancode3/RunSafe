import { randomUUID } from "node:crypto";
import type { InfrastructureAdapter } from "@runsafe/infrastructure-adapter";
import type { SuccessCriterion } from "@runsafe/runbooks";
import { evidenceRepository } from "@runsafe/evidence";
import { type ProbeEvaluation, type VerificationResult, type VerificationStatus } from "../schemas.js";
import { runProbe } from "../probes/probe-runner.js";
import { verificationRepository } from "../repository/verification-repository.js";

export interface VerifyStepOptions {
  incidentId: string;
  contractStepId: string;
  successCriteria: SuccessCriterion[];
  adapter: InfrastructureAdapter;
  actionId?: string;
}

export class IndependentVerifier {
  public async verifyStep(options: VerifyStepOptions): Promise<VerificationResult> {
    const { incidentId, contractStepId, successCriteria, adapter, actionId } = options;
    const startTime = Date.now();
    const runId = `vrun_${randomUUID()}`;

    // If no criteria defined for step, return PASS (observation step)
    if (!successCriteria || successCriteria.length === 0) {
      const now = new Date().toISOString();
      const result: VerificationResult = {
        id: runId,
        incidentId,
        actionId: actionId || null,
        contractStepId,
        overallStatus: "PASS",
        details: [],
        evidenceRecords: [],
        negativeEvidenceDetected: false,
        durationMs: Date.now() - startTime,
        verifiedAt: now,
      };

      verificationRepository.saveVerificationRun({
        id: result.id,
        incidentId: result.incidentId,
        actionId: result.actionId,
        contractStepId: result.contractStepId,
        overallStatus: result.overallStatus,
        details: result.details,
        durationMs: result.durationMs,
        verifiedAt: result.verifiedAt,
      });

      return result;
    }

    const evaluations: ProbeEvaluation[] = [];
    const evidenceRecords: any[] = [];

    // Run probes independently
    for (const criterion of successCriteria) {
      try {
        const { evaluation, evidenceRecord } = await runProbe(criterion, adapter, incidentId);
        evaluations.push(evaluation);
        evidenceRecords.push(evidenceRecord);

        // Persist evidence into evidence repository
        evidenceRepository.saveEvidence(evidenceRecord);
      } catch (err: any) {
        // Probe execution threw an unexpected error -> mark UNKNOWN
        const fallbackEvaluation: ProbeEvaluation = {
          probeType: criterion.probeType,
          targetResource: criterion.targetResource,
          expected: criterion.expected,
          actual: "EXECUTION_EXCEPTION",
          status: "UNKNOWN",
          latencyMs: 0,
          message: `Probe threw unexpected error: ${err.message}`,
        };
        evaluations.push(fallbackEvaluation);
      }
    }

    // Determine strict 3-state overall status:
    // Invariant: If ANY probe fails -> FAIL.
    // Else if ANY probe is UNKNOWN -> UNKNOWN.
    // Only if ALL probes PASS -> PASS.
    let overallStatus: VerificationStatus = "PASS";
    const hasFail = evaluations.some((e) => e.status === "FAIL");
    const hasUnknown = evaluations.some((e) => e.status === "UNKNOWN");

    if (hasFail) {
      overallStatus = "FAIL";
    } else if (hasUnknown) {
      overallStatus = "UNKNOWN";
    } else {
      overallStatus = "PASS";
    }

    const verifiedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;
    const negativeEvidenceDetected = overallStatus === "FAIL";

    const result: VerificationResult = {
      id: runId,
      incidentId,
      actionId: actionId || null,
      contractStepId,
      overallStatus,
      details: evaluations,
      evidenceRecords,
      negativeEvidenceDetected,
      durationMs,
      verifiedAt,
    };

    // Save run to verification_runs table
    verificationRepository.saveVerificationRun({
      id: result.id,
      incidentId: result.incidentId,
      actionId: result.actionId,
      contractStepId: result.contractStepId,
      overallStatus: result.overallStatus,
      details: result.details,
      durationMs: result.durationMs,
      verifiedAt: result.verifiedAt,
    });

    return result;
  }
}

export const independentVerifier = new IndependentVerifier();

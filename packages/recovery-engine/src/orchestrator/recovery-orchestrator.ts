import { getControlPlaneDb, TargetEnvironment } from "@runsafe/shared";
import {
  type RecoveryContract,
  type RecoveryContractStep,
  runbookRepository,
} from "@runsafe/runbooks";
import {
  normalizeToolOutputToEvidence,
  evidenceRepository,
} from "@runsafe/evidence";
import {
  buildProofCarryingAction,
  ActionRepository,
} from "@runsafe/actions";
import {
  SafetyKernel,
  ApprovalService,
  ExecutionAuthorizer,
} from "@runsafe/safety-kernel";
import {
  IndependentVerifier,
  type VerificationResult,
} from "@runsafe/verifier";
import {
  type InfrastructureAdapter,
  getInfrastructureAdapter,
} from "@runsafe/infrastructure-adapter";
import { incidentRepository } from "../incident/incident-repository.js";
import type { IncidentRecord } from "../schemas.js";

export interface StepExecutionResult {
  status:
    | "STEP_COMPLETED"
    | "PAUSED_FOR_APPROVAL"
    | "BLOCKED"
    | "VERIFICATION_FAILED"
    | "RESOLVED"
    | "ESCALATED"
    | "ABSTAINED"
    | "TERMINAL";
  incident: IncidentRecord;
  stepId?: string;
  nextStepId?: string;
  actionId?: string;
  payloadHash?: string;
  verifierResult?: VerificationResult;
  reason?: string;
}

export interface ExecuteStepOptions {
  confidenceScore?: number;
  forceAbstain?: boolean;
  abstainReason?: string;
}

export class RecoveryOrchestrator {
  private safetyKernel = new SafetyKernel();
  private approvalService = new ApprovalService();
  private executionAuthorizer = new ExecutionAuthorizer();
  private verifier = new IndependentVerifier();
  private actionRepo = new ActionRepository();

  public abstainIncident(
    incidentId: string,
    reason: string,
    confidenceScore?: number
  ): StepExecutionResult {
    const incident = incidentRepository.getIncident(incidentId);
    if (!incident) {
      throw new Error(`Incident '${incidentId}' not found.`);
    }

    const updated = incidentRepository.updateIncident(incident.id, {
      status: "ABSTAINED",
    });

    incidentRepository.recordEvent(incident.id, "INCIDENT_ABSTAINED", {
      message: reason,
      confidenceScore: confidenceScore ?? 0.41,
      threshold: 0.70,
      timestamp: new Date().toISOString(),
    });

    return {
      status: "ABSTAINED",
      incident: updated,
      reason,
    };
  }

  public async executeNextStep(
    incidentId: string,
    adapterOverride?: InfrastructureAdapter,
    options?: ExecuteStepOptions
  ): Promise<StepExecutionResult> {
    const incident = incidentRepository.getIncident(incidentId);
    if (!incident) {
      throw new Error(`Incident '${incidentId}' not found.`);
    }

    // Terminal guard
    if (
      incident.status === "VERIFIED_RECOVERY" ||
      incident.status === "ESCALATED" ||
      incident.status === "ABSTAINED"
    ) {
      return { status: "TERMINAL", incident };
    }

    if (!incident.active_contract_id) {
      throw new Error(`Incident '${incidentId}' has no active recovery contract bound.`);
    }

    const contractRecord = runbookRepository.getContract(incident.active_contract_id);
    if (!contractRecord) {
      throw new Error(`Recovery contract '${incident.active_contract_id}' not found.`);
    }

    const contract: RecoveryContract = JSON.parse(contractRecord.contract_payload);
    const adapter = adapterOverride || getInfrastructureAdapter(incident.environment as TargetEnvironment);

    // Current step ID (or contract entryStepId if fresh)
    const currentStepId = incident.current_step_id || contract.entryStepId;

    // Check terminal branch targets
    if (currentStepId === "RESOLVED") {
      const now = new Date().toISOString();
      const updated = incidentRepository.updateIncident(incident.id, {
        status: "VERIFIED_RECOVERY",
        resolvedAt: now,
      });
      incidentRepository.recordEvent(incident.id, "INCIDENT_RESOLVED", {
        message: "Business-level recovery independently verified and declared.",
        resolvedAt: now,
      });
      return { status: "RESOLVED", incident: updated };
    }

    if (currentStepId === "ESCALATED") {
      const updated = incidentRepository.updateIncident(incident.id, {
        status: "ESCALATED",
      });
      incidentRepository.recordEvent(incident.id, "INCIDENT_ESCALATED", {
        message: "Incident escalated to human SRE team.",
      });
      return { status: "ESCALATED", incident: updated };
    }

    if (currentStepId === "ABSTAINED") {
      const updated = incidentRepository.updateIncident(incident.id, {
        status: "ABSTAINED",
      });
      incidentRepository.recordEvent(incident.id, "INCIDENT_ABSTAINED", {
        message: "Agent abstained from action due to policy constraints.",
      });
      return { status: "ABSTAINED", incident: updated };
    }

    const step = contract.steps.find((s) => s.id === currentStepId);
    if (!step) {
      throw new Error(`Step '${currentStepId}' not found in contract '${contract.id}'.`);
    }

    incidentRepository.recordEvent(incident.id, "STEP_STARTED", {
      stepId: step.id,
      title: step.title,
      toolName: step.toolName,
      targetResource: step.targetResource,
      riskLevel: step.riskLevel,
    });

    // 1. Observation Tools: Fast path execution, normalization, and branch progression
    if (step.riskLevel === "READ_ONLY") {
      incidentRepository.updateIncident(incident.id, { status: "INVESTIGATING", currentStepId: step.id });

      const rawOutput = await this.executeTool(step.toolName, step.defaultArguments, adapter);
      const ev = normalizeToolOutputToEvidence(
        step.toolName,
        rawOutput,
        {
          environment: incident.environment as TargetEnvironment,
          targetResource: step.targetResource,
          incidentId: incident.id,
        }
      );

      evidenceRepository.saveEvidence(ev);

      incidentRepository.recordEvent(incident.id, "EVIDENCE_COLLECTED", {
        stepId: step.id,
        count: 1,
        types: [ev.evidenceType],
      });

      // Verification for observation steps if criteria exist
      if (step.successCriteria && step.successCriteria.length > 0) {
        incidentRepository.updateIncident(incident.id, { status: "VERIFYING" });
        const verifierResult = await this.verifier.verifyStep({
          incidentId: incident.id,
          contractStepId: step.id,
          successCriteria: step.successCriteria,
          adapter,
        });

        incidentRepository.recordEvent(incident.id, "VERIFICATION_RUN", {
          overallStatus: verifierResult.overallStatus,
          durationMs: verifierResult.durationMs,
          negativeEvidence: verifierResult.negativeEvidenceDetected,
          probesCount: verifierResult.details.length,
        });

        const target = verifierResult.overallStatus === "PASS" ? step.onSuccess : step.onFailure;
        incidentRepository.recordEvent(incident.id, "BRANCH_PROGRESSION", {
          fromStep: step.id,
          toStep: target,
          result: verifierResult.overallStatus,
        });

        const now = new Date().toISOString();
        if (target === "RESOLVED") {
          incidentRepository.recordEvent(incident.id, "INCIDENT_RESOLVED", {
            resolvedAt: now,
          });
        }

        const updated = incidentRepository.updateIncident(incident.id, {
          currentStepId: target,
          status: target === "RESOLVED" ? "VERIFIED_RECOVERY" : "REMEDIATING",
          resolvedAt: target === "RESOLVED" ? now : null,
        });

        return {
          status: target === "RESOLVED" ? "RESOLVED" : "STEP_COMPLETED",
          incident: updated,
          stepId: step.id,
          nextStepId: target,
          verifierResult,
        };
      }

      // Observation without criteria advances automatically to onSuccess
      incidentRepository.recordEvent(incident.id, "BRANCH_PROGRESSION", {
        fromStep: step.id,
        toStep: step.onSuccess,
      });

      const updated = incidentRepository.updateIncident(incident.id, {
        currentStepId: step.onSuccess,
        status: "INVESTIGATING",
      });

      return {
        status: "STEP_COMPLETED",
        incident: updated,
        stepId: step.id,
        nextStepId: step.onSuccess,
      };
    }

    // 2. Mutation Tools: Proof-Carrying Action + Safety Kernel evaluation
    incidentRepository.updateIncident(incident.id, { status: "REMEDIATING", currentStepId: step.id });

    // Collect fresh supporting evidence from repository for target
    let existingEvidence = evidenceRepository.listEvidence({ incidentId: incident.id });
    if (existingEvidence.length === 0) {
      // Gather baseline observation to ground the action in verified evidence
      const baselineHealth = await adapter.getServiceHealth(step.targetResource);
      const ev = normalizeToolOutputToEvidence(
        "get_service_health",
        baselineHealth,
        {
          environment: incident.environment as TargetEnvironment,
          targetResource: step.targetResource,
          incidentId: incident.id,
        }
      );
      evidenceRepository.saveEvidence(ev);
      existingEvidence = [ev];

      // If step requires database health and none exists, gather baseline db health
      if (
        step.evidenceRequirements?.some((r) => r.evidenceType === "DATABASE_HEALTH") &&
        typeof adapter.getDatabaseHealth === "function"
      ) {
        const dbHealth = await adapter.getDatabaseHealth("postgres");
        const evDb = normalizeToolOutputToEvidence(
          "get_database_health",
          dbHealth,
          {
            environment: incident.environment as TargetEnvironment,
            targetResource: "postgres",
            incidentId: incident.id,
          }
        );
        evidenceRepository.saveEvidence(evDb);
        existingEvidence.push(evDb);
      }
    }
    const supportingIds = existingEvidence.map((e) => e.id);

    // Confidence-based abstention check (FR-033, TR-011: Confidence < 0.70 halts mutation loop)
    const confidence = options?.confidenceScore ?? 0.95;
    if (options?.forceAbstain || confidence < 0.70) {
      const reason =
        options?.abstainReason ||
        `Autonomous action halted: Diagnostic confidence score (${confidence.toFixed(2)}) is below 0.70 safety threshold. Evidence is ambiguous or contradictory. Prohibiting blind mutations. Escalating to human SRE.`;
      return this.abstainIncident(incident.id, reason, confidence);
    }

    // Build Proof-Carrying Action with cryptographic fingerprint
    const pca = buildProofCarryingAction(
      {
        incidentId: incident.id,
        contractId: contract.id,
        stepId: step.id,
        toolName: step.toolName,
        toolArguments: step.defaultArguments,
        justificationSummary: `Executing runbook step ${step.id}: ${step.title}`,
        confidenceScore: confidence,
        supportingEvidenceIds: supportingIds,
      },
      step
    );

    this.actionRepo.saveAction(pca);

    incidentRepository.recordEvent(incident.id, "ACTION_PROPOSED", {
      actionId: pca.id,
      payloadHash: pca.payloadHash,
      riskTier: pca.riskTier,
      isReversible: pca.isReversible,
    });

    // Evaluate via Safety Kernel
    const decision = this.safetyKernel.evaluateAction(pca);
    incidentRepository.recordEvent(incident.id, "SAFETY_EVALUATED", {
      actionId: pca.id,
      decision: decision.policyDecision,
      reasonCode: decision.reasonCode,
      matchedRule: decision.matchedRule,
    });

    // High-Risk / Approval Checkpoint: PAUSE for human confirmation
    if (decision.policyDecision === "APPROVAL_REQUIRED") {
      incidentRepository.recordEvent(incident.id, "APPROVAL_REQUESTED", {
        actionId: pca.id,
        payloadHash: pca.payloadHash,
        riskTier: pca.riskTier,
        stepId: step.id,
      });

      return {
        status: "PAUSED_FOR_APPROVAL",
        incident,
        stepId: step.id,
        actionId: pca.id,
        payloadHash: pca.payloadHash,
      };
    }

    // Blocked by safety policy: branch to onFailure
    if (decision.policyDecision === "BLOCKED") {
      incidentRepository.recordEvent(incident.id, "ACTION_FAILED", {
        actionId: pca.id,
        reason: decision.reasonMessage,
      });

      incidentRepository.recordEvent(incident.id, "BRANCH_PROGRESSION", {
        fromStep: step.id,
        toStep: step.onFailure,
        reason: "Safety policy blocked execution",
      });

      const updated = incidentRepository.updateIncident(incident.id, {
        currentStepId: step.onFailure,
        status: step.onFailure === "ESCALATED" ? "ESCALATED" : "REMEDIATING",
      });

      return {
        status: "BLOCKED",
        incident: updated,
        stepId: step.id,
        nextStepId: step.onFailure,
        reason: decision.reasonMessage,
      };
    }

    // Auto-Allowed Autonomous Reversible Step: Execute & Independently Verify
    return await this.executeMutationAndVerify(incident, step, pca, adapter);
  }

  public async resumeWithApproval(
    incidentId: string,
    actionId: string,
    approvalData: {
      approvedBy: string;
      payloadHash: string;
      operatorNote?: string;
    },
    adapterOverride?: InfrastructureAdapter
  ): Promise<StepExecutionResult> {
    const incident = incidentRepository.getIncident(incidentId);
    if (!incident) {
      throw new Error(`Incident '${incidentId}' not found.`);
    }

    const pca = this.actionRepo.getActionById(actionId);
    if (!pca) {
      throw new Error(`Action '${actionId}' not found.`);
    }

    const contractRecord = runbookRepository.getContract(pca.contractId);
    if (!contractRecord) {
      throw new Error(`Contract '${pca.contractId}' not found.`);
    }

    const contract: RecoveryContract = JSON.parse(contractRecord.contract_payload);
    const step = contract.steps.find((s) => s.id === pca.stepId);
    if (!step) {
      throw new Error(`Step '${pca.stepId}' not found.`);
    }

    const adapter = adapterOverride || getInfrastructureAdapter(incident.environment as TargetEnvironment);

    // Operator Approval Submission (exact fingerprint binding)
    const approvalResult = this.approvalService.approveAction({
      actionId,
      operatorId: approvalData.approvedBy,
      payloadHash: approvalData.payloadHash,
      operatorNote: approvalData.operatorNote || "Human operator approved high-risk remediation",
    });

    if (!approvalResult.success) {
      throw new Error(`Failed to approve action '${actionId}': ${approvalResult.error}`);
    }

    incidentRepository.recordEvent(incident.id, "APPROVAL_GRANTED", {
      actionId,
      approvedBy: approvalData.approvedBy,
      payloadHash: approvalData.payloadHash,
    });

    return await this.executeMutationAndVerify(incident, step, pca, adapter);
  }

  private async executeMutationAndVerify(
    incident: IncidentRecord,
    step: RecoveryContractStep,
    pca: any,
    adapter: InfrastructureAdapter
  ): Promise<StepExecutionResult> {
    // 1. Claim atomic execution token
    const claim = this.executionAuthorizer.claimExecution(pca.id);
    if (!claim.claimed || !claim.executionToken) {
      throw new Error(`Failed to claim execution for action '${pca.id}': ${claim.reason}`);
    }

    const startTime = Date.now();
    let exitCode = 0;
    let errorMessage: string | undefined;
    let rawOutput: any;

    try {
      rawOutput = await this.executeTool(pca.toolName, pca.toolArguments, adapter);
    } catch (err: any) {
      exitCode = 1;
      errorMessage = err.message;
    }

    const durationMs = Date.now() - startTime;
    this.executionAuthorizer.recordExecutionResult(pca.id, claim.executionToken, {
      exitCode,
      durationMs,
      rawOutputExcerpt: rawOutput ? JSON.stringify(rawOutput).slice(0, 500) : undefined,
      errorMessage,
    });

    incidentRepository.recordEvent(incident.id, "ACTION_EXECUTED", {
      actionId: pca.id,
      toolName: pca.toolName,
      exitCode,
      durationMs,
      technicalStatus: rawOutput?.technicalStatus || (exitCode === 0 ? "SUCCESS" : "FAILURE"),
    });

    // Invariant: Technical success is NEVER proof of business recovery.
    // Transition to VERIFYING state and invoke Independent Verifier.
    incidentRepository.updateIncident(incident.id, { status: "VERIFYING" });

    const verifierResult = await this.verifier.verifyStep({
      incidentId: incident.id,
      contractStepId: step.id,
      actionId: pca.id,
      successCriteria: step.successCriteria,
      adapter,
    });

    incidentRepository.recordEvent(incident.id, "VERIFICATION_RUN", {
      overallStatus: verifierResult.overallStatus,
      durationMs: verifierResult.durationMs,
      negativeEvidence: verifierResult.negativeEvidenceDetected,
      probesCount: verifierResult.details.length,
    });

    // Branch progression based strictly on Independent Verifier result
    if (verifierResult.overallStatus === "PASS") {
      const nextStep = step.onSuccess;
      incidentRepository.recordEvent(incident.id, "BRANCH_PROGRESSION", {
        fromStep: step.id,
        toStep: nextStep,
        branch: "onSuccess",
        reason: "Verification passed all criteria",
      });

      if (nextStep === "RESOLVED") {
        const now = new Date().toISOString();
        const updated = incidentRepository.updateIncident(incident.id, {
          status: "VERIFIED_RECOVERY",
          currentStepId: "RESOLVED",
          resolvedAt: now,
        });
        incidentRepository.recordEvent(incident.id, "INCIDENT_RESOLVED", {
          resolvedAt: now,
        });
        return {
          status: "RESOLVED",
          incident: updated,
          stepId: step.id,
          verifierResult,
        };
      }

      const updated = incidentRepository.updateIncident(incident.id, {
        currentStepId: nextStep,
        status: "REMEDIATING",
      });

      return {
        status: "STEP_COMPLETED",
        incident: updated,
        stepId: step.id,
        nextStepId: nextStep,
        verifierResult,
      };
    } else {
      // Verification failed or was unknown: record negative evidence & take onFailure branch
      const nextStep = step.onFailure;
      incidentRepository.recordEvent(incident.id, "BRANCH_PROGRESSION", {
        fromStep: step.id,
        toStep: nextStep,
        branch: "onFailure",
        reason: `Verification failed: overall status was ${verifierResult.overallStatus}`,
      });

      if (nextStep === "ESCALATED") {
        const updated = incidentRepository.updateIncident(incident.id, {
          status: "ESCALATED",
          currentStepId: "ESCALATED",
        });
        incidentRepository.recordEvent(incident.id, "INCIDENT_ESCALATED", {
          reason: "Step failure branched to ESCALATED",
        });
        return {
          status: "ESCALATED",
          incident: updated,
          stepId: step.id,
          verifierResult,
        };
      }

      const updated = incidentRepository.updateIncident(incident.id, {
        currentStepId: nextStep,
        status: "REMEDIATING",
      });

      return {
        status: "VERIFICATION_FAILED",
        incident: updated,
        stepId: step.id,
        nextStepId: nextStep,
        verifierResult,
      };
    }
  }

  private async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    adapter: InfrastructureAdapter
  ): Promise<any> {
    switch (toolName) {
      case "get_service_health":
        return await adapter.getServiceHealth((args.serviceId || args.target || "checkout-service") as string);
      case "get_recent_logs":
        return await adapter.getRecentLogs(
          (args.serviceId || "checkout-service") as string,
          Number(args.limit) || 50
        );
      case "get_database_health":
        return await adapter.getDatabaseHealth((args.databaseId || "postgres") as string);
      case "get_metrics":
        return await adapter.getMetrics((args.serviceId || "checkout-service") as string);
      case "get_deployment_state":
        return await adapter.getDeploymentState((args.serviceId || "checkout-service") as string);
      case "get_replica_state":
        return await adapter.getReplicaState(args.replicaId as string);
      case "get_dependencies":
        return await adapter.getDependencies(args.resourceId as string);
      case "run_synthetic_checkout":
        return await adapter.runSyntheticCheckout(
          (args.productId as string) || "prod-001",
          Number(args.quantity) || 1
        );
      case "restart_service":
        return await adapter.restartService(args.target as string);
      case "rollback_canary":
        return await adapter.rollbackCanary(
          args.serviceId as string,
          args.replicaId as string,
          args.targetVersion as string
        );
      case "rollback_full":
        return await adapter.rollbackFull(
          args.serviceId as string,
          args.targetVersion as string
        );
      default:
        throw new Error(`Unsupported tool execution in recovery orchestrator: '${toolName}'`);
    }
  }
}

export const recoveryOrchestrator = new RecoveryOrchestrator();

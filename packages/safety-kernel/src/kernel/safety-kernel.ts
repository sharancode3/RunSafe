import { randomUUID } from "node:crypto";
import { type CapabilityMode, getControlPlaneDb } from "@runsafe/shared";
import {
  type ProofCarryingAction,
  verifyActionFingerprint,
  ActionRepository,
} from "@runsafe/actions";
import { RunbookRepository } from "@runsafe/runbooks";
import {
  type SafetyPolicyDecision,
  SafetyPolicyDecisionSchema,
  type SafetyDecisionType,
  type ReasonCode,
} from "./safety-decision.js";
import { evaluateToolRiskPolicy } from "../policies/tool-risk-policy.js";
import { evaluateContractAuthorityPolicy } from "../policies/contract-authority-policy.js";
import { evaluateEvidencePolicy } from "../policies/evidence-policy.js";
import { evaluatePreconditionPolicy } from "../policies/precondition-policy.js";
import { evaluateBlastRadiusPolicy } from "../policies/blast-radius-policy.js";

export interface EvaluateActionOptions {
  mode?: CapabilityMode;
  runbookRepo?: RunbookRepository;
}

export class SafetyKernel {
  private runbookRepo: RunbookRepository;

  constructor(runbookRepo?: RunbookRepository) {
    this.runbookRepo = runbookRepo || new RunbookRepository();
  }

  public evaluateAction(
    action: ProofCarryingAction,
    options: EvaluateActionOptions = {}
  ): SafetyPolicyDecision {
    const mode = options.mode || "RECOVERY";
    const repo = options.runbookRepo || this.runbookRepo;

    let decisionType: SafetyDecisionType = "BLOCKED";
    let reasonCode: ReasonCode = "UNKNOWN_TOOL";
    let reasonMessage = "Evaluation started";
    let matchedRule = "DEFAULT_BLOCK";
    let preconditionsPassed = true;

    // Ensure action exists in repository so foreign key constraints are satisfied
    const db = getControlPlaneDb();
    const existing = db.prepare("SELECT id FROM proof_carrying_actions WHERE id = ?").get(action.id);
    if (!existing) {
      new ActionRepository().saveAction(action);
    }

    // 1. Verify Cryptographic Action Fingerprint
    const fingerprintValid = verifyActionFingerprint(action, action.payloadHash);
    if (!fingerprintValid) {
      return this.recordDecision({
        actionId: action.id,
        policyDecision: "BLOCKED",
        reasonCode: "FINGERPRINT_TAMPERED",
        reasonMessage: "Cryptographic action payload fingerprint mismatch. Payload may have been tampered with.",
        matchedRule: "RULE_ANTI_TAMPER",
        preconditionsPassed: false,
        checksSummary: {
          toolCheck: false,
          fingerprintCheck: false,
          contractCheck: false,
          evidenceCheck: false,
          preconditionCheck: false,
          details: { error: "Fingerprint verification failed" },
        },
      });
    }

    // 2. Evaluate Tool Risk & Capability Mode Policy
    const toolResult = evaluateToolRiskPolicy(action.toolName, mode);
    if (!toolResult.passed || !toolResult.toolRecord) {
      return this.recordDecision({
        actionId: action.id,
        policyDecision: "BLOCKED",
        reasonCode: toolResult.reasonCode || "UNKNOWN_TOOL",
        reasonMessage: toolResult.message || `Tool '${action.toolName}' evaluation failed.`,
        matchedRule: "RULE_TOOL_REGISTRY_CHECK",
        preconditionsPassed: false,
        checksSummary: {
          toolCheck: false,
          fingerprintCheck: true,
          contractCheck: false,
          evidenceCheck: false,
          preconditionCheck: false,
          details: { tool: action.toolName },
        },
      });
    }

    // 3. Evaluate Contract Authority Policy
    const contractResult = evaluateContractAuthorityPolicy(action, repo);
    if (!contractResult.passed || !contractResult.contract || !contractResult.step) {
      return this.recordDecision({
        actionId: action.id,
        policyDecision: "BLOCKED",
        reasonCode: contractResult.reasonCode || "CONTRACT_NOT_FOUND",
        reasonMessage: contractResult.message || "Contract authority check failed.",
        matchedRule: "RULE_CONTRACT_AUTHORITY",
        preconditionsPassed: false,
        checksSummary: {
          toolCheck: true,
          fingerprintCheck: true,
          contractCheck: false,
          evidenceCheck: false,
          preconditionCheck: false,
          details: { contractId: action.contractId, stepId: action.stepId },
        },
      });
    }

    // 4. Evaluate Confidence Threshold Gate (FR-033, TR-011: Confidence < 0.70 prohibits blind mutations)
    if (!toolResult.toolRecord.readOnly && action.confidenceScore < 0.70) {
      return this.recordDecision({
        actionId: action.id,
        policyDecision: "BLOCKED",
        reasonCode: "CONFIDENCE_BELOW_THRESHOLD",
        reasonMessage: `Action confidence score (${action.confidenceScore.toFixed(2)}) is below 0.70 safety threshold. Prohibiting blind mutations.`,
        matchedRule: "RULE_CONFIDENCE_THRESHOLD_GATE",
        preconditionsPassed: false,
        checksSummary: {
          toolCheck: true,
          fingerprintCheck: true,
          contractCheck: true,
          evidenceCheck: false,
          preconditionCheck: false,
          details: { confidenceScore: action.confidenceScore, threshold: 0.70 },
        },
      });
    }

    // 5. Evaluate Supporting Evidence Freshness & Sufficiency Policy
    const evidenceResult = evaluateEvidencePolicy(action, contractResult.step);
    if (!evidenceResult.passed) {
      return this.recordDecision({
        actionId: action.id,
        policyDecision: "BLOCKED",
        reasonCode: evidenceResult.reasonCode || "MISSING_SUPPORTING_EVIDENCE",
        reasonMessage: evidenceResult.message || "Evidence verification failed.",
        matchedRule: "RULE_EVIDENCE_FRESHNESS_AND_SUFFICIENCY",
        preconditionsPassed: false,
        checksSummary: {
          toolCheck: true,
          fingerprintCheck: true,
          contractCheck: true,
          evidenceCheck: false,
          preconditionCheck: false,
          details: { supportingIds: action.supportingEvidenceIds },
        },
      });
    }

    // 6. Evaluate Contract Preconditions
    const preconditionResult = evaluatePreconditionPolicy(
      contractResult.step,
      evidenceResult.evidenceRecords
    );
    if (!preconditionResult.passed) {
      preconditionsPassed = false;
      return this.recordDecision({
        actionId: action.id,
        policyDecision: "BLOCKED",
        reasonCode: preconditionResult.reasonCode || "PRECONDITION_FAILED",
        reasonMessage: preconditionResult.message || "Contract preconditions were not satisfied.",
        matchedRule: "RULE_CONTRACT_PRECONDITIONS",
        preconditionsPassed: false,
        checksSummary: {
          toolCheck: true,
          fingerprintCheck: true,
          contractCheck: true,
          evidenceCheck: true,
          preconditionCheck: false,
          details: { preconditions: preconditionResult.evaluatedPreconditions },
        },
      });
    }

    // 7. Evaluate Blast Radius
    const blastResult = evaluateBlastRadiusPolicy(action);
    if (!blastResult.passed) {
      return this.recordDecision({
        actionId: action.id,
        policyDecision: "BLOCKED",
        reasonCode: blastResult.reasonCode || "INVALID_ACTION_STATE",
        reasonMessage: blastResult.message || "Blast radius evaluation failed.",
        matchedRule: "RULE_BLAST_RADIUS_LIMIT",
        preconditionsPassed: true,
        checksSummary: {
          toolCheck: true,
          fingerprintCheck: true,
          contractCheck: true,
          evidenceCheck: true,
          preconditionCheck: true,
          details: { blastRadius: action.blastRadius },
        },
      });
    }

    // 8. Authoritative Decision Mapping: Read-Only vs Autonomous Low-Risk vs Human Approval High-Risk
    const toolRecord = toolResult.toolRecord;
    const step = contractResult.step;

    if (toolRecord.readOnly) {
      decisionType = "AUTO_ALLOW";
      reasonCode = "READ_ONLY_OBSERVATION_ALLOWED";
      reasonMessage = `Tool '${action.toolName}' is read-only observation. Fast path auto-allowed.`;
      matchedRule = "RULE_OBSERVATION_AUTO_ALLOW";
    } else if (
      toolRecord.risk === "LOW_RISK_REVERSIBLE" &&
      step.requiresApproval === false &&
      toolRecord.reversible === true
    ) {
      decisionType = "AUTO_ALLOW";
      reasonCode = "AUTONOMOUS_LOW_RISK_APPROVED";
      reasonMessage = `Step '${step.id}' uses low-risk reversible tool '${action.toolName}'. Contract preconditions satisfied. Autonomous execution permitted.`;
      matchedRule = "RULE_AUTONOMOUS_REVERSIBLE_ALLOW";
    } else {
      // High-risk, destructive, or explicitly flagged requiresApproval
      decisionType = "APPROVAL_REQUIRED";
      reasonCode = step.requiresApproval
        ? "CONTRACT_STEP_REQUIRES_APPROVAL"
        : "HUMAN_APPROVAL_MANDATORY_HIGH_RISK";
      reasonMessage = `Action '${action.toolName}' on '${action.stepId}' requires human operator approval before execution. (Risk: ${toolRecord.risk}, StepApproval: ${step.requiresApproval})`;
      matchedRule = "RULE_HUMAN_APPROVAL_CHECKPOINT";
    }

    const decision = this.recordDecision({
      actionId: action.id,
      policyDecision: decisionType,
      reasonCode,
      reasonMessage,
      matchedRule,
      preconditionsPassed: true,
      checksSummary: {
        toolCheck: true,
        fingerprintCheck: true,
        contractCheck: true,
        evidenceCheck: true,
        preconditionCheck: true,
        details: {
          riskTier: toolRecord.risk,
          isReversible: toolRecord.reversible,
          requiresApproval: step.requiresApproval,
          preconditions: preconditionResult.evaluatedPreconditions,
        },
      },
    });

    // If APPROVAL_REQUIRED, ensure an approval_request record is registered
    if (decisionType === "APPROVAL_REQUIRED") {
      this.ensureApprovalRequest(action);
    }

    return decision;
  }

  private recordDecision(data: {
    actionId: string;
    policyDecision: SafetyDecisionType;
    reasonCode: ReasonCode;
    reasonMessage: string;
    matchedRule: string;
    preconditionsPassed: boolean;
    checksSummary: any;
  }): SafetyPolicyDecision {
    const id = `spd_${randomUUID()}`;
    const evaluatedAt = new Date().toISOString();

    const decision: SafetyPolicyDecision = SafetyPolicyDecisionSchema.parse({
      id,
      actionId: data.actionId,
      policyDecision: data.policyDecision,
      reasonCode: data.reasonCode,
      reasonMessage: data.reasonMessage,
      matchedRule: data.matchedRule,
      preconditionsPassed: data.preconditionsPassed,
      checksSummary: data.checksSummary,
      evaluatedAt,
    });

    const db = getControlPlaneDb();
    const stmt = db.prepare(`
      INSERT INTO safety_policy_decisions (
        id, action_id, policy_decision, reason_code, reason_message,
        matched_rule, preconditions_passed, checks_summary, evaluated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      decision.id,
      decision.actionId,
      decision.policyDecision,
      decision.reasonCode,
      decision.reasonMessage,
      decision.matchedRule,
      decision.preconditionsPassed ? 1 : 0,
      JSON.stringify(decision.checksSummary),
      decision.evaluatedAt
    );

    return decision;
  }

  private ensureApprovalRequest(action: ProofCarryingAction): void {
    const db = getControlPlaneDb();
    const existing = db.prepare("SELECT id FROM approval_requests WHERE action_id = ?").get(action.id);
    if (!existing) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // 15 mins expiry
      const reqId = `appr_${randomUUID()}`;

      const stmt = db.prepare(`
        INSERT INTO approval_requests (
          id, action_id, payload_hash, status, expires_at, created_at
        ) VALUES (?, ?, ?, 'PENDING', ?, ?)
      `);
      stmt.run(reqId, action.id, action.payloadHash, expiresAt, now.toISOString());
    }
  }

  public getDecisionForAction(actionId: string): SafetyPolicyDecision | null {
    const db = getControlPlaneDb();
    const stmt = db.prepare(
      "SELECT * FROM safety_policy_decisions WHERE action_id = ? ORDER BY evaluated_at DESC LIMIT 1"
    );
    const row = stmt.get(actionId) as any;
    if (!row) return null;

    return SafetyPolicyDecisionSchema.parse({
      id: row.id,
      actionId: row.action_id,
      policyDecision: row.policy_decision,
      reasonCode: row.reason_code,
      reasonMessage: row.reason_message,
      matchedRule: row.matched_rule,
      preconditionsPassed: Number(row.preconditions_passed) === 1,
      checksSummary: JSON.parse(row.checks_summary || "{}"),
      evaluatedAt: row.evaluated_at,
    });
  }
}

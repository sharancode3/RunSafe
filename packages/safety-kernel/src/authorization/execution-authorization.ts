import { randomUUID } from "node:crypto";
import { getControlPlaneDb } from "@runsafe/shared";
import { ActionRepository, type ProofCarryingAction } from "@runsafe/actions";
import { SafetyKernel } from "../kernel/safety-kernel.js";
import { type ToolExecutionRecord, ToolExecutionRecordSchema } from "../kernel/safety-decision.js";

export interface ClaimExecutionResult {
  claimed: boolean;
  executionToken?: string;
  executionId?: string;
  reason?: string;
}

export class ExecutionAuthorizer {
  private actionRepo = new ActionRepository();
  private safetyKernel = new SafetyKernel();

  /**
   * Atomically claims an action for execution.
   * Enforces:
   * 1. Action exists and is in a valid runnable state (PROPOSED for AUTO_ALLOW, or APPROVED for human checkpoint).
   * 2. Atomic state transition to 'EXECUTING' prevents duplicate concurrent execution (double-clicks, race conditions).
   * 3. Issues a single-use cryptographically random execution token.
   */
  public claimExecution(actionId: string): ClaimExecutionResult {
    const action = this.actionRepo.getActionById(actionId);
    if (!action) {
      return { claimed: false, reason: `Action '${actionId}' not found.` };
    }

    if (action.status === "EXECUTING") {
      return {
        claimed: false,
        reason: `DUPLICATE_EXECUTION_BLOCKED: Action '${actionId}' is already currently EXECUTING.`,
      };
    }

    if (action.status === "EXECUTED") {
      return {
        claimed: false,
        reason: `DUPLICATE_EXECUTION_BLOCKED: Action '${actionId}' has already been EXECUTED. Actions are strictly single-use.`,
      };
    }

    // Check safety decision
    const decision = this.safetyKernel.getDecisionForAction(actionId);
    if (!decision) {
      return { claimed: false, reason: "Action has not been evaluated by Safety Kernel." };
    }

    if (decision.policyDecision === "BLOCKED") {
      return {
        claimed: false,
        reason: `SAFETY_POLICY_BLOCKED: Action is blocked: ${decision.reasonMessage}`,
      };
    }

    // If APPROVAL_REQUIRED, must be explicitly APPROVED
    if (decision.policyDecision === "APPROVAL_REQUIRED" && action.status !== "APPROVED") {
      return {
        claimed: false,
        reason: "HUMAN_APPROVAL_PENDING: Action requires explicit operator approval before execution.",
      };
    }

    // Determine allowed pre-execution states
    const allowedStates = decision.policyDecision === "AUTO_ALLOW"
      ? ["PROPOSED", "EVALUATED"]
      : ["APPROVED"];

    // Atomic claim transition: updates to EXECUTING only if currently in allowedStates
    const claimed = this.actionRepo.updateActionStatus(actionId, "EXECUTING", allowedStates as any);
    if (!claimed) {
      return {
        claimed: false,
        reason: `CONFLICT_CANNOT_CLAIM: Action '${actionId}' is not in a claimable state (allowed: ${allowedStates.join(", ")}).`,
      };
    }

    // Issue unique single-use execution token
    const executionToken = `token_${randomUUID()}`;
    const executionId = `exec_${randomUUID()}`;
    const now = new Date().toISOString();

    const db = getControlPlaneDb();
    const stmt = db.prepare(`
      INSERT INTO tool_executions (
        id, action_id, incident_id, tool_name, arguments_snapshot,
        execution_token, status, executed_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `);

    stmt.run(
      executionId,
      action.id,
      action.incidentId,
      action.toolName,
      JSON.stringify(action.toolArguments),
      executionToken,
      now
    );

    return {
      claimed: true,
      executionToken,
      executionId,
    };
  }

  /**
   * Records the technical execution result and updates the action status to EXECUTED or FAILED.
   * Note: Technical success (exitCode === 0) does NOT declare business recovery.
   */
  public recordExecutionResult(
    actionId: string,
    executionToken: string,
    result: {
      exitCode: number;
      durationMs: number;
      rawOutputExcerpt?: string;
      errorMessage?: string;
    }
  ): void {
    const db = getControlPlaneDb();
    const isSuccess = result.exitCode === 0 && !result.errorMessage;
    const finalStatus = isSuccess ? "SUCCESS" : "FAILURE";

    const stmt = db.prepare(`
      UPDATE tool_executions
      SET status = ?, exit_code = ?, duration_ms = ?, raw_output_excerpt = ?, error_message = ?
      WHERE action_id = ? AND execution_token = ?
    `);

    stmt.run(
      finalStatus,
      result.exitCode,
      result.durationMs,
      result.rawOutputExcerpt || null,
      result.errorMessage || null,
      actionId,
      executionToken
    );

    // Update action status: EXECUTED on technical success, FAILED on error
    this.actionRepo.updateActionStatus(actionId, isSuccess ? "EXECUTED" : "FAILED", "EXECUTING");
  }

  public getExecutionRecordByToken(executionToken: string): ToolExecutionRecord | null {
    const db = getControlPlaneDb();
    const stmt = db.prepare("SELECT * FROM tool_executions WHERE execution_token = ?");
    const row = stmt.get(executionToken) as any;
    if (!row) return null;

    return ToolExecutionRecordSchema.parse({
      id: row.id,
      actionId: row.action_id,
      incidentId: row.incident_id,
      toolName: row.tool_name,
      argumentsSnapshot: JSON.parse(row.arguments_snapshot || "{}"),
      executionToken: row.execution_token,
      status: row.status,
      exitCode: row.exit_code,
      durationMs: row.duration_ms,
      rawOutputExcerpt: row.raw_output_excerpt,
      errorMessage: row.error_message,
      executedAt: row.executed_at,
    });
  }

  public getExecutionsForAction(actionId: string): ToolExecutionRecord[] {
    const db = getControlPlaneDb();
    const stmt = db.prepare("SELECT * FROM tool_executions WHERE action_id = ? ORDER BY executed_at DESC");
    const rows = stmt.all(actionId) as any[];

    return rows.map((row) =>
      ToolExecutionRecordSchema.parse({
        id: row.id,
        actionId: row.action_id,
        incidentId: row.incident_id,
        toolName: row.tool_name,
        argumentsSnapshot: JSON.parse(row.arguments_snapshot || "{}"),
        executionToken: row.execution_token,
        status: row.status,
        exitCode: row.exit_code,
        durationMs: row.duration_ms,
        rawOutputExcerpt: row.raw_output_excerpt,
        errorMessage: row.error_message,
        executedAt: row.executed_at,
      })
    );
  }
}

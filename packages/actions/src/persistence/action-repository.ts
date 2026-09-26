import { getControlPlaneDb } from "@runsafe/shared";
import {
  type ProofCarryingAction,
  ProofCarryingActionSchema,
  type ActionStatus,
} from "../domain/proof-carrying-action.js";

export class ActionRepository {
  public saveAction(action: ProofCarryingAction): void {
    const db = getControlPlaneDb();
    const stmt = db.prepare(`
      INSERT INTO proof_carrying_actions (
        id, incident_id, contract_id, step_id, tool_name, tool_arguments,
        payload_hash, justification_summary, confidence_score, supporting_evidence_ids,
        risk_tier, blast_radius, is_reversible, rollback_procedure,
        verification_criteria, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        tool_arguments = excluded.tool_arguments,
        payload_hash = excluded.payload_hash,
        justification_summary = excluded.justification_summary,
        confidence_score = excluded.confidence_score,
        supporting_evidence_ids = excluded.supporting_evidence_ids,
        risk_tier = excluded.risk_tier,
        blast_radius = excluded.blast_radius,
        is_reversible = excluded.is_reversible,
        rollback_procedure = excluded.rollback_procedure,
        verification_criteria = excluded.verification_criteria,
        status = excluded.status,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      action.id,
      action.incidentId,
      action.contractId,
      action.stepId,
      action.toolName,
      JSON.stringify(action.toolArguments),
      action.payloadHash,
      action.justificationSummary,
      action.confidenceScore,
      JSON.stringify(action.supportingEvidenceIds),
      action.riskTier,
      typeof action.blastRadius === "object" ? JSON.stringify(action.blastRadius) : String(action.blastRadius ?? "SINGLE_REPLICA"),
      action.isReversible ? 1 : 0,
      action.rollbackProcedure ?? null,
      JSON.stringify(action.verificationCriteria ?? []),
      action.status,
      action.createdAt,
      action.updatedAt
    );
  }

  public getActionById(id: string): ProofCarryingAction | null {
    const db = getControlPlaneDb();
    const stmt = db.prepare("SELECT * FROM proof_carrying_actions WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return this.mapRowToAction(row);
  }

  public getActionsByIncident(incidentId: string): ProofCarryingAction[] {
    const db = getControlPlaneDb();
    const stmt = db.prepare(
      "SELECT * FROM proof_carrying_actions WHERE incident_id = ? ORDER BY created_at ASC"
    );
    const rows = stmt.all(incidentId) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapRowToAction(r));
  }

  /**
   * Atomically updates status only if the current status matches the expected current status(es).
   * Prevents race conditions, double execution, or invalid transitions.
   */
  public updateActionStatus(
    id: string,
    newStatus: ActionStatus,
    expectedCurrentStatus?: ActionStatus | ActionStatus[]
  ): boolean {
    const db = getControlPlaneDb();
    const now = new Date().toISOString();

    if (!expectedCurrentStatus) {
      const stmt = db.prepare(
        "UPDATE proof_carrying_actions SET status = ?, updated_at = ? WHERE id = ?"
      );
      const res = stmt.run(newStatus, now, id);
      return res.changes > 0;
    }

    const expectedArr = Array.isArray(expectedCurrentStatus)
      ? expectedCurrentStatus
      : [expectedCurrentStatus];
    const placeholders = expectedArr.map(() => "?").join(", ");

    const stmt = db.prepare(`
      UPDATE proof_carrying_actions
      SET status = ?, updated_at = ?
      WHERE id = ? AND status IN (${placeholders})
    `);

    const res = stmt.run(newStatus, now, id, ...expectedArr);
    return res.changes > 0;
  }

  private mapRowToAction(row: Record<string, unknown>): ProofCarryingAction {
    return ProofCarryingActionSchema.parse({
      id: row.id,
      incidentId: row.incident_id,
      contractId: row.contract_id,
      stepId: row.step_id,
      toolName: row.tool_name,
      toolArguments: JSON.parse((row.tool_arguments as string) || "{}"),
      payloadHash: row.payload_hash,
      justificationSummary: row.justification_summary,
      confidenceScore: Number(row.confidence_score),
      supportingEvidenceIds: JSON.parse((row.supporting_evidence_ids as string) || "[]"),
      riskTier: row.risk_tier,
      blastRadius: row.blast_radius,
      isReversible: Number(row.is_reversible) === 1,
      rollbackProcedure: row.rollback_procedure ?? null,
      verificationCriteria: JSON.parse((row.verification_criteria as string) || "[]"),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}

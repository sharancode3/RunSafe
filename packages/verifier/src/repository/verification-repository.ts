import { getControlPlaneDb } from "@runsafe/shared";
import { type VerificationRun, VerificationRunSchema } from "../schemas.js";

export class VerificationRepository {
  private db = getControlPlaneDb();

  public saveVerificationRun(run: VerificationRun): VerificationRun {
    const validated = VerificationRunSchema.parse(run);

    const stmt = this.db.prepare(`
      INSERT INTO verification_runs (
        id, incident_id, action_id, contract_step_id, overall_status, details, duration_ms, verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        overall_status = excluded.overall_status,
        details = excluded.details,
        duration_ms = excluded.duration_ms,
        verified_at = excluded.verified_at
      RETURNING *
    `);

    stmt.run(
      validated.id,
      validated.incidentId,
      validated.actionId || null,
      validated.contractStepId,
      validated.overallStatus,
      JSON.stringify(validated.details),
      validated.durationMs,
      validated.verifiedAt
    );

    return validated;
  }

  public getVerificationRun(id: string): VerificationRun | null {
    const stmt = this.db.prepare("SELECT * FROM verification_runs WHERE id = ?");
    const row = stmt.get(id) as any;
    if (!row) return null;

    return VerificationRunSchema.parse({
      id: row.id,
      incidentId: row.incident_id,
      actionId: row.action_id,
      contractStepId: row.contract_step_id,
      overallStatus: row.overall_status,
      details: JSON.parse(row.details || "[]"),
      durationMs: row.duration_ms,
      verifiedAt: row.verified_at,
    });
  }

  public getRunsForIncident(incidentId: string): VerificationRun[] {
    const stmt = this.db.prepare(
      "SELECT * FROM verification_runs WHERE incident_id = ? ORDER BY verified_at ASC"
    );
    const rows = stmt.all(incidentId) as any[];

    return rows.map((row) =>
      VerificationRunSchema.parse({
        id: row.id,
        incidentId: row.incident_id,
        actionId: row.action_id,
        contractStepId: row.contract_step_id,
        overallStatus: row.overall_status,
        details: JSON.parse(row.details || "[]"),
        durationMs: row.duration_ms,
        verifiedAt: row.verified_at,
      })
    );
  }
}

export const verificationRepository = new VerificationRepository();

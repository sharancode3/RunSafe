import { getControlPlaneDb } from "@runsafe/shared";
import {
  type RehearsalScenario,
  type RehearsalRunRecord,
  RehearsalScenarioSchema,
  RehearsalRunRecordSchema,
} from "./rehearsal-schemas.js";

export class RehearsalRepository {
  private get db() {
    return getControlPlaneDb();
  }

  public getScenarios(): RehearsalScenario[] {
    const rows = this.db.prepare("SELECT * FROM rehearsal_scenarios").all() as any[];
    return rows.map((r) =>
      RehearsalScenarioSchema.parse({
        id: r.id,
        name: r.name,
        description: r.description,
        targetService: r.target_service,
        faultType: r.fault_type,
        expectedRecoveryTool: r.expected_recovery_tool,
        expectedOutcome: r.expected_outcome,
      })
    );
  }

  public getScenarioById(id: string): RehearsalScenario | null {
    const row = this.db.prepare("SELECT * FROM rehearsal_scenarios WHERE id = ?").get(id) as any;
    if (!row) return null;
    return RehearsalScenarioSchema.parse({
      id: row.id,
      name: row.name,
      description: row.description,
      targetService: row.target_service,
      faultType: row.fault_type,
      expectedRecoveryTool: row.expected_recovery_tool,
      expectedOutcome: row.expected_outcome,
    });
  }

  public saveRehearsalRun(run: RehearsalRunRecord): RehearsalRunRecord {
    const validated = RehearsalRunRecordSchema.parse(run);
    const stmt = this.db.prepare(`
      INSERT INTO rehearsal_runs (
        id, scenario_id, contract_id, incident_id, target_environment, outcome, duration_ms, details, executed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      validated.id,
      validated.scenarioId,
      validated.contractId,
      validated.incidentId ?? null,
      validated.targetEnvironment,
      validated.outcome,
      validated.durationMs,
      JSON.stringify(validated.details),
      validated.executedAt
    );

    return validated;
  }

  public listRehearsalRuns(limit = 50): RehearsalRunRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM rehearsal_runs ORDER BY executed_at DESC LIMIT ?")
      .all(limit) as any[];

    return rows.map((r) =>
      RehearsalRunRecordSchema.parse({
        id: r.id,
        scenarioId: r.scenario_id,
        contractId: r.contract_id,
        incidentId: r.incident_id,
        targetEnvironment: r.target_environment,
        outcome: r.outcome,
        durationMs: r.duration_ms,
        details: JSON.parse(r.details || "{}"),
        executedAt: r.executed_at,
      })
    );
  }

  public getRehearsalRun(id: string): RehearsalRunRecord | null {
    const row = this.db.prepare("SELECT * FROM rehearsal_runs WHERE id = ?").get(id) as any;
    if (!row) return null;

    return RehearsalRunRecordSchema.parse({
      id: row.id,
      scenarioId: row.scenario_id,
      contractId: row.contract_id,
      incidentId: row.incident_id,
      targetEnvironment: row.target_environment,
      outcome: row.outcome,
      durationMs: row.duration_ms,
      details: JSON.parse(row.details || "{}"),
      executedAt: row.executed_at,
    });
  }
}

export const rehearsalRepository = new RehearsalRepository();

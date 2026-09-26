import { randomUUID } from "node:crypto";
import { getControlPlaneDb, TargetEnvironment } from "@runsafe/shared";
import {
  type IncidentRecord,
  IncidentRecordSchema,
  type IncidentStatus,
  type IncidentEvent,
  type IncidentEventType,
  IncidentEventSchema,
} from "../schemas.js";

export class IncidentRepository {
  private db = getControlPlaneDb();

  public createIncident(data: {
    id?: string;
    title: string;
    targetService: string;
    environment?: TargetEnvironment;
    activeContractId?: string;
    currentStepId?: string;
  }): IncidentRecord {
    const id = data.id || `inc_${randomUUID()}`;
    const now = new Date().toISOString();
    const env = data.environment || "LOCAL";

    const stmt = this.db.prepare(`
      INSERT INTO incidents (
        id, title, target_service, environment, status,
        active_contract_id, current_step_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, 'DETECTED', ?, ?, ?, ?)
      RETURNING *
    `);

    const row = stmt.get(
      id,
      data.title,
      data.targetService,
      env,
      data.activeContractId || null,
      data.currentStepId || null,
      now,
      now
    ) as any;

    this.recordEvent(id, "INCIDENT_DETECTED", {
      title: data.title,
      targetService: data.targetService,
      environment: env,
      activeContractId: data.activeContractId,
    });

    return this.mapRowToIncident(row);
  }

  public getIncident(id: string): IncidentRecord | null {
    const stmt = this.db.prepare("SELECT * FROM incidents WHERE id = ?");
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapRowToIncident(row);
  }

  public updateIncident(
    id: string,
    updates: {
      status?: IncidentStatus;
      currentStepId?: string | null;
      activeContractId?: string | null;
      resolvedAt?: string | null;
    }
  ): IncidentRecord {
    const current = this.getIncident(id);
    if (!current) {
      throw new Error(`Incident '${id}' not found`);
    }

    const now = new Date().toISOString();
    const newStatus = updates.status !== undefined ? updates.status : current.status;
    const newStepId = updates.currentStepId !== undefined ? updates.currentStepId : current.current_step_id;
    const newContractId = updates.activeContractId !== undefined ? updates.activeContractId : current.active_contract_id;
    const resolvedAt = updates.resolvedAt !== undefined ? updates.resolvedAt : current.resolved_at;

    const stmt = this.db.prepare(`
      UPDATE incidents
      SET status = ?, current_step_id = ?, active_contract_id = ?, resolved_at = ?, updated_at = ?
      WHERE id = ?
      RETURNING *
    `);

    const row = stmt.get(
      newStatus,
      newStepId ?? null,
      newContractId ?? null,
      resolvedAt ?? null,
      now,
      id
    ) as any;

    if (updates.status && updates.status !== current.status) {
      this.recordEvent(id, "STATE_TRANSITION", {
        from: current.status,
        to: updates.status,
        currentStepId: newStepId,
      });
    }

    return this.mapRowToIncident(row);
  }

  public listIncidents(filters: { status?: IncidentStatus; targetService?: string } = {}): IncidentRecord[] {
    let query = "SELECT * FROM incidents WHERE 1=1";
    const params: any[] = [];

    if (filters.status) {
      query += " AND status = ?";
      params.push(filters.status);
    }
    if (filters.targetService) {
      query += " AND target_service = ?";
      params.push(filters.targetService);
    }

    query += " ORDER BY created_at DESC";
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((r) => this.mapRowToIncident(r));
  }

  public recordEvent(
    incidentId: string,
    eventType: IncidentEventType,
    payload: Record<string, unknown>
  ): IncidentEvent {
    const id = `iev_${randomUUID()}`;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO incident_events (id, incident_id, event_type, payload, created_at)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);

    const row = stmt.get(id, incidentId, eventType, JSON.stringify(payload), now) as any;

    return IncidentEventSchema.parse({
      id: row.id,
      incident_id: row.incident_id,
      event_type: row.event_type,
      payload: JSON.parse(row.payload || "{}"),
      created_at: row.created_at,
    });
  }

  public getEvents(incidentId: string): IncidentEvent[] {
    const stmt = this.db.prepare(
      "SELECT * FROM incident_events WHERE incident_id = ? ORDER BY created_at ASC"
    );
    const rows = stmt.all(incidentId) as any[];

    return rows.map((r) =>
      IncidentEventSchema.parse({
        id: r.id,
        incident_id: r.incident_id,
        event_type: r.event_type,
        payload: JSON.parse(r.payload || "{}"),
        created_at: r.created_at,
      })
    );
  }

  private mapRowToIncident(row: any): IncidentRecord {
    return IncidentRecordSchema.parse({
      id: row.id,
      title: row.title,
      target_service: row.target_service,
      environment: row.environment,
      status: row.status,
      active_contract_id: row.active_contract_id,
      current_step_id: row.current_step_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      resolved_at: row.resolved_at,
    });
  }
}

export const incidentRepository = new IncidentRepository();

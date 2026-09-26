import { getControlPlaneDb } from "@runsafe/shared";
import type { EvidenceRecord, Hypothesis } from "../schemas.js";

export class EvidenceRepository {
  private db = getControlPlaneDb();

  public saveEvidence(evidence: EvidenceRecord): EvidenceRecord {
    const stmt = this.db.prepare(`
      INSERT INTO evidence (
        id, incident_id, environment, target_resource, evidence_type,
        source_type, source_tool, source_execution_id, observed_at,
        collected_at, summary, structured_value, bounded_raw_excerpt,
        freshness_status, derived, source_evidence_ids,
        sandbox_execution_id, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        freshness_status = excluded.freshness_status,
        summary = excluded.summary
      RETURNING *
    `);

    stmt.run(
      evidence.id,
      evidence.incidentId || null,
      evidence.environment,
      evidence.targetResource,
      evidence.evidenceType,
      evidence.sourceType,
      evidence.sourceTool,
      evidence.sourceExecutionId || null,
      evidence.observedAt,
      evidence.collectedAt,
      evidence.summary,
      JSON.stringify(evidence.structuredValue),
      evidence.boundedRawExcerpt || null,
      evidence.freshnessStatus,
      evidence.derived ? 1 : 0,
      JSON.stringify(evidence.sourceEvidenceIds || []),
      evidence.sandboxExecutionId || null,
      evidence.createdAt
    );

    return evidence;
  }

  public getEvidence(id: string): EvidenceRecord | null {
    const stmt = this.db.prepare("SELECT * FROM evidence WHERE id = ?");
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapRowToEvidence(row);
  }

  public listEvidence(filters: {
    incidentId?: string;
    targetResource?: string;
    evidenceType?: string;
  } = {}): EvidenceRecord[] {
    let query = "SELECT * FROM evidence WHERE 1=1";
    const params: any[] = [];

    if (filters.incidentId) {
      query += " AND incident_id = ?";
      params.push(filters.incidentId);
    }
    if (filters.targetResource) {
      query += " AND target_resource = ?";
      params.push(filters.targetResource);
    }
    if (filters.evidenceType) {
      query += " AND evidence_type = ?";
      params.push(filters.evidenceType);
    }

    query += " ORDER BY observed_at DESC";
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((r) => this.mapRowToEvidence(r));
  }

  public saveHypothesis(hypothesis: Hypothesis): Hypothesis {
    const stmt = this.db.prepare(`
      INSERT INTO hypotheses (
        id, context_id, statement, supporting_evidence_ids,
        contradicting_evidence_ids, missing_evidence_types,
        evidence_strength, model_provider, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        statement = excluded.statement,
        evidence_strength = excluded.evidence_strength
      RETURNING *
    `);

    stmt.run(
      hypothesis.id,
      hypothesis.contextId,
      hypothesis.statement,
      JSON.stringify(hypothesis.supportingEvidenceIds),
      JSON.stringify(hypothesis.contradictingEvidenceIds),
      JSON.stringify(hypothesis.missingEvidenceTypes),
      hypothesis.evidenceStrength,
      hypothesis.modelProvider,
      hypothesis.createdAt
    );

    return hypothesis;
  }

  public getHypothesis(id: string): Hypothesis | null {
    const stmt = this.db.prepare("SELECT * FROM hypotheses WHERE id = ?");
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapRowToHypothesis(row);
  }

  public listHypotheses(contextId?: string): Hypothesis[] {
    let query = "SELECT * FROM hypotheses";
    const params: any[] = [];
    if (contextId) {
      query += " WHERE context_id = ?";
      params.push(contextId);
    }
    query += " ORDER BY created_at DESC";
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((r) => this.mapRowToHypothesis(r));
  }

  private mapRowToEvidence(row: any): EvidenceRecord {
    return {
      id: row.id,
      incidentId: row.incident_id,
      environment: row.environment,
      targetResource: row.target_resource,
      evidenceType: row.evidence_type,
      sourceType: row.source_type,
      sourceTool: row.source_tool,
      sourceExecutionId: row.source_execution_id,
      observedAt: row.observed_at,
      collectedAt: row.collected_at,
      summary: row.summary,
      structuredValue: JSON.parse(row.structured_value || "{}"),
      boundedRawExcerpt: row.bounded_raw_excerpt,
      freshnessStatus: row.freshness_status,
      derived: Boolean(row.derived),
      sourceEvidenceIds: JSON.parse(row.source_evidence_ids || "[]"),
      sandboxExecutionId: row.sandbox_execution_id,
      createdAt: row.created_at,
    };
  }

  private mapRowToHypothesis(row: any): Hypothesis {
    return {
      id: row.id,
      contextId: row.context_id,
      statement: row.statement,
      supportingEvidenceIds: JSON.parse(row.supporting_evidence_ids || "[]"),
      contradictingEvidenceIds: JSON.parse(row.contradicting_evidence_ids || "[]"),
      missingEvidenceTypes: JSON.parse(row.missing_evidence_types || "[]"),
      evidenceStrength: row.evidence_strength,
      modelProvider: row.model_provider,
      createdAt: row.created_at,
    };
  }
}

export const evidenceRepository = new EvidenceRepository();

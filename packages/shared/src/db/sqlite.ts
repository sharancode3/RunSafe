import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

let globalDb: DatabaseSync | null = null;

export function getDatabasePath(): string {
  if (process.env.RUNSAFE_DB_PATH) {
    return process.env.RUNSAFE_DB_PATH;
  }
  const rootDir = process.cwd();
  const dataDir = path.join(rootDir, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, "runsafe.db");
}

export function initDatabase(dbPath?: string): DatabaseSync {
  const resolvedPath = dbPath || getDatabasePath();
  const db = new DatabaseSync(resolvedPath);

  // Set busy timeout first so SQLite waits on locks across processes/threads
  try {
    db.exec("PRAGMA busy_timeout = 5000;");
  } catch {}

  // Enable WAL mode and foreign keys for durability and relational safety
  try {
    db.exec("PRAGMA journal_mode = WAL;");
  } catch {}

  try {
    db.exec("PRAGMA foreign_keys = ON;");
  } catch {}

  // Migration: Create core control plane tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS runbooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      target_service TEXT NOT NULL,
      active_version_id TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_runbooks_service ON runbooks(target_service);

    CREATE TABLE IF NOT EXISTS runbook_versions (
      id TEXT PRIMARY KEY,
      runbook_id TEXT NOT NULL,
      version TEXT NOT NULL,
      markdown_source TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'SRE',
      compilation_status TEXT NOT NULL DEFAULT 'PENDING',
      contract_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (runbook_id) REFERENCES runbooks(id) ON DELETE RESTRICT,
      UNIQUE(runbook_id, version)
    );
    CREATE INDEX IF NOT EXISTS idx_runbook_versions_lookup ON runbook_versions(runbook_id, version);

    CREATE TABLE IF NOT EXISTS recovery_contracts (
      id TEXT PRIMARY KEY,
      runbook_id TEXT NOT NULL,
      runbook_version_id TEXT NOT NULL,
      target_service TEXT NOT NULL,
      schema_version TEXT NOT NULL DEFAULT '1.0.0',
      contract_version TEXT NOT NULL DEFAULT 'v1.0.0',
      entry_step_id TEXT NOT NULL,
      contract_payload TEXT NOT NULL,
      validation_status TEXT NOT NULL DEFAULT 'STRUCTURALLY_VALID',
      activation_status TEXT NOT NULL DEFAULT 'INACTIVE',
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      compiled_at TEXT NOT NULL,
      FOREIGN KEY (runbook_version_id) REFERENCES runbook_versions(id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_contracts_service_active ON recovery_contracts(target_service, is_active);

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      incident_id TEXT,
      environment TEXT NOT NULL,
      target_resource TEXT NOT NULL,
      evidence_type TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_tool TEXT NOT NULL,
      source_execution_id TEXT,
      observed_at TEXT NOT NULL,
      collected_at TEXT NOT NULL,
      summary TEXT NOT NULL,
      structured_value TEXT NOT NULL,
      bounded_raw_excerpt TEXT,
      freshness_status TEXT NOT NULL DEFAULT 'FRESH',
      derived INTEGER NOT NULL DEFAULT 0,
      source_evidence_ids TEXT,
      sandbox_execution_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_evidence_resource ON evidence(target_resource, evidence_type);
    CREATE INDEX IF NOT EXISTS idx_evidence_collected_at ON evidence(collected_at);

    CREATE TABLE IF NOT EXISTS hypotheses (
      id TEXT PRIMARY KEY,
      context_id TEXT NOT NULL,
      statement TEXT NOT NULL,
      supporting_evidence_ids TEXT NOT NULL,
      contradicting_evidence_ids TEXT NOT NULL,
      missing_evidence_types TEXT NOT NULL,
      evidence_strength TEXT NOT NULL DEFAULT 'MEDIUM',
      model_provider TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_hypotheses_context ON hypotheses(context_id);

    CREATE TABLE IF NOT EXISTS proof_carrying_actions (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      step_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      tool_arguments TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      justification_summary TEXT NOT NULL,
      confidence_score REAL NOT NULL,
      supporting_evidence_ids TEXT NOT NULL,
      risk_tier TEXT NOT NULL,
      blast_radius TEXT NOT NULL,
      is_reversible INTEGER NOT NULL DEFAULT 0,
      rollback_procedure TEXT,
      verification_criteria TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PROPOSED',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pca_incident ON proof_carrying_actions(incident_id);
    CREATE INDEX IF NOT EXISTS idx_pca_hash ON proof_carrying_actions(payload_hash);
    CREATE INDEX IF NOT EXISTS idx_pca_status ON proof_carrying_actions(status);

    CREATE TABLE IF NOT EXISTS safety_policy_decisions (
      id TEXT PRIMARY KEY,
      action_id TEXT NOT NULL,
      policy_decision TEXT NOT NULL,
      reason_code TEXT NOT NULL,
      reason_message TEXT NOT NULL,
      matched_rule TEXT NOT NULL,
      preconditions_passed INTEGER NOT NULL DEFAULT 1,
      checks_summary TEXT NOT NULL,
      evaluated_at TEXT NOT NULL,
      FOREIGN KEY (action_id) REFERENCES proof_carrying_actions(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_safety_decisions_action ON safety_policy_decisions(action_id);

    CREATE TABLE IF NOT EXISTS approval_requests (
      id TEXT PRIMARY KEY,
      action_id TEXT NOT NULL UNIQUE,
      payload_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      decided_by TEXT,
      operator_note TEXT,
      decided_at TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (action_id) REFERENCES proof_carrying_actions(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_approvals_action ON approval_requests(action_id);
    CREATE INDEX IF NOT EXISTS idx_approvals_hash ON approval_requests(payload_hash);

    CREATE TABLE IF NOT EXISTS tool_executions (
      id TEXT PRIMARY KEY,
      action_id TEXT NOT NULL,
      incident_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      arguments_snapshot TEXT NOT NULL,
      execution_token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'PENDING',
      exit_code INTEGER,
      duration_ms INTEGER,
      raw_output_excerpt TEXT,
      error_message TEXT,
      executed_at TEXT NOT NULL,
      FOREIGN KEY (action_id) REFERENCES proof_carrying_actions(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_tool_executions_action ON tool_executions(action_id);
    CREATE INDEX IF NOT EXISTS idx_tool_executions_token ON tool_executions(execution_token);

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      target_service TEXT NOT NULL,
      environment TEXT NOT NULL DEFAULT 'LOCAL',
      status TEXT NOT NULL DEFAULT 'DETECTED',
      active_contract_id TEXT,
      current_step_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
    CREATE INDEX IF NOT EXISTS idx_incidents_service ON incidents(target_service);

    CREATE TABLE IF NOT EXISTS verification_runs (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      action_id TEXT,
      contract_step_id TEXT NOT NULL,
      overall_status TEXT NOT NULL,
      details TEXT NOT NULL,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      verified_at TEXT NOT NULL,
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_verification_incident ON verification_runs(incident_id);

    CREATE TABLE IF NOT EXISTS incident_events (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_incident_events_incident ON incident_events(incident_id, created_at);
  `);

  return db;
}

export function getControlPlaneDb(): DatabaseSync {
  if (!globalDb) {
    globalDb = initDatabase();
  }
  return globalDb;
}

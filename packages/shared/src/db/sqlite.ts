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
  `);

  return db;
}

export function getControlPlaneDb(): DatabaseSync {
  if (!globalDb) {
    globalDb = initDatabase();
  }
  return globalDb;
}

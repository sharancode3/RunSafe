import { getControlPlaneDb } from "@runsafe/shared";
import type { RecoveryContract, RunbookRecord, RunbookVersionRecord } from "../schemas.js";

export interface RecoveryContractRecord {
  id: string;
  runbook_id: string;
  runbook_version_id: string;
  target_service: string;
  schema_version: string;
  contract_version: string;
  entry_step_id: string;
  contract_payload: string;
  validation_status: "STRUCTURALLY_VALID" | "FAILED_VALIDATION";
  activation_status: "ACTIVE" | "INACTIVE";
  is_active: number;
  created_at: string;
  compiled_at: string;
}

export class RunbookRepository {
  private db = getControlPlaneDb();

  public createRunbook(runbook: {
    id: string;
    name: string;
    description?: string;
    targetService: string;
  }): RunbookRecord {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO runbooks (id, name, description, target_service, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'DRAFT', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        target_service = excluded.target_service,
        updated_at = excluded.updated_at
      RETURNING *
    `);
    const row = stmt.get(
      runbook.id,
      runbook.name,
      runbook.description || null,
      runbook.targetService,
      now,
      now
    ) as any;

    return row as RunbookRecord;
  }

  public getRunbook(id: string): RunbookRecord | null {
    const stmt = this.db.prepare("SELECT * FROM runbooks WHERE id = ?");
    const row = stmt.get(id) as any;
    return row ? (row as RunbookRecord) : null;
  }

  public listRunbooks(): RunbookRecord[] {
    const stmt = this.db.prepare("SELECT * FROM runbooks ORDER BY created_at DESC");
    return stmt.all() as any[];
  }

  public createVersion(version: {
    id: string;
    runbookId: string;
    version: string;
    markdownSource: string;
    author?: string;
    compilationStatus?: "PENDING" | "COMPILED" | "FAILED_VALIDATION";
    contractId?: string;
  }): RunbookVersionRecord {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO runbook_versions (
        id, runbook_id, version, markdown_source, author, compilation_status, contract_id, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(runbook_id, version) DO UPDATE SET
        markdown_source = excluded.markdown_source,
        compilation_status = excluded.compilation_status,
        contract_id = excluded.contract_id
      RETURNING *
    `);
    const row = stmt.get(
      version.id,
      version.runbookId,
      version.version,
      version.markdownSource,
      version.author || "SRE",
      version.compilationStatus || "PENDING",
      version.contractId || null,
      now
    ) as any;

    return row as RunbookVersionRecord;
  }

  public getVersion(versionId: string): RunbookVersionRecord | null {
    const stmt = this.db.prepare("SELECT * FROM runbook_versions WHERE id = ?");
    const row = stmt.get(versionId) as any;
    return row ? (row as RunbookVersionRecord) : null;
  }

  public getVersionsByRunbook(runbookId: string): RunbookVersionRecord[] {
    const stmt = this.db.prepare("SELECT * FROM runbook_versions WHERE runbook_id = ? ORDER BY created_at DESC");
    return stmt.all(runbookId) as any[];
  }

  public saveContract(
    contract: RecoveryContract,
    options: {
      validationStatus?: "STRUCTURALLY_VALID" | "FAILED_VALIDATION";
    } = {}
  ): RecoveryContractRecord {
    const now = new Date().toISOString();
    const validationStatus = options.validationStatus || "STRUCTURALLY_VALID";

    const stmt = this.db.prepare(`
      INSERT INTO recovery_contracts (
        id, runbook_id, runbook_version_id, target_service, schema_version,
        contract_version, entry_step_id, contract_payload, validation_status,
        activation_status, is_active, created_at, compiled_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'INACTIVE', 0, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        contract_payload = excluded.contract_payload,
        validation_status = excluded.validation_status,
        compiled_at = excluded.compiled_at
      RETURNING *
    `);

    const row = stmt.get(
      contract.id,
      contract.runbookId,
      contract.runbookVersionId,
      contract.targetService,
      contract.schemaVersion,
      contract.contractVersion,
      contract.entryStepId,
      JSON.stringify(contract),
      validationStatus,
      now,
      now
    ) as any;

    // Update the version's contract_id and compilation_status
    const updateVer = this.db.prepare(`
      UPDATE runbook_versions
      SET contract_id = ?, compilation_status = ?
      WHERE id = ?
    `);
    updateVer.run(
      contract.id,
      validationStatus === "STRUCTURALLY_VALID" ? "COMPILED" : "FAILED_VALIDATION",
      contract.runbookVersionId
    );

    return row as RecoveryContractRecord;
  }

  public getContract(contractId: string): RecoveryContractRecord | null {
    const stmt = this.db.prepare("SELECT * FROM recovery_contracts WHERE id = ?");
    const row = stmt.get(contractId) as any;
    return row ? (row as RecoveryContractRecord) : null;
  }

  public getActiveContract(targetService: string): RecoveryContractRecord | null {
    const stmt = this.db.prepare(
      "SELECT * FROM recovery_contracts WHERE target_service = ? AND is_active = 1 LIMIT 1"
    );
    const row = stmt.get(targetService) as any;
    return row ? (row as RecoveryContractRecord) : null;
  }

  /**
   * Enforces contract activation guard:
   * 1. Only contracts with validation_status === 'STRUCTURALLY_VALID' can be activated.
   * 2. Atomic deactivation of any existing active contract for the target service (single active invariant).
   * 3. Sets is_active = 1, activation_status = 'ACTIVE'.
   * 4. Updates runbooks.active_version_id.
   */
  public activateContract(contractId: string): RecoveryContractRecord {
    const contract = this.getContract(contractId);
    if (!contract) {
      throw new Error(`Recovery contract '${contractId}' not found.`);
    }

    if (contract.validation_status !== "STRUCTURALLY_VALID") {
      throw new Error(
        `Contract activation guard violation: contract '${contractId}' has status '${contract.validation_status}'. Only structurally valid contracts can be activated.`
      );
    }

    // Atomic transaction for single-active invariant
    this.db.exec("BEGIN TRANSACTION;");
    try {
      // Deactivate all existing active contracts for this service
      this.db.prepare(`
        UPDATE recovery_contracts
        SET is_active = 0, activation_status = 'INACTIVE'
        WHERE target_service = ? AND is_active = 1
      `).run(contract.target_service);

      // Activate the target contract
      this.db.prepare(`
        UPDATE recovery_contracts
        SET is_active = 1, activation_status = 'ACTIVE'
        WHERE id = ?
      `).run(contractId);

      // Link to active_version_id in runbooks table
      this.db.prepare(`
        UPDATE runbooks
        SET active_version_id = ?, status = 'ACTIVE', updated_at = ?
        WHERE id = ?
      `).run(contract.runbook_version_id, new Date().toISOString(), contract.runbook_id);

      this.db.exec("COMMIT;");
    } catch (err) {
      this.db.exec("ROLLBACK;");
      throw err;
    }

    return this.getContract(contractId)!;
  }
}

export const runbookRepository = new RunbookRepository();

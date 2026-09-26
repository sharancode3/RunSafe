import { getControlPlaneDb } from "@runsafe/shared";
import { ActionRepository } from "@runsafe/actions";
import { type ApprovalRequest, ApprovalRequestSchema } from "../kernel/safety-decision.js";

export class ApprovalService {
  private actionRepo = new ActionRepository();

  public getApprovalRequest(actionId: string): ApprovalRequest | null {
    const db = getControlPlaneDb();
    const stmt = db.prepare("SELECT * FROM approval_requests WHERE action_id = ?");
    const row = stmt.get(actionId) as any;
    if (!row) return null;

    return ApprovalRequestSchema.parse({
      id: row.id,
      actionId: row.action_id,
      payloadHash: row.payload_hash,
      status: row.status,
      decidedBy: row.decided_by,
      operatorNote: row.operator_note,
      decidedAt: row.decided_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    });
  }

  public approveAction(input: {
    actionId: string;
    operatorId: string;
    payloadHash: string;
    operatorNote?: string;
  }): { success: boolean; error?: string } {
    const req = this.getApprovalRequest(input.actionId);
    if (!req) {
      return { success: false, error: `No approval request found for action '${input.actionId}'.` };
    }

    if (req.status !== "PENDING") {
      return { success: false, error: `Approval request is already in '${req.status}' state.` };
    }

    if (new Date(req.expiresAt).getTime() < Date.now()) {
      const db = getControlPlaneDb();
      db.prepare("UPDATE approval_requests SET status = 'EXPIRED' WHERE id = ?").run(req.id);
      return { success: false, error: "Approval request has expired." };
    }

    // Strict Fingerprint Verification Invariant
    if (req.payloadHash !== input.payloadHash) {
      return {
        success: false,
        error: `FINGERPRINT_MISMATCH: Provided approval payload hash does not match exact action fingerprint. Expected '${req.payloadHash}', got '${input.payloadHash}'.`,
      };
    }

    const db = getControlPlaneDb();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE approval_requests
      SET status = 'APPROVED', decided_by = ?, operator_note = ?, decided_at = ?
      WHERE id = ? AND status = 'PENDING'
    `);
    const res = stmt.run(input.operatorId, input.operatorNote || null, now, req.id);

    if (res.changes === 0) {
      return { success: false, error: "Concurrent approval state update detected." };
    }

    // Update action status to APPROVED
    this.actionRepo.updateActionStatus(input.actionId, "APPROVED");

    return { success: true };
  }

  public rejectAction(input: {
    actionId: string;
    operatorId: string;
    operatorNote?: string;
  }): { success: boolean; error?: string } {
    const req = this.getApprovalRequest(input.actionId);
    if (!req) {
      return { success: false, error: `No approval request found for action '${input.actionId}'.` };
    }

    const db = getControlPlaneDb();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE approval_requests
      SET status = 'REJECTED', decided_by = ?, operator_note = ?, decided_at = ?
      WHERE id = ? AND status = 'PENDING'
    `);
    stmt.run(input.operatorId, input.operatorNote || null, now, req.id);

    // Update action status to REJECTED
    this.actionRepo.updateActionStatus(input.actionId, "REJECTED");

    return { success: true };
  }
}

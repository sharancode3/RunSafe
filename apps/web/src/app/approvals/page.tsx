"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  ArrowRight,
  ExternalLink,
  Lock,
} from "lucide-react";

interface PendingActionItem {
  id: string;
  actionId?: string;
  approvalId?: string;
  incidentId: string;
  contractId: string;
  stepId: string;
  toolName: string;
  toolArguments?: Record<string, unknown>;
  justificationSummary?: string;
  riskTier: string;
  isReversible?: boolean;
  blastRadius?: {
    targetEnvironment?: string;
    affectedServices?: string[];
  };
  payloadHash: string;
  status: string;
}

export default function ApprovalCenterPage() {
  const [pendingActions, setPendingActions] = useState<PendingActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [operatorNote, setOperatorNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null);

  const fetchPendingApprovals = async () => {
    try {
      const res = await fetch("/api/v1/approvals/pending");
      if (res.ok) {
        const data = await res.json();
        setPendingActions(data.approvals || []);
        return;
      }

      // Fallback
      const actRes = await fetch("/api/v1/actions?status=PENDING");
      if (actRes.ok) {
        const actData = await actRes.json();
        setPendingActions(actData.actions || []);
      }
    } catch (err) {
      console.error("Error fetching approvals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingApprovals();
    const interval = setInterval(fetchPendingApprovals, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (action: PendingActionItem) => {
    setSubmitting(true);
    setDecisionFeedback(null);
    try {
      // 1. Submit human approval with exact contract
      const appRes = await fetch(`/api/v1/actions/${action.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "APPROVE",
          operatorId: "operator-ui",
          payloadHash: action.payloadHash,
          operatorNote: operatorNote || "Approved via RunSafe Approval Center UI",
        }),
      });

      if (!appRes.ok) {
        const err = await appRes.json();
        setDecisionFeedback(`Approval error: ${err.error?.message || "Failed"}`);
        return;
      }

      // 2. Trigger execution
      const execRes = await fetch(`/api/v1/actions/${action.id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: action.id,
          payloadHash: action.payloadHash,
        }),
      });

      if (execRes.ok) {
        setDecisionFeedback(`✓ Mutation authorized and dispatched to infrastructure.`);
        setTimeout(() => {
          fetchPendingApprovals();
        }, 1200);
      } else {
        const err = await execRes.json();
        setDecisionFeedback(`Execution error: ${err.error?.message || "Failed"}`);
      }
    } catch (err: any) {
      setDecisionFeedback(`Network error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (action: PendingActionItem) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/actions/${action.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "REJECT",
          operatorId: "operator-ui",
          payloadHash: action.payloadHash,
          operatorNote: operatorNote || "Rejected by operator via RunSafe UI",
        }),
      });

      if (res.ok) {
        setDecisionFeedback(`Action ${action.id} rejected and escalated to human SRE.`);
        setTimeout(() => {
          fetchPendingApprovals();
        }, 1000);
      } else {
        const err = await res.json();
        setDecisionFeedback(`Rejection error: ${err.error?.message || "Failed"}`);
      }
    } catch (err: any) {
      setDecisionFeedback(`Network error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-serif-title font-bold text-black tracking-tight">
          Approval Center
        </h1>
        <p className="text-sm font-editorial-body text-neutral-600 mt-1">
          High-stakes Proof-Carrying Actions awaiting explicit operator cryptographic authorization.
        </p>
      </div>

      {decisionFeedback && (
        <div className="p-4 border border-black bg-neutral-50 rounded-lg text-xs font-tech-mono">
          {decisionFeedback}
        </div>
      )}

      {pendingActions.length === 0 ? (
        <div className="border border-black/15 bg-neutral-50 rounded-xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full border border-black/20 bg-white flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-black" />
          </div>
          <h2 className="text-base font-tech-mono font-bold uppercase tracking-wider text-black">
            Zero Pending Approvals
          </h2>
          <p className="text-xs font-editorial-body text-neutral-600 max-w-md mx-auto">
            All proposed mutations have been decided or system is currently running automated low-risk steps.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="text-xs font-tech-mono underline hover:text-neutral-600"
            >
              Return to Command Center
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-3 bg-neutral-100 border border-black/10 rounded-md text-xs font-tech-mono flex justify-between items-center">
            <span>Pending Authorization Requests: {pendingActions.length}</span>
            <span className="text-[10px] text-neutral-500">Auto-refresh active (3s)</span>
          </div>

          {pendingActions.map((action) => (
            <div
              key={action.id}
              className="bg-black text-white rounded-xl border-2 border-black p-8 space-y-6"
            >
              {/* Header */}
              <div className="flex justify-between items-start border-b border-neutral-800 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-md bg-white text-black flex items-center justify-center font-bold">
                    <ShieldAlert className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <h2 className="font-tech-mono font-bold text-sm uppercase tracking-wider">
                      Human Checkpoint: {action.toolName}
                    </h2>
                    <p className="text-xs font-tech-mono text-neutral-400 mt-0.5">
                      Action ID: {action.id} | Step: {action.stepId}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-tech-mono bg-neutral-900 border border-neutral-700 px-2.5 py-1 rounded-sm">
                    RISK TIER: {action.riskTier}
                  </span>
                  <span className="text-xs font-tech-mono bg-neutral-800 px-2 py-1 rounded-sm">
                    {action.isReversible ? "REVERSIBLE" : "HIGH_RISK / DESTRUCTIVE"}
                  </span>
                </div>
              </div>

              {/* Justification & Scope */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-tech-mono">
                <div className="space-y-2">
                  <p className="text-neutral-400 uppercase tracking-widest text-[10px]">
                    Justification
                  </p>
                  <p className="font-editorial-body text-sm leading-relaxed text-neutral-200">
                    {action.justificationSummary || "Runbook contract recovery step requires explicit operator confirmation."}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-neutral-400 uppercase tracking-widest text-[10px]">
                    Cryptographic Payload Hash
                  </p>
                  <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded font-mono text-[11px] text-neutral-300 break-all select-all">
                    {action.payloadHash}
                  </div>
                  <p className="text-[10px] text-neutral-500">
                    Exact SHA-256 fingerprint verified by Safety Kernel prior to execution.
                  </p>
                </div>
              </div>

              {/* Blast Radius & Target */}
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-tech-mono space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Target Environment:</span>
                  <span className="text-white font-bold">{action.blastRadius?.targetEnvironment || "LOCAL"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Bound Contract:</span>
                  <span className="text-white">{action.contractId}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Affected Services:</span>
                  <span className="text-white">
                    {(action.blastRadius?.affectedServices || ["checkout-service"]).join(", ")}
                  </span>
                </div>
              </div>

              {/* Operator Decision Actions */}
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-tech-mono text-neutral-400 mb-1.5">
                    Operator Decision Note (Audit Trail)
                  </label>
                  <input
                    type="text"
                    value={operatorNote}
                    onChange={(e) => setOperatorNote(e.target.value)}
                    placeholder="e.g., Verified canary failure in logs, approved rollback to v1.0.0"
                    className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-xs font-tech-mono text-white focus:outline-none focus:border-white"
                  />
                </div>

                <div className="flex space-x-4">
                  <button
                    disabled={submitting}
                    onClick={() => handleApprove(action)}
                    className="flex-1 py-3 bg-white text-black font-tech-mono font-bold text-xs uppercase tracking-wider rounded-md hover:bg-neutral-200 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? "Signing & Dispatching..." : "Approve & Execute Mutation"}
                  </button>
                  <button
                    disabled={submitting}
                    onClick={() => handleReject(action)}
                    className="px-6 py-3 border border-neutral-700 text-neutral-300 font-tech-mono font-bold text-xs uppercase tracking-wider rounded-md hover:bg-neutral-900 disabled:opacity-50 transition-colors"
                  >
                    Reject &amp; Escalate
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

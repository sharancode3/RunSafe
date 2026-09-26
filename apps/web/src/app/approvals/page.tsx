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
  incidentId: string;
  contractId: string;
  stepId: string;
  toolName: string;
  toolArguments: Record<string, unknown>;
  justificationSummary: string;
  riskTier: string;
  isReversible: boolean;
  blastRadius: {
    targetEnvironment: string;
    affectedServices: string[];
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
      // Find incidents with APPROVAL_REQUESTED
      const incRes = await fetch("/api/v1/incidents");
      if (!incRes.ok) return;
      const incData = await incRes.json();
      const openIncidents = (incData.incidents || []).filter(
        (i: any) => i.status === "REMEDIATING" || i.status === "AWAITING_APPROVAL"
      );

      const actions: PendingActionItem[] = [];
      for (const inc of openIncidents) {
        const evtsRes = await fetch(`/api/v1/incidents/${inc.id}/events`);
        if (!evtsRes.ok) continue;
        const evtsData = await evtsRes.json();
        const approvalEvt = (evtsData.events || []).find(
          (e: any) => e.eventType === "APPROVAL_REQUESTED"
        );

        if (approvalEvt?.payload?.actionId) {
          const actRes = await fetch(`/api/v1/actions/${approvalEvt.payload.actionId}`);
          if (actRes.ok) {
            const actData = await actRes.json();
            if (actData.action?.status === "PENDING" || actData.action?.status === "APPROVED") {
              actions.push(actData.action);
            }
          }
        }
      }

      setPendingActions(actions);
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
      // 1. Submit human approval
      const appRes = await fetch(`/api/v1/actions/${action.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "APPROVED",
          approvedBy: "operator-ui",
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
        }, 1500);
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
      await fetch(`/api/v1/actions/${action.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "REJECTED",
          approvedBy: "operator-ui",
          payloadHash: action.payloadHash,
          operatorNote: operatorNote || "Rejected by operator",
        }),
      });
      setDecisionFeedback(`Action ${action.id} rejected and escalated to senior SRE.`);
      fetchPendingApprovals();
    } catch (err) {
      console.error(err);
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
          {pendingActions.map((action) => (
            <div
              key={action.id}
              className="bg-black text-white rounded-xl border-2 border-black p-8 space-y-6"
            >
              {/* Header */}
              <div className="flex justify-between items-start border-b border-neutral-800 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-tech-mono bg-red-600 text-white px-2 py-0.5 rounded-sm font-bold uppercase">
                      [{action.riskTier}]
                    </span>
                    <span className="text-[10px] font-tech-mono bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-sm">
                      REVERSIBLE: {action.isReversible ? "YES" : "NO"}
                    </span>
                  </div>
                  <h2 className="text-2xl font-serif-title font-bold text-white mt-2">
                    {action.toolName}
                  </h2>
                </div>

                <div className="text-right text-xs font-tech-mono text-neutral-400">
                  <p>ACTION ID: {action.id}</p>
                  <p>STEP: {action.stepId}</p>
                </div>
              </div>

              {/* Justification & The "Why" */}
              <div className="space-y-2">
                <p className="text-[10px] font-tech-mono uppercase tracking-widest text-neutral-400">
                  Operational Justification (The &quot;Why&quot;)
                </p>
                <p className="text-sm font-editorial-body text-neutral-200 leading-relaxed bg-neutral-900 border border-neutral-800 p-4 rounded-md">
                  &quot;{action.justificationSummary}&quot;
                </p>
              </div>

              {/* Grid: Blast Radius + Parameters + Fingerprint */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-tech-mono">
                <div className="p-3 bg-neutral-900 rounded-md border border-neutral-800 space-y-1">
                  <span className="text-[10px] text-neutral-400 uppercase">Tool Parameters:</span>
                  <pre className="text-neutral-200 overflow-x-auto">
                    {JSON.stringify(action.toolArguments, null, 2)}
                  </pre>
                </div>

                <div className="p-3 bg-neutral-900 rounded-md border border-neutral-800 space-y-1">
                  <span className="text-[10px] text-neutral-400 uppercase">Blast Radius &amp; Target:</span>
                  <p className="text-neutral-200">
                    Environment: <span className="font-bold">{action.blastRadius.targetEnvironment}</span>
                  </p>
                  <p className="text-neutral-200">
                    Affected Services: {action.blastRadius.affectedServices.join(", ")}
                  </p>
                </div>
              </div>

              {/* Cryptographic SHA-256 Fingerprint */}
              <div className="p-3 bg-neutral-900 rounded-md border border-neutral-800 text-xs font-tech-mono flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Lock className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="text-neutral-400">Payload Fingerprint (SHA-256):</span>
                </div>
                <span className="text-neutral-200 font-bold tracking-wider">
                  {action.payloadHash.substring(0, 32)}...
                </span>
              </div>

              {/* Operator Note & Action Buttons */}
              <div className="space-y-3 pt-4 border-t border-neutral-800">
                <label className="block text-xs font-tech-mono text-neutral-300">
                  Operator Audit Signature Note (Optional):
                </label>
                <input
                  type="text"
                  value={operatorNote}
                  onChange={(e) => setOperatorNote(e.target.value)}
                  placeholder="e.g. Authorized rollback following verified regression analysis"
                  className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-md px-3 py-2 text-xs font-tech-mono focus:outline-none focus:border-white"
                />

                <div className="flex items-center space-x-4 pt-2">
                  <button
                    onClick={() => handleApprove(action)}
                    disabled={submitting}
                    className="flex-1 py-3 px-4 bg-white text-black font-tech-mono font-bold text-xs uppercase tracking-wider rounded-md hover:bg-neutral-200 transition-colors disabled:opacity-50"
                  >
                    {submitting ? "Signing & Dispatching..." : "Approve & Execute Mutation"}
                  </button>

                  <button
                    onClick={() => handleReject(action)}
                    disabled={submitting}
                    className="py-3 px-6 border-2 border-dashed border-neutral-600 text-neutral-300 font-tech-mono text-xs uppercase tracking-wider rounded-md hover:border-white hover:text-white transition-colors disabled:opacity-50"
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

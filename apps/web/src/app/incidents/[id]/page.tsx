"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Play,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  FileText,
  Activity,
  Layers,
  Check,
  X,
  HelpCircle,
} from "lucide-react";

interface IncidentRecord {
  id: string;
  title: string;
  target_service: string;
  environment: string;
  status: string;
  active_contract_id: string | null;
  current_step_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface IncidentEvent {
  id: string;
  incidentId?: string;
  incident_id?: string;
  eventType?: string;
  event_type?: string;
  payload?: any;
  createdAt?: string;
  created_at?: string;
}

interface EvidenceItem {
  id: string;
  evidenceType: string;
  sourceTool: string;
  summary: string;
  structuredValue?: any;
  observedAt: string;
}

interface VerificationRunItem {
  id: string;
  contractStepId: string;
  overallStatus: "PASS" | "FAIL" | "UNKNOWN";
  durationMs: number;
  verifiedAt: string;
  details: Array<{
    probeType: string;
    targetResource: string;
    status: "PASS" | "FAIL" | "UNKNOWN";
    latencyMs: number;
    message: string;
    expected: unknown;
    actual: unknown;
  }>;
}

export default function IncidentRoomPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(paramsPromise);
  const incidentId = resolvedParams.id;

  const [incident, setIncident] = useState<IncidentRecord | null>(null);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [verifications, setVerifications] = useState<VerificationRunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingNext, setExecutingNext] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  const fetchIncidentData = async () => {
    try {
      const [incRes, evtsRes, evidRes, verifRes] = await Promise.all([
        fetch(`/api/v1/incidents/${incidentId}`).catch(() => null),
        fetch(`/api/v1/incidents/${incidentId}/events`).catch(() => null),
        fetch(`/api/v1/evidence?incidentId=${incidentId}`).catch(() => null),
        fetch(`/api/v1/incidents/${incidentId}/verifications`).catch(() => null),
      ]);

      if (incRes?.ok) {
        const d = await incRes.json();
        setIncident(d.incident || d);
      }
      if (evtsRes?.ok) {
        const data = await evtsRes.json();
        setEvents(data.events || []);
      }
      if (evidRes?.ok) {
        const data = await evidRes.json();
        setEvidenceList(data.data || data.evidence || []);
      }
      if (verifRes?.ok) {
        const data = await verifRes.json();
        setVerifications(data.verificationRuns || []);
      }
    } catch (err) {
      console.error("Error loading incident room data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidentData();

    // SSE connection for live updates
    const eventSource = new EventSource(`/api/v1/events/stream?incidentId=${incidentId}`);
    eventSource.addEventListener("incident_event", (e) => {
      try {
        const evt = JSON.parse(e.data);
        if (evt.incidentId === incidentId || evt.incident_id === incidentId) {
          setEvents((prev) => {
            if (prev.some((p) => p.id === evt.id)) return prev;
            return [...prev, evt];
          });
          fetchIncidentData();
        }
      } catch (err) {}
    });

    const fallbackPoll = setInterval(fetchIncidentData, 3000);

    return () => {
      eventSource.close();
      clearInterval(fallbackPoll);
    };
  }, [incidentId]);

  const handleExecuteNextStep = async () => {
    setExecutingNext(true);
    setExecutionMessage(null);
    try {
      const res = await fetch(`/api/v1/incidents/${incidentId}/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await res.json();
      if (res.ok) {
        if (result.status === "PAUSED_FOR_APPROVAL") {
          setExecutionMessage("Paused for Human Approval Checkpoint. Directing to Approval Center.");
          setTimeout(() => {
            window.location.href = "/approvals";
          }, 1500);
        } else if (result.status === "RESOLVED") {
          setExecutionMessage("Recovery Independently Verified and Completed!");
        } else if (result.status === "ABSTAINED") {
          setExecutionMessage(`Autonomous action halted: ${result.reason || "Confidence below 0.70 threshold"}`);
        } else {
          setExecutionMessage(`Step completed: ${result.status}`);
        }
        await fetchIncidentData();
      } else {
        setExecutionMessage(`Step execution failed: ${result.error?.message || result.message || "Failed"}`);
      }
    } catch (err: any) {
      setExecutionMessage(`Network error: ${err.message}`);
    } finally {
      setExecutingNext(false);
    }
  };

  const isResolved = incident?.status === "VERIFIED_RECOVERY";
  const isAbstained = incident?.status === "ABSTAINED";
  const isAwaitingApproval =
    events.some((e) => (e.eventType || e.event_type) === "APPROVAL_REQUESTED") && !isResolved;

  // Extract latest probe evaluation for each probe type across all verification runs
  const getProbeStatus = (probeType: string) => {
    for (let i = verifications.length - 1; i >= 0; i--) {
      const v = verifications[i];
      const probe = v.details?.find(
        (p) =>
          p.probeType === probeType ||
          (probeType === "DB_LATENCY" && (p.probeType === "DATABASE_HEALTH" || p.probeType === "DB_LATENCY")) ||
          (probeType === "SYNTHETIC_ORDER" && (p.probeType === "SYNTHETIC_TRANSACTION" || p.probeType === "SYNTHETIC_ORDER"))
      );
      if (probe) {
        return {
          state: probe.status,
          text: `${probe.status === "PASS" ? "Verified PASS" : "Probe FAIL"}: ${probe.message || probe.actual}`,
        };
      }
    }
    return { state: "PENDING", text: "Pending Probe Check" };
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Incident Status Header */}
      <div className="border border-black/15 bg-white rounded-lg p-5 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <div className="flex items-center space-x-3">
            <span className="text-xs font-tech-mono bg-black text-white px-2 py-0.5 rounded-sm uppercase tracking-wider">
              {incident?.id || incidentId}
            </span>
            <span
              className={`text-xs font-tech-mono px-2 py-0.5 rounded-sm border ${
                isResolved
                  ? "bg-black text-white border-black font-bold"
                  : isAbstained
                  ? "bg-neutral-200 text-black border-neutral-400 font-bold"
                  : isAwaitingApproval
                  ? "bg-neutral-900 text-white font-bold animate-pulse"
                  : "bg-neutral-100 text-neutral-800 border-black/10"
              }`}
            >
              [{incident?.status || "INVESTIGATING"}]
            </span>
            <span className="text-xs font-tech-mono text-neutral-500 border border-neutral-200 px-2 py-0.5 rounded-sm">
              SIMULATED WORKLOAD
            </span>
          </div>

          <h1 className="text-2xl font-serif-title font-bold text-black mt-2">
            {incident?.title || "Incident Recovery Room"}
          </h1>
          <p className="text-xs font-tech-mono text-neutral-500 mt-1">
            Service: <span className="font-bold text-black">{incident?.target_service || "checkout-service"}</span> | Contract:{" "}
            <span className="text-neutral-700">{incident?.active_contract_id || "contract_checkout_recovery_v1"}</span> | Environment:{" "}
            <span className="font-bold">{incident?.environment || "LOCAL"}</span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          {isAwaitingApproval ? (
            <Link
              href="/approvals"
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-black text-white rounded-md text-xs font-tech-mono font-bold hover:bg-neutral-800 transition-colors"
            >
              <ShieldAlert className="w-4 h-4 text-white" />
              <span>Review Pending Approval</span>
            </Link>
          ) : !isResolved && !isAbstained ? (
            <button
              disabled={executingNext}
              onClick={handleExecuteNextStep}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-black text-white rounded-md text-xs font-tech-mono font-bold hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{executingNext ? "Executing Step..." : "Execute Next Runbook Step"}</span>
            </button>
          ) : (
            <div className="text-xs font-tech-mono px-3 py-1.5 bg-neutral-100 border border-black/10 rounded-md">
              {isResolved ? "Incident Verified Recovered" : "Autonomous Remediation Abstained"}
            </div>
          )}
        </div>
      </div>

      {executionMessage && (
        <div className="p-3 bg-neutral-50 border border-black rounded-md text-xs font-tech-mono">
          {executionMessage}
        </div>
      )}

      {/* Main Two-Column Incident Room Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (65%): Chronological Event Trail */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex justify-between items-center border-b border-black/10 pb-2">
            <h2 className="font-tech-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-2">
              <Activity className="w-4 h-4 text-black" />
              <span>Chronological Incident Audit Trail ({events.length})</span>
            </h2>
            <span className="text-[10px] font-tech-mono text-neutral-400">
              Deterministic SSE Stream
            </span>
          </div>

          {events.length === 0 ? (
            <div className="border border-black/10 rounded-lg p-10 text-center space-y-2">
              <p className="text-xs font-tech-mono text-neutral-400">
                Awaiting telemetry events for incident...
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((evt) => {
                const eventType = evt.eventType || evt.event_type || "UNKNOWN_EVENT";
                const createdAt = evt.createdAt || evt.created_at || new Date().toISOString();
                const isApproval = eventType === "APPROVAL_REQUESTED";
                const isResolvedEvt = eventType === "INCIDENT_RESOLVED";
                const isAbstainedEvt = eventType === "INCIDENT_ABSTAINED";
                const isVerifier = eventType === "VERIFICATION_RUN";
                const isAgentInvestigation = eventType === "AGENT_INVESTIGATION_COMPLETED";

                return (
                  <div
                    key={evt.id}
                    className={`border rounded-lg p-4 transition-all ${
                      isApproval
                        ? "bg-black text-white border-black"
                        : isResolvedEvt
                        ? "bg-neutral-50 border-black border-2"
                        : isAbstainedEvt
                        ? "bg-neutral-100 border-black border-2"
                        : "bg-white border-black/10 hover:border-black/30"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-[10px] font-tech-mono font-bold px-1.5 py-0.5 rounded-sm ${
                            isApproval
                              ? "bg-white text-black"
                              : isResolvedEvt
                              ? "bg-black text-white"
                              : "bg-neutral-100 text-neutral-800 border border-black/10"
                          }`}
                        >
                          [{eventType}]
                        </span>
                        <span
                          className={`text-xs font-tech-mono ${
                            isApproval ? "text-neutral-300" : "text-neutral-500"
                          }`}
                        >
                          {new Date(createdAt).toLocaleTimeString()}
                        </span>
                      </div>

                      {evt.payload?.stepId && (
                        <span
                          className={`text-[10px] font-tech-mono px-2 py-0.5 rounded-sm ${
                            isApproval ? "bg-neutral-800 text-white" : "bg-neutral-100 text-black"
                          }`}
                        >
                          {evt.payload.stepId}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 text-xs font-editorial-body leading-relaxed">
                      {evt.payload?.message && (
                        <p className={isApproval ? "text-neutral-200" : "text-neutral-800"}>
                          {evt.payload.message}
                        </p>
                      )}

                      {isAgentInvestigation && (
                        <div className="mt-2 p-2.5 rounded-md text-[11px] font-tech-mono bg-neutral-50 border border-black/10 space-y-1">
                          <div className="flex justify-between font-bold">
                            <span>TrueForge Reasoning Model:</span>
                            <span>{evt.payload.model}</span>
                          </div>
                          {evt.payload.reasoningExcerpt && (
                            <p className="text-neutral-600 line-clamp-3 italic">
                              "{evt.payload.reasoningExcerpt}"
                            </p>
                          )}
                        </div>
                      )}

                      {evt.payload?.actionId && (
                        <div
                          className={`mt-2 p-2 rounded-md text-[11px] font-tech-mono space-y-1 ${
                            isApproval ? "bg-neutral-900 border border-neutral-700" : "bg-neutral-50 border border-black/10"
                          }`}
                        >
                          <div className="flex justify-between">
                            <span>Action ID:</span>
                            <span className="font-semibold">{evt.payload.actionId}</span>
                          </div>
                          {evt.payload?.payloadHash && (
                            <div className="flex justify-between">
                              <span>Payload Hash:</span>
                              <span className="text-[10px] text-neutral-400">
                                {evt.payload.payloadHash.substring(0, 24)}...
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {isVerifier && (
                        <div className="mt-2 p-2 rounded-md text-[11px] font-tech-mono bg-neutral-50 border border-black/10 flex justify-between items-center">
                          <span>Independent Verifier:</span>
                          <span
                            className={`font-bold px-2 py-0.5 rounded-sm ${
                              evt.payload?.overallStatus === "PASS"
                                ? "bg-black text-white"
                                : "bg-neutral-200 text-black"
                            }`}
                          >
                            {evt.payload?.overallStatus}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column (35%): Evidence Vault & Objective Verifier */}
        <div className="lg:col-span-4 space-y-6">
          {/* Objective Verification Criteria Checklist */}
          <div className="border border-black/15 bg-white rounded-lg p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-black/10 pb-2">
              <h3 className="font-tech-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-black" />
                <span>Objective Verification Probes</span>
              </h3>
              <span className="text-[10px] font-tech-mono text-neutral-400">
                {verifications.length} runs
              </span>
            </div>

            <div className="space-y-3 text-xs font-tech-mono">
              {[
                { type: "INGRESS_HEALTH", label: "Ingress Health == 200 OK" },
                { type: "REPLICA_HEALTH", label: "Direct Replica Probe == Healthy" },
                { type: "DB_LATENCY", label: "PostgreSQL DB Latency < 50ms" },
                { type: "SYNTHETIC_ORDER", label: "Synthetic Order == 200 Committed" },
              ].map((probe) => {
                const status = getProbeStatus(probe.type);
                const isPass = status.state === "PASS";
                const isFail = status.state === "FAIL";

                return (
                  <div key={probe.type} className="p-2.5 border border-black/10 rounded-md bg-neutral-50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-800">{probe.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-sm font-bold ${
                          isPass
                            ? "bg-black text-white"
                            : isFail
                            ? "bg-neutral-300 text-black border border-black"
                            : "bg-neutral-200 text-neutral-600"
                        }`}
                      >
                        {status.state}
                      </span>
                    </div>
                    <p className="text-[11px] font-editorial-body text-neutral-500">
                      {status.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Supporting Evidence Vault */}
          <div className="border border-black/15 bg-white rounded-lg p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-black/10 pb-2">
              <h3 className="font-tech-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-2">
                <FileText className="w-4 h-4 text-black" />
                <span>Evidence Vault ({evidenceList.length})</span>
              </h3>
              <span className="text-[10px] font-tech-mono text-neutral-400">
                Ground Truth
              </span>
            </div>

            {evidenceList.length === 0 ? (
              <p className="text-xs font-tech-mono text-neutral-400 py-4 text-center">
                No telemetry evidence collected yet.
              </p>
            ) : (
              <div className="space-y-3">
                {evidenceList.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 border border-black/10 rounded-md bg-neutral-50 space-y-1 text-xs font-tech-mono"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold underline text-black">[{ev.id.substring(0, 10)}]</span>
                      <span className="text-[10px] bg-neutral-200 px-1.5 py-0.5 rounded-sm">
                        {ev.evidenceType}
                      </span>
                    </div>
                    <p className="text-[11px] font-editorial-body text-neutral-700 line-clamp-2">
                      {ev.summary}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

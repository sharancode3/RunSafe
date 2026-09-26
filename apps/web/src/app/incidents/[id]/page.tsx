"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Clock,
  Terminal,
  FileText,
  Activity,
  ArrowRight,
  Database,
  ExternalLink,
  ChevronDown,
  Layers,
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
  updated_at: string;
  resolved_at: string | null;
}

interface IncidentEvent {
  id: string;
  incidentId: string;
  eventType: string;
  payload: any;
  createdAt: string;
}

interface EvidenceItem {
  id: string;
  evidenceType: string;
  targetResource: string;
  summary: string;
  collectedAt: string;
}

export default function IncidentRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const incidentId = resolvedParams.id;

  const [incident, setIncident] = useState<IncidentRecord | null>(null);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingNext, setExecutingNext] = useState(false);

  const fetchIncidentData = async () => {
    try {
      const [incRes, evtsRes, evidRes] = await Promise.all([
        fetch(`/api/v1/incidents/${incidentId}`).catch(() => null),
        fetch(`/api/v1/incidents/${incidentId}/events`).catch(() => null),
        fetch(`/api/v1/evidence?incidentId=${incidentId}`).catch(() => null),
      ]);

      if (incRes?.ok) {
        setIncident(await incRes.json());
      }
      if (evtsRes?.ok) {
        const data = await evtsRes.json();
        setEvents(data.events || []);
      }
      if (evidRes?.ok) {
        const data = await evidRes.json();
        setEvidenceList(data.evidence || []);
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
        if (evt.incidentId === incidentId) {
          setEvents((prev) => {
            if (prev.some((p) => p.id === evt.id)) return prev;
            return [...prev, evt];
          });
          // Refresh incident record
          fetch(`/api/v1/incidents/${incidentId}`)
            .then((r) => r.json())
            .then(setIncident)
            .catch(() => {});
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
    try {
      const activeApproval = events.find((e) => e.eventType === "APPROVAL_REQUESTED");
      if (activeApproval && incident?.status === "REMEDIATING") {
        // If approval checkpoint is open, redirect to approvals
        window.location.href = "/approvals";
        return;
      }

      await fetch(`/api/v1/actions/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId,
          contractId: incident?.active_contract_id || "contract_checkout_recovery_v1",
          stepId: incident?.current_step_id || "STEP_1_OBSERVE_INGRESS",
          toolName: "get_service_health",
          toolArguments: { serviceId: "checkout-service" },
          justificationSummary: "Operator triggered next runbook step",
          confidenceScore: 0.95,
          supportingEvidenceIds: evidenceList.map((e) => e.id),
        }),
      });
      await fetchIncidentData();
    } catch (err) {
      console.error(err);
    } finally {
      setExecutingNext(false);
    }
  };

  const isResolved = incident?.status === "VERIFIED_RECOVERY";
  const isAbstained = incident?.status === "ABSTAINED";
  const isAwaitingApproval = events.some((e) => e.eventType === "APPROVAL_REQUESTED") && !isResolved;

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
                  ? "bg-neutral-100 text-black border-black border-dashed font-bold"
                  : isAwaitingApproval
                  ? "bg-black text-white border-black animate-pulse"
                  : "bg-neutral-100 text-black border-neutral-300"
              }`}
            >
              [{incident?.status || "INVESTIGATING"}]
            </span>
          </div>
          <h1 className="text-2xl font-serif-title font-bold text-black mt-1">
            {incident?.title || "Incident Recovery Runner"}
          </h1>
          <p className="text-xs font-tech-mono text-neutral-500 mt-1">
            Service: <span className="text-black font-bold">{incident?.target_service}</span> | Environment:{" "}
            <span className="text-black font-bold">{incident?.environment}</span> | Contract:{" "}
            <span className="text-black">{incident?.active_contract_id || "Active Recovery Contract"}</span>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {isAwaitingApproval && (
            <Link
              href="/approvals"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-black text-white rounded-md text-xs font-tech-mono font-bold hover:bg-neutral-800 transition-colors"
            >
              <ShieldAlert className="w-4 h-4 text-white" />
              <span>Review & Authorize PCA</span>
            </Link>
          )}

          {!isResolved && !isAbstained && !isAwaitingApproval && (
            <button
              onClick={handleExecuteNextStep}
              disabled={executingNext}
              className="inline-flex items-center space-x-2 px-4 py-2 border border-black bg-black text-white rounded-md text-xs font-tech-mono hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{executingNext ? "Executing..." : "Execute Step"}</span>
            </button>
          )}

          {isResolved && (
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 border-2 border-black bg-white rounded-md text-xs font-tech-mono font-bold">
              <CheckCircle2 className="w-4 h-4 text-black" />
              <span>VERIFIED RECOVERY DECLARED</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Split-View: 65% Timeline / 35% Evidence Vault */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (65%): Live Chronological Timeline */}
        <div className="lg:col-span-8 border border-black/15 bg-white rounded-lg p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-black/10 pb-3">
            <h2 className="font-tech-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-2">
              <Clock className="w-4 h-4 text-black" />
              <span>Live Agent Chronological Timeline ({events.length} events)</span>
            </h2>
            <span className="text-[10px] font-tech-mono text-neutral-400">
              Real-time SSE Sync Active
            </span>
          </div>

          {events.length === 0 ? (
            <div className="py-12 text-center text-xs font-tech-mono text-neutral-400">
              No events recorded yet. Waiting for incident detection...
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((evt, idx) => {
                const isApproval = evt.eventType === "APPROVAL_REQUESTED";
                const isVerifier = evt.eventType === "VERIFICATION_RUN";
                const isAbstainedEvt = evt.eventType === "INCIDENT_ABSTAINED";
                const isResolvedEvt = evt.eventType === "INCIDENT_RESOLVED";

                return (
                  <div
                    key={evt.id || idx}
                    className={`border rounded-lg p-4 transition-all ${
                      isApproval
                        ? "bg-black text-white border-black"
                        : isResolvedEvt
                        ? "bg-neutral-50 border-black border-2"
                        : isAbstainedEvt
                        ? "texture-hatch border-black border-2"
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
                          [{evt.eventType}]
                        </span>
                        <span
                          className={`text-xs font-tech-mono ${
                            isApproval ? "text-neutral-300" : "text-neutral-500"
                          }`}
                        >
                          {new Date(evt.createdAt).toLocaleTimeString()}
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
            <h3 className="font-tech-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-2 border-b border-black/10 pb-2">
              <CheckCircle2 className="w-4 h-4 text-black" />
              <span>Objective Verification Criteria</span>
            </h3>

            <div className="space-y-2.5 text-xs font-tech-mono">
              <div className="flex items-center space-x-2 text-neutral-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                <span>Ingress Health Check == 200 OK</span>
              </div>
              <div className="flex items-center space-x-2 text-neutral-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                <span>Direct Replica Probe == Healthy</span>
              </div>
              <div className="flex items-center space-x-2 text-neutral-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                <span>PostgreSQL DB Latency &lt; 50ms</span>
              </div>
              <div className="flex items-center space-x-2 text-neutral-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                <span>Synthetic Checkout Order == 201 Created</span>
              </div>
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
                Fresh &lt; 120s
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

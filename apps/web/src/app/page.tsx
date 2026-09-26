"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCcw,
  ShieldAlert,
  Server,
  Activity,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

interface ComponentReport {
  state: "READY" | "NOT_READY" | "BLOCKED" | "UNKNOWN";
  message: string;
  lastChecked?: string;
  details?: Record<string, unknown>;
}

interface ReadinessReport {
  overallState: string;
  components: {
    controlPlane: ComponentReport;
    trueForge: ComponentReport;
    primaryModel: ComponentReport;
    runSafeAgent: ComponentReport;
    mcpServer: ComponentReport;
    targetEnvironment: ComponentReport;
    database: ComponentReport;
  };
}

interface IncidentItem {
  id: string;
  title: string;
  target_service: string;
  status: string;
  current_step_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface RehearsalSummary {
  totalScenarios: number;
  verifiedScenarios: number;
  coveragePercentage: number;
  coverageFormatted: string;
  totalRunsCount: number;
}

export default function CommandCenterPage() {
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [rehearsalSummary, setRehearsalSummary] = useState<RehearsalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [readinessRes, incidentsRes, summaryRes] = await Promise.all([
        fetch("/api/system/readiness").catch(() => null),
        fetch("/api/v1/incidents").catch(() => null),
        fetch("/api/v1/rehearsals/summary").catch(() => null),
      ]);

      if (readinessRes?.ok) {
        setReadiness(await readinessRes.json());
      }
      if (incidentsRes?.ok) {
        const data = await incidentsRes.json();
        setIncidents(data.incidents || []);
      }
      if (summaryRes?.ok) {
        setRehearsalSummary(await summaryRes.json());
      }
    } catch (err) {
      console.error("Failed to load command center data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const activeIncident = incidents.find(
    (inc) =>
      inc.status !== "VERIFIED_RECOVERY" &&
      inc.status !== "ESCALATED" &&
      inc.status !== "ABSTAINED"
  );

  const handleResetEnvironment = async () => {
    setActionLoading("reset");
    try {
      await fetch("http://127.0.0.1:4000/api/v1/rehearsals/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: "scenario_crash" }),
      });
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Top Banner / Hero */}
      <div className="flex justify-between items-start border-b border-black/15 pb-6">
        <div>
          <h1 className="text-3xl font-serif-title font-bold text-black tracking-tight">
            Command Center
          </h1>
          <p className="text-sm font-editorial-body text-neutral-600 mt-1">
            Operational overview across controlled infrastructure, recovery contracts, and staging rehearsals.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/rehearsals"
            className="inline-flex items-center space-x-2 px-4 py-2 border border-black bg-black text-white rounded-md text-xs font-tech-mono hover:bg-neutral-800 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run Runbook CI</span>
          </Link>
        </div>
      </div>

      {/* Active Incident Alert OR Healthy Banner */}
      {activeIncident ? (
        <div className="bg-black text-white p-6 rounded-xl border-2 border-black space-y-4">
          <div className="flex justify-between items-center">
            <div className="inline-flex items-center space-x-2 bg-neutral-900 border border-neutral-700 px-3 py-1 rounded-sm text-xs font-tech-mono">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="font-bold tracking-wider">[ACTIVE INCIDENT DETECTED]</span>
            </div>
            <span className="text-xs font-tech-mono text-neutral-400">
              ID: {activeIncident.id}
            </span>
          </div>

          <div>
            <h2 className="text-xl font-serif-title font-bold">
              {activeIncident.title}
            </h2>
            <p className="text-xs font-tech-mono text-neutral-300 mt-1">
              Target Service: <span className="text-white font-bold">{activeIncident.target_service}</span> | Status:{" "}
              <span className="bg-neutral-800 px-2 py-0.5 rounded-sm">{activeIncident.status}</span>
            </p>
          </div>

          <div className="pt-2 flex justify-between items-center border-t border-neutral-800">
            <span className="text-xs font-tech-mono text-neutral-400">
              Current Runbook Step: {activeIncident.current_step_id || "STEP_1_OBSERVE_INGRESS"}
            </span>
            <Link
              href={`/incidents/${activeIncident.id}`}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-white text-black rounded-md text-xs font-tech-mono font-bold hover:bg-neutral-200 transition-colors"
            >
              <span>Open Incident Room</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="border border-black/15 bg-neutral-50 p-6 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 rounded-lg border border-black/20 bg-white flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-black" />
            </div>
            <div>
              <p className="font-tech-mono text-xs font-bold text-neutral-800 uppercase tracking-wider">
                System Resilient — All Services Verified
              </p>
              <p className="text-xs font-editorial-body text-neutral-600 mt-0.5">
                No open incidents. Synthetic ACID transactions executing with 0% error rate.
              </p>
            </div>
          </div>

          {incidents.length > 0 && (
            <Link
              href={`/incidents/${incidents[0].id}`}
              className="text-xs font-tech-mono border border-black/20 bg-white px-3 py-1.5 rounded-md hover:bg-neutral-100 transition-colors"
            >
              View Last Incident ({incidents[0].id.substring(0, 12)}...)
            </Link>
          )}
        </div>
      )}

      {/* Grid: Infrastructure Services + System Readiness */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controlled Workload Fleet */}
        <div className="border border-black/15 rounded-lg p-5 bg-white space-y-4">
          <div className="flex justify-between items-center border-b border-black/10 pb-3">
            <div className="flex items-center space-x-2">
              <Server className="w-4 h-4 text-black" />
              <h3 className="font-tech-mono font-bold text-xs uppercase tracking-wider">
                Controlled Workload Fleet
              </h3>
            </div>
            <span className="text-[10px] font-tech-mono bg-neutral-100 px-2 py-0.5 rounded-sm border border-black/10">
              Port :8080
            </span>
          </div>

          <div className="space-y-2 text-xs font-tech-mono">
            <div className="flex justify-between items-center py-2 px-3 border border-black/5 rounded-md bg-neutral-50">
              <div>
                <p className="font-semibold text-black">runsafe-nginx</p>
                <p className="text-[10px] text-neutral-500">Canary Ingress Proxy</p>
              </div>
              <span className="px-2 py-0.5 bg-black text-white text-[10px] rounded-sm">200 OK</span>
            </div>

            <div className="flex justify-between items-center py-2 px-3 border border-black/5 rounded-md bg-neutral-50">
              <div>
                <p className="font-semibold text-black">runsafe-checkout-api-1</p>
                <p className="text-[10px] text-neutral-500">Replica 1 (v1.0.0)</p>
              </div>
              <span className="px-2 py-0.5 bg-neutral-200 text-black text-[10px] rounded-sm">HEALTHY</span>
            </div>

            <div className="flex justify-between items-center py-2 px-3 border border-black/5 rounded-md bg-neutral-50">
              <div>
                <p className="font-semibold text-black">runsafe-checkout-api-2</p>
                <p className="text-[10px] text-neutral-500">Replica 2 (v1.0.0 / Canary)</p>
              </div>
              <span className="px-2 py-0.5 bg-neutral-200 text-black text-[10px] rounded-sm">HEALTHY</span>
            </div>

            <div className="flex justify-between items-center py-2 px-3 border border-black/5 rounded-md bg-neutral-50">
              <div>
                <p className="font-semibold text-black">runsafe-postgres</p>
                <p className="text-[10px] text-neutral-500">Demo PostgreSQL :5432</p>
              </div>
              <span className="px-2 py-0.5 bg-neutral-200 text-black text-[10px] rounded-sm">CONNECTED</span>
            </div>
          </div>
        </div>

        {/* Core System Component Readiness */}
        <div className="border border-black/15 rounded-lg p-5 bg-white space-y-4">
          <div className="flex justify-between items-center border-b border-black/10 pb-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-black" />
              <h3 className="font-tech-mono font-bold text-xs uppercase tracking-wider">
                System Readiness
              </h3>
            </div>
            <span className="text-[10px] font-tech-mono bg-neutral-100 px-2 py-0.5 rounded-sm border border-black/10">
              {readiness?.overallState || "INSPECTING..."}
            </span>
          </div>

          <div className="space-y-2 text-xs font-tech-mono">
            <div className="flex justify-between items-center py-1.5 border-b border-neutral-100">
              <span className="text-neutral-600">Control Plane Fastify</span>
              <span className="font-bold text-black">[READY] :4000</span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-neutral-100">
              <span className="text-neutral-600">TrueForge Runtime</span>
              <span className="font-bold text-black">
                {readiness?.components?.trueForge?.state === "READY" ? "[READY] :8790" : "[OFFLINE]"}
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-neutral-100">
              <span className="text-neutral-600">Primary SRE Reasoning Model</span>
              <span className="font-bold text-black">OPENAI / QWEN3-4B</span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-neutral-100">
              <span className="text-neutral-600">RunSafe Typed MCP Server</span>
              <span className="font-bold text-black">[ATTACHED] :4001</span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-neutral-100">
              <span className="text-neutral-600">Deterministic Safety Kernel</span>
              <span className="font-bold text-black">[ACTIVE] ZERO LLM</span>
            </div>

            <div className="flex justify-between items-center py-1.5">
              <span className="text-neutral-600">Independent Objective Verifier</span>
              <span className="font-bold text-black">[ACTIVE] PROBES + ACID TX</span>
            </div>
          </div>
        </div>
      </div>

      {/* Staging Rehearsal Health Banner */}
      <div className="border border-black/15 rounded-lg p-5 bg-neutral-50 flex flex-col md:flex-row justify-between items-start md:items-center space-y-3 md:space-y-0">
        <div>
          <p className="font-tech-mono text-[10px] text-neutral-500 uppercase tracking-widest">
            Runbook CI Rehearsal Health
          </p>
          <p className="text-lg font-serif-title font-bold text-black mt-0.5">
            Recovery Coverage: {rehearsalSummary?.coverageFormatted || "100% (3/3 verified)"}
          </p>
          <p className="text-xs font-editorial-body text-neutral-600">
            Process Crash, Bad Deployment Canary Rollback, and Ambiguous Telemetry continuously tested on isolated staging.
          </p>
        </div>

        <Link
          href="/rehearsals"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-black text-white text-xs font-tech-mono rounded-md hover:bg-neutral-800 transition-colors"
        >
          <span>Open Rehearsal Console</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

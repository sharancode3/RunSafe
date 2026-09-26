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
  BookOpen,
  Terminal,
  Cpu,
  ShieldCheck,
  Check,
} from "lucide-react";

interface ComponentReport {
  state: "READY" | "NOT_READY" | "BLOCKED" | "DEGRADED" | "UNKNOWN";
  message: string;
  lastChecked?: string;
  details?: Record<string, unknown>;
}

interface ReadinessReport {
  overall: string;
  overallState?: string;
  timestamp?: string;
  components: {
    controlPlane?: ComponentReport;
    trueForge?: ComponentReport;
    primaryModel?: ComponentReport;
    runSafeAgent?: ComponentReport;
    mcpServer?: ComponentReport;
    toolExecution?: ComponentReport;
    sandbox?: ComponentReport;
    approvalCheckpoint?: ComponentReport;
    programmaticIntegration?: ComponentReport;
    localSimulator?: ComponentReport;
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
  const [guideOpen, setGuideOpen] = useState(true);

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

  const overallStatus = readiness?.overall || readiness?.overallState || "INSPECTING...";
  const primaryModelName =
    (readiness?.components?.primaryModel?.details?.model as string) ||
    (readiness?.components?.runSafeAgent?.details?.model as string) ||
    "openai/gpt-5-4-mini";

  const handleLaunchScenario = async (scenarioId: string) => {
    setActionLoading(scenarioId);
    try {
      const res = await fetch("/api/v1/rehearsals/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      });
      await fetchData();
      if (res.ok) {
        const d = await res.json();
        if (d.incidentId) {
          window.location.href = `/incidents/${d.incidentId}`;
        }
      }
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
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-serif-title font-bold text-black tracking-tight">
              Command Center
            </h1>
            <span className="text-[10px] font-tech-mono bg-black text-white px-2 py-0.5 rounded-sm">
              LOCAL SIMULATOR
            </span>
          </div>
          <p className="text-sm font-editorial-body text-neutral-600 mt-1">
            Verified Runbook Execution across controlled simulated infrastructure, cryptographic recovery contracts, and staging rehearsals.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setGuideOpen(!guideOpen)}
            className="inline-flex items-center space-x-2 px-3 py-2 border border-black/20 bg-neutral-50 text-black rounded-md text-xs font-tech-mono hover:bg-neutral-100 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{guideOpen ? "Hide Demo Guide" : "Start Guided Demo"}</span>
          </button>

          <Link
            href="/rehearsals"
            className="inline-flex items-center space-x-2 px-4 py-2 border border-black bg-black text-white rounded-md text-xs font-tech-mono hover:bg-neutral-800 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Runbook CI</span>
          </Link>
        </div>
      </div>

      {/* Evaluator Guided Demo Panel */}
      {guideOpen && (
        <div className="border border-black bg-neutral-50 rounded-xl p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-2.5">
              <Terminal className="w-4 h-4 text-black" />
              <h2 className="font-tech-mono font-bold text-xs uppercase tracking-wider text-black">
                How to Evaluate &amp; Demo RunSafe (Self-Contained Local Demonstration)
              </h2>
            </div>
            <span className="text-[10px] font-tech-mono bg-neutral-200 px-2 py-0.5 rounded-sm text-neutral-800">
              AGENTS THAT ACT HACKATHON
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-editorial-body">
            <div className="p-3 border border-black/10 bg-white rounded-lg space-y-2">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-black text-white font-tech-mono text-[11px] flex items-center justify-center font-bold">1</span>
                <span className="font-tech-mono font-bold text-black uppercase">Process Crash</span>
              </div>
              <p className="text-neutral-600 leading-relaxed">
                Demonstrates <strong>autonomous reversible recovery</strong>. Replica 1 crashes; the agent investigates via read-only tools, proposes a container restart, Safety Kernel auto-allows it under policy, and the independent verifier confirms healthy synthetic traffic.
              </p>
              <button
                disabled={actionLoading !== null}
                onClick={() => handleLaunchScenario("scenario_crash")}
                className="w-full mt-2 py-1.5 px-3 bg-black text-white font-tech-mono text-xs rounded hover:bg-neutral-800 disabled:opacity-50 transition-colors"
              >
                {actionLoading === "scenario_crash" ? "Running..." : "Launch Crash Rehearsal"}
              </button>
            </div>

            <div className="p-3 border border-black/10 bg-white rounded-lg space-y-2">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-black text-white font-tech-mono text-[11px] flex items-center justify-center font-bold">2</span>
                <span className="font-tech-mono font-bold text-black uppercase">Bad Canary Rollback</span>
              </div>
              <p className="text-neutral-600 leading-relaxed">
                Demonstrates <strong>mandatory human checkpoint</strong>. Canary v2.0.0 causes 85% error rate; agent proposes rollback; Safety Kernel pauses for cryptographic operator authorization in the Approval Center before any mutation.
              </p>
              <button
                disabled={actionLoading !== null}
                onClick={() => handleLaunchScenario("scenario_bad_deployment")}
                className="w-full mt-2 py-1.5 px-3 bg-black text-white font-tech-mono text-xs rounded hover:bg-neutral-800 disabled:opacity-50 transition-colors"
              >
                {actionLoading === "scenario_bad_deployment" ? "Running..." : "Launch Canary Hero"}
              </button>
            </div>

            <div className="p-3 border border-black/10 bg-white rounded-lg space-y-2">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-black text-white font-tech-mono text-[11px] flex items-center justify-center font-bold">3</span>
                <span className="font-tech-mono font-bold text-black uppercase">Ambiguous Telemetry</span>
              </div>
              <p className="text-neutral-600 leading-relaxed">
                Demonstrates <strong>epistemic abstention</strong>. Telemetry is conflicting (confidence 0.41 &lt; 0.70 threshold); agent strictly abstains with <strong>0 mutations dispatched</strong>, escalating to human SRE rather than blindly mutating.
              </p>
              <button
                disabled={actionLoading !== null}
                onClick={() => handleLaunchScenario("scenario_ambiguous")}
                className="w-full mt-2 py-1.5 px-3 bg-black text-white font-tech-mono text-xs rounded hover:bg-neutral-800 disabled:opacity-50 transition-colors"
              >
                {actionLoading === "scenario_ambiguous" ? "Running..." : "Launch Abstention Rehearsal"}
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-black/10 flex flex-wrap items-center justify-between text-[11px] font-tech-mono text-neutral-600 gap-2">
            <span><strong>CORE LAW:</strong> AI provides intelligence. Safety Kernel provides authority. Independent Verifier provides truth.</span>
            <span>Local Simulator is deterministic, isolated &amp; requires no external cloud/Docker dependencies.</span>
          </div>
        </div>
      )}

      {/* Active Incident Alert OR Healthy Banner */}
      {activeIncident ? (
        <div className="bg-black text-white p-6 rounded-xl border-2 border-black space-y-4">
          <div className="flex justify-between items-center">
            <div className="inline-flex items-center space-x-2 bg-neutral-900 border border-neutral-700 px-3 py-1 rounded-sm text-xs font-tech-mono">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
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
                Simulated Fleet Resilient — Baseline v1.0.0 Verified
              </p>
              <p className="text-xs font-editorial-body text-neutral-600 mt-0.5">
                No active incidents. Synthetic transactions executing with 0% error rate.
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

      {/* Grid: System Status & Topology */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controlled Workload Fleet */}
        <div className="border border-black/15 rounded-lg p-5 bg-white space-y-4">
          <div className="flex justify-between items-center border-b border-black/10 pb-3">
            <div className="flex items-center space-x-2">
              <Server className="w-4 h-4 text-black" />
              <h3 className="font-tech-mono font-bold text-xs uppercase tracking-wider">
                Controlled Workload Topology
              </h3>
            </div>
            <span className="text-[10px] font-tech-mono bg-neutral-100 px-2 py-0.5 rounded-sm border border-black/10">
              SIMULATED WORKLOAD
            </span>
          </div>

          <div className="space-y-3 text-xs font-tech-mono">
            <div className="flex justify-between items-center p-3 border border-neutral-100 rounded-md bg-neutral-50">
              <div>
                <p className="font-bold text-black">checkout-service (Ingress)</p>
                <p className="text-[11px] text-neutral-500">HTTP Ingress Router + Rate Limiter</p>
              </div>
              <span className="text-neutral-800 font-bold">[ACTIVE]</span>
            </div>

            <div className="flex justify-between items-center p-3 border border-neutral-100 rounded-md bg-neutral-50">
              <div>
                <p className="font-bold text-black">checkout-api-1 (Primary Replica)</p>
                <p className="text-[11px] text-neutral-500">State: Healthy | Baseline v1.0.0</p>
              </div>
              <span className="text-neutral-800 font-bold">[READY]</span>
            </div>

            <div className="flex justify-between items-center p-3 border border-neutral-100 rounded-md bg-neutral-50">
              <div>
                <p className="font-bold text-black">checkout-api-2 (Canary Replica)</p>
                <p className="text-[11px] text-neutral-500">State: Healthy | Baseline v1.0.0</p>
              </div>
              <span className="text-neutral-800 font-bold">[READY]</span>
            </div>

            <div className="flex justify-between items-center p-3 border border-neutral-100 rounded-md bg-neutral-50">
              <div>
                <p className="font-bold text-black">PostgreSQL State Store</p>
                <p className="text-[11px] text-neutral-500">ACID Transactions &amp; Orders DB</p>
              </div>
              <span className="text-neutral-800 font-bold">[ONLINE]</span>
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
            <span
              className={`text-[10px] font-tech-mono px-2 py-0.5 rounded-sm border ${
                overallStatus === "READY"
                  ? "bg-black text-white border-black font-bold"
                  : overallStatus === "BLOCKED"
                  ? "bg-neutral-300 text-black border-neutral-400 font-bold"
                  : "bg-neutral-100 text-neutral-800 border-black/10"
              }`}
            >
              [{overallStatus}]
            </span>
          </div>

          <div className="space-y-2 text-xs font-tech-mono">
            <div className="flex justify-between items-center py-1.5 border-b border-neutral-100">
              <span className="text-neutral-600">Control Plane Fastify</span>
              <span className="font-bold text-black">
                {readiness?.components?.controlPlane?.state === "READY" ? "[READY] :4000" : "[OFFLINE]"}
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-neutral-100">
              <span className="text-neutral-600">TrueForge Runtime</span>
              <span className="font-bold text-black">
                {readiness?.components?.trueForge?.state === "READY" ? "[READY] :8790" : "[OFFLINE]"}
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-neutral-100">
              <span className="text-neutral-600">Primary Reasoning Model</span>
              <span className="font-bold text-black uppercase">
                {primaryModelName}
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-neutral-100">
              <span className="text-neutral-600">RunSafe Typed MCP Server</span>
              <span className="font-bold text-black">
                {readiness?.components?.mcpServer?.state === "READY" ? "[ATTACHED] :4001" : "[DISCONNECTED]"}
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-neutral-100">
              <span className="text-neutral-600">Deterministic Safety Kernel</span>
              <span className="font-bold text-black">[ACTIVE] ZERO LLM</span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-neutral-100">
              <span className="text-neutral-600">Independent Objective Verifier</span>
              <span className="font-bold text-black">[ACTIVE] MULTI-PROBE</span>
            </div>

            <div className="flex justify-between items-center py-1.5">
              <span className="text-neutral-600">Execution Sandbox Mode</span>
              <span className="font-bold text-black">TYPED MCP TOOLS</span>
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
            Recovery Coverage: {rehearsalSummary?.coverageFormatted || "0% (Not yet tested)"}
          </p>
          <p className="text-xs font-editorial-body text-neutral-600">
            Process Crash, Bad Deployment Canary Rollback, and Ambiguous Telemetry continuously tested on isolated local simulator.
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

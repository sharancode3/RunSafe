"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Server,
} from "lucide-react";

interface Scenario {
  id: string;
  name: string;
  description: string;
  targetService: string;
  faultType: string;
  expectedRecoveryTool: string;
  expectedOutcome: string;
}

interface RehearsalRun {
  id: string;
  scenarioId: string;
  contractId: string;
  incidentId: string | null;
  targetEnvironment: string;
  outcome: string;
  durationMs: number;
  details: any;
  executedAt: string;
}

interface SummaryData {
  totalScenarios: number;
  verifiedScenarios: number;
  coveragePercentage: number;
  coverageFormatted: string;
  lastRunAt: string | null;
  totalRunsCount: number;
}

export default function RehearsalsPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [runs, setRuns] = useState<RehearsalRun[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [selectedScenario, setSelectedScenario] = useState("scenario_crash");
  const [running, setRunning] = useState(false);
  const [activeLog, setActiveLog] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<RehearsalRun | null>(null);

  const fetchData = async () => {
    try {
      const [scenRes, runsRes, sumRes] = await Promise.all([
        fetch("/api/v1/rehearsals/scenarios"),
        fetch("/api/v1/rehearsals"),
        fetch("/api/v1/rehearsals/summary"),
      ]);

      if (scenRes.ok) {
        const d: any = await scenRes.json();
        const scList = d.scenarios || [];
        setScenarios(scList);
        if (scList.length > 0 && !selectedScenario) {
          setSelectedScenario(scList[0].id);
        }
      }
      if (runsRes.ok) {
        const d: any = await runsRes.json();
        setRuns(d.runs || []);
      }
      if (sumRes.ok) {
        const d: any = await sumRes.json();
        setSummary(d);
      }
    } catch (err) {
      console.error("Error loading rehearsals:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunRehearsal = async () => {
    if (!selectedScenario) return;
    setRunning(true);
    setActiveLog("Starting staging rehearsal: Resetting local simulator to clean baseline...");
    try {
      const res = await fetch("/api/v1/rehearsals/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: selectedScenario }),
      });

      if (res.ok) {
        const runData: any = await res.json();
        setActiveLog(
          `Rehearsal completed with outcome: [${runData.outcome}] in ${runData.durationMs}ms (Cleanup: ${
            runData.details?.cleanup?.success ? "PASS" : "FAIL"
          })`
        );
        await fetchData();
      } else {
        const err: any = await res.json();
        setActiveLog(`Rehearsal error: ${err.error?.message || err.message || "Execution Failed"}`);
      }
    } catch (err: any) {
      setActiveLog(`Rehearsal network error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-start border-b border-black/15 pb-6">
        <div>
          <h1 className="text-3xl font-serif-title font-bold text-black tracking-tight">
            Runbook CI &amp; Staging Rehearsals
          </h1>
          <p className="text-sm font-editorial-body text-neutral-600 mt-1">
            Continuously prove recovery runbooks by injecting controlled faults into isolated local simulation before real incidents occur.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-tech-mono bg-neutral-100 border border-black/10 px-3 py-1.5 rounded-md">
          <Server className="w-3.5 h-3.5 text-black" />
          <span>ENVIRONMENT: LOCAL SIMULATOR (ISOLATED)</span>
        </div>
      </div>

      {/* Recovery Coverage Gauge Banner */}
      <div className="border border-black/15 bg-neutral-50 rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <p className="text-[10px] font-tech-mono uppercase tracking-widest text-neutral-500">
            Overall Recovery Coverage
          </p>
          <p className="text-2xl font-serif-title font-bold text-black mt-1">
            RECOVERY COVERAGE: {summary?.coverageFormatted || "0% (Not yet tested)"}
          </p>
          <p className="text-xs font-editorial-body text-neutral-600 mt-0.5">
            Recovery coverage strictly computed from fresh passing runs for the current simulator build.
          </p>
        </div>

        <div className="flex items-center space-x-4 text-xs font-tech-mono">
          <div className="text-right">
            <p className="text-neutral-500 text-[10px]">TOTAL RUNS</p>
            <p className="font-bold text-black text-sm">{summary?.totalRunsCount || 0}</p>
          </div>
          <div className="text-right">
            <p className="text-neutral-500 text-[10px]">LAST REHEARSAL</p>
            <p className="font-bold text-black text-sm">
              {summary?.lastRunAt ? new Date(summary.lastRunAt).toLocaleTimeString() : "Never"}
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Scenario Runner */}
      <div className="border border-black/15 bg-white rounded-lg p-6 space-y-4">
        <h2 className="font-tech-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-2 border-b border-black/10 pb-3">
          <Play className="w-4 h-4 text-black" />
          <span>Launch Staging Rehearsal</span>
        </h2>

        {scenarios.length === 0 ? (
          <p className="text-xs font-tech-mono text-neutral-500 py-4">
            Loading scenario catalog from control plane...
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {scenarios.map((scen) => (
              <button
                key={scen.id}
                onClick={() => setSelectedScenario(scen.id)}
                className={`p-4 rounded-lg border text-left transition-all ${
                  selectedScenario === scen.id
                    ? "border-black bg-black text-white"
                    : "border-black/15 bg-white text-black hover:border-black/50"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span
                    className={`text-[10px] font-tech-mono font-bold px-1.5 py-0.5 rounded-sm ${
                      selectedScenario === scen.id
                        ? "bg-neutral-800 text-white"
                        : "bg-neutral-100 text-neutral-800"
                    }`}
                  >
                    {scen.faultType}
                  </span>
                  <span className="text-[10px] font-tech-mono">
                    Target: {scen.targetService}
                  </span>
                </div>
                <p className="font-serif-title font-bold text-sm mt-2">{scen.name}</p>
                <p
                  className={`text-[11px] font-editorial-body mt-1 line-clamp-2 ${
                    selectedScenario === scen.id ? "text-neutral-300" : "text-neutral-600"
                  }`}
                >
                  {scen.description}
                </p>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center space-x-4 pt-2 border-t border-black/10">
          <button
            disabled={running || scenarios.length === 0}
            onClick={handleRunRehearsal}
            className="px-6 py-2.5 bg-black text-white text-xs font-tech-mono font-bold uppercase tracking-wider rounded-md hover:bg-neutral-800 disabled:opacity-50 transition-colors"
          >
            {running ? "Executing Rehearsal..." : `Run Selected Scenario [${selectedScenario}]`}
          </button>
          <span className="text-xs font-tech-mono text-neutral-500">
            Isolated to local simulator. Pre &amp; post run cleanup guaranteed.
          </span>
        </div>

        {activeLog && (
          <div className="p-3 bg-neutral-50 border border-black/15 rounded-md text-xs font-tech-mono">
            {activeLog}
          </div>
        )}
      </div>

      {/* Rehearsal Execution Log Trail */}
      <div className="border border-black/15 bg-white rounded-lg p-6 space-y-4">
        <h2 className="font-tech-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-2 border-b border-black/10 pb-3">
          <Clock className="w-4 h-4 text-black" />
          <span>Rehearsal Execution History ({runs.length})</span>
        </h2>

        {runs.length === 0 ? (
          <p className="text-xs font-tech-mono text-neutral-400 py-6 text-center">
            No rehearsals run yet. Launch a scenario above to test recovery.
          </p>
        ) : (
          <div className="space-y-3">
            {runs.map((r) => (
              <div
                key={r.id}
                onClick={() => setSelectedRun(selectedRun?.id === r.id ? null : r)}
                className="p-4 border border-black/10 rounded-lg hover:border-black/30 cursor-pointer space-y-2 bg-neutral-50 transition-all text-xs font-tech-mono"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <span
                      className={`font-bold px-2 py-0.5 rounded-sm ${
                        r.outcome === "PASS"
                          ? "bg-black text-white"
                          : "bg-neutral-300 text-black border border-black"
                      }`}
                    >
                      [{r.outcome}]
                    </span>
                    <span className="font-bold text-black">{r.scenarioId}</span>
                  </div>
                  <span className="text-neutral-500">
                    {new Date(r.executedAt).toLocaleString()} ({r.durationMs}ms)
                  </span>
                </div>

                <div className="flex justify-between items-center text-[11px] text-neutral-600">
                  <span>Contract: {r.contractId}</span>
                  {r.incidentId && (
                    <Link
                      href={`/incidents/${r.incidentId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="underline text-black font-bold flex items-center space-x-1"
                    >
                      <span>Incident {r.incidentId.substring(0, 10)}...</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>

                {selectedRun?.id === r.id && (
                  <div className="mt-3 p-3 bg-white border border-black/15 rounded text-[11px] space-y-2">
                    <p className="font-bold text-black uppercase">Run Execution Details</p>
                    <pre className="overflow-x-auto p-2 bg-neutral-100 rounded text-[10px]">
                      {JSON.stringify(r.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

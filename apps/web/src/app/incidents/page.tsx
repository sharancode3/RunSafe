"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";

interface IncidentItem {
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

export default function IncidentsListPage() {
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIncidents = async () => {
    try {
      const res = await fetch("/api/v1/incidents");
      if (res.ok) {
        const d = await res.json();
        setIncidents(d.incidents || []);
      }
    } catch (e) {
      console.error("Error loading incidents:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-start border-b border-black/15 pb-4">
        <div>
          <h1 className="text-3xl font-serif-title font-bold text-black tracking-tight">
            Incident Directory
          </h1>
          <p className="text-sm font-editorial-body text-neutral-600 mt-1">
            Historical and active incident logs executed under human-written runbook contracts.
          </p>
        </div>
        <span className="text-xs font-tech-mono bg-neutral-100 border border-black/10 px-3 py-1.5 rounded-md">
          TOTAL RECORDED: {incidents.length}
        </span>
      </div>

      {incidents.length === 0 ? (
        <div className="border border-black/15 bg-neutral-50 rounded-xl p-12 text-center space-y-2">
          <p className="text-xs font-tech-mono text-neutral-500">
            No incidents found. Run a scenario from Command Center or Runbook CI to generate an incident.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => {
            const isResolved = inc.status === "VERIFIED_RECOVERY";
            const isAbstained = inc.status === "ABSTAINED";
            const isRemediating = inc.status === "REMEDIATING" || inc.status === "INVESTIGATING";

            return (
              <Link
                key={inc.id}
                href={`/incidents/${inc.id}`}
                className="block p-5 border border-black/10 rounded-lg bg-white hover:border-black/40 transition-all text-xs font-tech-mono space-y-2"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <span
                      className={`font-bold px-2 py-0.5 rounded-sm ${
                        isResolved
                          ? "bg-black text-white"
                          : isAbstained
                          ? "bg-neutral-200 text-black border border-black/20"
                          : isRemediating
                          ? "bg-neutral-900 text-white animate-pulse"
                          : "bg-neutral-100 text-black"
                      }`}
                    >
                      [{inc.status}]
                    </span>
                    <span className="font-bold text-black text-sm font-serif-title">
                      {inc.title}
                    </span>
                  </div>
                  <span className="text-neutral-500">
                    {new Date(inc.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[11px] text-neutral-600 pt-1">
                  <span>Target Service: <strong className="text-black">{inc.target_service}</strong> | Env: {inc.environment}</span>
                  <div className="flex items-center space-x-1 font-bold text-black underline">
                    <span>Open Room ({inc.id.substring(0, 10)}...)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

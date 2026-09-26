"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, ShieldAlert, ArrowRight, Layers, FileCode, Check } from "lucide-react";

interface RunbookItem {
  id: string;
  title: string;
  description?: string;
  target_service: string;
  created_at: string;
  updated_at: string;
}

export default function RunbooksPage() {
  const [runbooks, setRunbooks] = useState<RunbookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunbook, setSelectedRunbook] = useState<string | null>(null);

  const fetchRunbooks = async () => {
    try {
      const res = await fetch("/api/v1/runbooks");
      if (res.ok) {
        const d = await res.json();
        const list = d.data || [];
        setRunbooks(list);
        if (list.length > 0 && !selectedRunbook) {
          setSelectedRunbook(list[0].id);
        }
      }
    } catch (e) {
      console.error("Error loading runbooks:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRunbooks();
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-start border-b border-black/15 pb-4">
        <div>
          <h1 className="text-3xl font-serif-title font-bold text-black tracking-tight">
            Runbook Lab
          </h1>
          <p className="text-sm font-editorial-body text-neutral-600 mt-1">
            Human-written operational recovery runbooks compiled into deterministic, cryptographic Recovery Contracts.
          </p>
        </div>
        <span className="text-xs font-tech-mono bg-neutral-100 border border-black/10 px-3 py-1.5 rounded-md">
          RECOVERY CONTRACTS: {runbooks.length}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Runbook Catalog */}
        <div className="space-y-3">
          <p className="text-xs font-tech-mono uppercase tracking-widest text-neutral-500">
            Registered Runbooks
          </p>
          {runbooks.length === 0 ? (
            <p className="text-xs font-tech-mono text-neutral-400 p-4 border border-black/10 rounded-lg">
              Loading runbooks...
            </p>
          ) : (
            runbooks.map((rb) => (
              <button
                key={rb.id}
                onClick={() => setSelectedRunbook(rb.id)}
                className={`w-full p-4 rounded-lg border text-left transition-all ${
                  selectedRunbook === rb.id
                    ? "border-black bg-black text-white"
                    : "border-black/15 bg-white text-black hover:border-black/50"
                }`}
              >
                <p className="text-[10px] font-tech-mono uppercase tracking-wider text-neutral-400">
                  {rb.target_service}
                </p>
                <p className="font-serif-title font-bold text-sm mt-1">{rb.title}</p>
                <p className="text-[11px] font-tech-mono text-neutral-500 mt-2">
                  ID: {rb.id}
                </p>
              </button>
            ))
          )}
        </div>

        {/* Right: Contract Steps & Verification Criteria */}
        <div className="lg:col-span-2 border border-black/15 bg-white rounded-lg p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-black/10 pb-3">
            <h2 className="font-tech-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-2">
              <Layers className="w-4 h-4 text-black" />
              <span>Contract Specification: checkout_recovery_runbook</span>
            </h2>
            <span className="text-[10px] font-tech-mono bg-neutral-100 px-2 py-0.5 rounded-sm">
              v1.0.0 ACTIVE
            </span>
          </div>

          <p className="text-xs font-editorial-body text-neutral-700 leading-relaxed">
            This human-authored recovery runbook defines the strictly permitted operational path for checkout-service incident recovery. The agent cannot deviate from these predefined steps.
          </p>

          <div className="space-y-3 pt-2">
            {[
              {
                id: "STEP_1_OBSERVE_INGRESS",
                title: "Observe Ingress Telemetry",
                tool: "get_service_health",
                risk: "READ_ONLY",
                reversible: true,
                autoAllowed: true,
                criteria: "HTTP Ingress returns status code",
              },
              {
                id: "STEP_2_INSPECT_LOGS",
                title: "Inspect Container Error Logs",
                tool: "get_recent_logs",
                risk: "READ_ONLY",
                reversible: true,
                autoAllowed: true,
                criteria: "Error logs captured into Evidence Vault",
              },
              {
                id: "STEP_3_CHECK_DB_HEALTH",
                title: "Verify PostgreSQL State Store",
                tool: "get_database_health",
                risk: "READ_ONLY",
                reversible: true,
                autoAllowed: true,
                criteria: "DB latency < 50ms, pool healthy",
              },
              {
                id: "STEP_4_RESTART_CONTAINER",
                title: "Restart Failed Checkout Replica",
                tool: "restart_service",
                risk: "LOW_RISK",
                reversible: true,
                autoAllowed: true,
                criteria: "Direct Replica Probe healthy, Ingress 200 OK",
              },
              {
                id: "STEP_5_ROLLBACK_CANARY",
                title: "Rollback Canary Deployment to v1.0.0",
                tool: "rollback_canary",
                risk: "HIGH_RISK",
                reversible: false,
                autoAllowed: false,
                criteria: "Synthetic checkout order returns 201 Created",
              },
            ].map((step, idx) => (
              <div
                key={step.id}
                className="p-3 border border-black/10 rounded-lg bg-neutral-50 space-y-1 text-xs font-tech-mono"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold bg-neutral-200 px-1.5 py-0.5 rounded-sm text-[10px]">
                      STEP {idx + 1}
                    </span>
                    <span className="font-bold text-black">{step.title}</span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-sm font-bold ${
                      step.autoAllowed
                        ? "bg-neutral-200 text-neutral-800"
                        : "bg-black text-white"
                    }`}
                  >
                    {step.autoAllowed ? "AUTO-ALLOWED" : "HUMAN APPROVAL REQUIRED"}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-neutral-600 pt-1">
                  <span>Tool: <code>{step.tool}</code> | Risk: {step.risk}</span>
                  <span className="italic text-neutral-500">Criteria: {step.criteria}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

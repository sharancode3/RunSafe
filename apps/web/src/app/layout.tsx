import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import {
  ShieldAlert,
  CheckCircle2,
  Terminal,
  Activity,
  Layers,
  FileText,
  AlertTriangle,
  Play,
  RotateCcw,
  BookOpen,
} from "lucide-react";

export const metadata: Metadata = {
  title: "RunSafe — Verified Autonomous Runbook Executor",
  description:
    "A TrueForge-powered autonomous Runbook Executor built for the Agents That Act Hackathon.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black antialiased flex flex-col font-sans">
        {/* Top Persistent Header */}
        <header className="border-b border-black/15 bg-white px-6 py-3 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center space-x-3">
            <span className="font-tech-mono font-bold text-xs bg-black text-white px-2 py-1 rounded-sm">
              [R] RUNSAFE
            </span>
            <span className="font-tech-mono text-xs uppercase tracking-wider text-neutral-600">
              Verified Runbook Executor
            </span>
          </div>

          {/* Ticker */}
          <div className="flex items-center space-x-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-sm text-xs font-tech-mono border border-black/15 bg-neutral-50">
              <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
              <span className="font-semibold">LOCAL SIMULATION</span>
              <span className="text-neutral-400">|</span>
              <span className="text-neutral-600">INDEPENDENT VERIFIER ACTIVE</span>
            </div>
          </div>

          {/* Model & Runtime Status */}
          <div className="flex items-center space-x-3 text-xs font-tech-mono">
            <span className="px-2 py-0.5 border border-neutral-300 rounded-sm text-neutral-700 bg-neutral-50">
              ENGINE: OPENAI [TRUEFORGE]
            </span>
            <span className="px-2 py-0.5 border border-neutral-300 rounded-sm text-neutral-700 bg-neutral-50">
              RUNTIME: TRUEFORGE :8790
            </span>
          </div>
        </header>

        {/* Main Shell: Left Command Rail + Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Navigation Rail */}
          <aside className="w-56 border-r border-black/15 bg-neutral-50 p-4 flex flex-col justify-between shrink-0">
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-tech-mono uppercase tracking-widest text-neutral-400 mb-2 px-2">
                  Navigation
                </p>
                <nav className="space-y-1">
                  <Link
                    href="/"
                    className="flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-tech-mono text-black hover:bg-black hover:text-white transition-colors"
                  >
                    <Activity className="w-4 h-4" />
                    <span>Command Center</span>
                  </Link>

                  <Link
                    href="/incidents"
                    className="flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-tech-mono text-black hover:bg-black hover:text-white transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Incidents</span>
                  </Link>

                  <Link
                    href="/approvals"
                    className="flex items-center justify-between px-3 py-2 rounded-md text-xs font-tech-mono text-black hover:bg-black hover:text-white transition-colors"
                  >
                    <div className="flex items-center space-x-2.5">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Approvals</span>
                    </div>
                    <span className="text-[10px] bg-neutral-200 text-black px-1.5 py-0.5 rounded-sm">
                      PCA
                    </span>
                  </Link>

                  <Link
                    href="/rehearsals"
                    className="flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-tech-mono text-black hover:bg-black hover:text-white transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    <span>Runbook CI</span>
                  </Link>

                  <Link
                    href="/runbooks"
                    className="flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-tech-mono text-black hover:bg-black hover:text-white transition-colors"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Runbook Lab</span>
                  </Link>
                </nav>
              </div>

              <div>
                <p className="text-[10px] font-tech-mono uppercase tracking-widest text-neutral-400 mb-2 px-2">
                  Controlled Fleet
                </p>
                <div className="px-3 py-2 text-xs font-tech-mono border border-black/10 rounded-md bg-white space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">Service:</span>
                    <span className="font-semibold">checkout-api</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">Topology:</span>
                    <span>2 Replicas</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">Adapter:</span>
                    <span className="bg-black text-white px-1 rounded-sm text-[10px]">
                      SIMULATOR
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom SRE Philosophy */}
            <div className="border-t border-black/10 pt-4 text-[10px] font-tech-mono text-neutral-500 leading-tight">
              <p className="font-semibold text-black mb-1">RUNSAFE CORE LAW:</p>
              <p>AI provides intelligence.</p>
              <p>Safety Kernel provides authority.</p>
              <p>Independent Verifier provides truth.</p>
            </div>
          </aside>

          {/* Primary Viewport Area */}
          <main className="flex-1 overflow-y-auto bg-white p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

# RunSafe — Hackathon Live Demo Walkthrough & Presentation Guide

> **Theme:** "Agents That Act" (TrueFoundry × Polaris Hackathon)  
> **Challenge:** Runbook Executor  
> **Core Law:** *AI provides intelligence. The Safety Kernel provides authority. The Independent Verifier provides truth.*

---

## 1. Executive Summary for Judges (30-Second Pitch)

RunSafe is a **Verified Autonomous Runbook Executor for Safe Incident Recovery**.

When an outage strikes, typical AI agents are either **too reckless** (blindly running hallucinated bash commands that drop databases) or **too passive** (merely generating markdown advice for an exhausted human on-call engineer).

RunSafe solves this by introducing a **three-tier separation of powers**:
1. **TrueForge Agent (Intelligence):** Reads human-authored runbooks, queries telemetry via typed MCP tools, generates diagnostic hypotheses, and proposes remediation steps.
2. **Safety Kernel (Authority):** Deterministic policy engine that validates every proposed mutation against cryptographic **Recovery Contracts**, rate limits, blast radius thresholds, and confidence bounds. Low-risk reversible steps execute automatically; destructive or high-risk mutations require signed human approval.
3. **Independent Verifier (Truth):** Never trusts the agent's word or simple container exit codes. Executes synthetic transaction verification against real infrastructure to prove recovery mathematically before closing an incident.

---

## 2. System Architecture & Live Services

All components are currently running live:

| Component | Port / URI | Description |
| :--- | :--- | :--- |
| **Product Web UI** | `http://localhost:3001` | Monochrome Next.js 15 Command Center, Incident Room, Approval Center, Runbook CI |
| **Control Plane API** | `http://localhost:4000` | Fastify REST API, SSE streaming (`/api/v1/events/stream`), SQLite audit ledger |
| **TrueForge Runtime** | `http://localhost:8790` | TrueFoundry agent runtime hosting `runsafe-agent` with toolsets |
| **RunSafe MCP Server**| `http://localhost:4001/sse` | Model Context Protocol server exposing typed observation and mutation tools |
| **Controlled Workload**| `http://localhost:8080` | Nginx Ingress routing to `checkout-api-1` (:8081) and `checkout-api-2` (:8082) backed by PostgreSQL (:5432) |

---

## 3. The 3 Demo Scenarios

### Scenario 1: Autonomous Process Crash (Low-Risk Reversible Recovery)
- **Problem:** A replica crashes due to an unhandled SIGTERM.
- **Runbook:** `rb_checkout_recovery` -> Step 4 (`restart_service`).
- **Safety Kernel Evaluation:** `LOW_RISK_REVERSIBLE`, within blast radius (1/2 replicas), confidence $\ge 0.70$.
- **Action:** Automatically approved and dispatched with zero human intervention.
- **Verification:** Independent Verifier checks replica process status and synthetic 200 responses.
- **Duration:** $< 30$ seconds.

### Scenario 2: Bad Deployment Canary Rollback (Hero Demo)
- **Problem:** `checkout-api-2` is deployed to v2.0.0, which introduces a database transaction deadlock on checkout orders (HTTP 500 spike).
- **Runbook:** `rb_checkout_recovery` -> Steps 1–6.
- **Triage & Diagnosis:** Agent investigates logs and inspects deployment versions via MCP tools.
- **Attempt 1:** Automatic restart fails because the defect is baked into v2.0.0.
- **Attempt 2:** Agent synthesizes a **Proof-Carrying Action (PCA)** proposing `rollback_canary` to v1.0.0.
- **Safety Kernel Checkpoint:** `HIGH_RISK` mutation detected! Kernel pauses execution, generates an inverted **Operational Decision Card** with a SHA-256 fingerprint, and demands human sign-off.
- **Human Approval:** Operator clicks **Approve** in the UI (`/approvals`).
- **Canary Execution:** Replica 2 is rolled back to v1.0.0. Ingress traffic is verified.
- **Verification:** Independent Verifier executes end-to-end synthetic checkout transactions with money movement. State transition: `ESCALATED` $\to$ `REMEDIATING` $\to$ `VERIFIED_RECOVERY`.

### Scenario 3: Ambiguous Telemetry with Confidence Abstention (Safety Guarantee)
- **Problem:** Intermittent network flapping causes downstream timeout spikes, but service logs and DB health are inconclusive.
- **Agent Analysis:** Confidence score evaluates to $0.45$ ($< 0.70$ threshold).
- **Safety Kernel Rule `FR-033`:** Rejects mutation, triggers `CONFIDENCE_BELOW_THRESHOLD`.
- **Epistemic Halt:** **Zero mutations dispatched.** The agent abstains from guesswork, records `INCIDENT_ABSTAINED`, and pages the primary on-call engineer.

---

## 4. Step-by-Step Live Demo Script for Screen Recording

### Phase A: Command Center Tour (0:00 - 0:45)
1. Open browser to `http://localhost:3001`.
2. Point out the top ticker:
   - System state: `SYSTEM HEALTHY` / `ALL SYSTEMS OPERATIONAL`
   - Active Incident Banner (if an incident is open)
   - Runtime badge: `RUNTIME: TRUEFORGE :8790`
   - Reasoning Engine badge: `ENGINE: OPENAI [TRUEFORGE]`
3. Highlight the **RunSafe Core Law** in the sidebar:
   - *AI provides intelligence.*
   - *Safety Kernel provides authority.*
   - *Independent Verifier provides truth.*
4. Show the **Controlled Targets** card: `checkout-api` (2 replicas on Docker).

### Phase B: Runbook CI & Staging Rehearsals (0:45 - 1:30)
1. Navigate to `http://localhost:3001/rehearsals`.
2. Point out the **100% Verified Coverage** gauge (3/3 failure modes).
3. Explain to judges: *"Before any runbook is allowed to run against production, RunSafe runs automated rehearsals in isolated staging, verifying that the agent and contracts can safely recover from every failure mode."*
4. Click **"Run Rehearsal"** on any scenario to demonstrate live staging execution.

### Phase C: The Hero Incident & Approval Flow (1:30 - 3:00)
1. Navigate to `/approvals` or `/incidents/[id]`.
2. Inspect the **Operational Decision Card**:
   - Step: `STEP_5_ROLLBACK_CANARY`
   - Action: `rollback_canary`
   - Target: `checkout-api-2` $\to$ `v1.0.0`
   - Reversibility: `REVERSIBLE`
   - Blast Radius: `50% of fleet`
   - SHA-256 Checksum
3. Click **"Approve Mutation"**.
4. Switch to `/incidents/[id]` and watch the live SSE event stream append:
   - `HUMAN_APPROVED`
   - `MUTATION_DISPATCHED`
   - `INDEPENDENT_VERIFICATION_TRIGGERED`
   - `VERIFIED_RECOVERY`

---

## 5. Verification Commands Reference

To prove every subsystem deterministically in terminal during grading:

```powershell
# 1. Run all 93 unit and integration tests across 15 test suites
npm test

# 2. Check TypeScript type-safety across all packages
npx tsc --noEmit

# 3. Verify Stage 8 (Runbook CI, Autonomous Crash Recovery, Confidence Abstention)
npm run stage8:verify

# 4. Verify Stage 9 (Product Frontend UI build, routes, and API integration)
npm run stage9:verify

# 5. Check live endpoints
curl.exe http://localhost:3001
curl.exe http://localhost:4000/health
curl.exe http://localhost:8790/api/v1/agents
curl.exe http://localhost:4001/health
```

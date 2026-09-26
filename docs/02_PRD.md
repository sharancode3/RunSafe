# RUNSAFE — Product Requirements Document (PRD)

**Document Version:** 1.0.0  
**Status:** Approved / Read-Only Source of Truth Reference  
**Product Name:** RunSafe  
**Hackathon:** Agents That Act: TrueFoundry × Polaris Hackathon (Bengaluru, Sept 2026)  
**Core Theme:** "Build agents that act, not ones that just answer."

---

## 1. Executive Summary & Vision

### 1.1 The Problem
Modern site reliability engineering (SRE) and DevOps teams rely heavily on operational runbooks—step-by-step procedures written by senior engineers to remediate infrastructure failures, process crashes, and faulty deployments. However, current industry operations suffer from two fatal flaws:
1. **Runbook Decay & Blind Trust:** Runbooks are rarely tested before production incidents occur. Teams discover that instructions are outdated, credentials changed, or commands broken only when systems are actively on fire.
2. **The "Chatbot SRE" Anti-Pattern:** Existing AI tools for DevOps are passive chatbots (e.g. summarizing logs, suggesting terminal commands). They do not act on real infrastructure, they cannot prove why an action is safe, they cannot verify if an action resolved an issue, and unrestricted AI shell execution poses catastrophic operational risk.

### 1.2 The RunSafe Solution
RunSafe is a **Verified Autonomous Incident Recovery / AI SRE Control Plane**. It bridges the gap between probabilistic LLM reasoning and mission-critical infrastructure safety:
> *"Existing runbooks tell you how to recover. RunSafe proves the runbook works, then safely executes it when production actually fails."*

RunSafe transforms static text runbooks into machine-enforceable **Recovery Contracts**, executes diagnostic analysis inside isolated **TrueForge sandboxes**, generates **Proof-Carrying Actions**, enforces safety through a deterministic **Safety Kernel**, executes progressive canary remediations against **real infrastructure via typed MCP tools**, and independently verifies business recovery before closing incidents.

---

## 2. Product Philosophy & Key Tenets

1. **AI = Intelligence, Safety Kernel = Authority, Verifier = Truth:**
   - The LLM reasons, hypothesizes, and proposes steps.
   - The deterministic Safety Kernel holds final authority over what mutations are executed.
   - The Verifier (not the LLM) executes objective checks to validate health.
2. **Act on Real Systems, Never Fabricate:**
   - No mock simulations presented as real execution. Actions execute on real containers, reverse proxies, and databases.
3. **Know When to Stop:**
   - Stop before irreversible or high-risk actions to require explicit human approval.
   - Stop and abstain when evidence confidence is insufficient.
4. **Continuous Recovery Rehearsal (Runbook CI):**
   - Treat operational runbooks like software code. Continuously test them with controlled fault injection in staging to prove recovery paths before disasters strike.

---

## 3. User Personas

| Persona | Role | Key Pain Points | How RunSafe Solves It |
|---|---|---|---|
| **Alex (On-Call SRE)** | Primary Operator | Paged at 2 AM, high stress, cognitive overload, stale documentation, fear of fat-fingering rollbacks. | Automated low-risk recovery (service restarts), instant sandbox log analysis, structured Proof-Carrying Actions for approval with blast radius visualization. |
| **Sam (Platform / DevOps Lead)** | System Architect | Runbook drift across microservices, lack of recovery test coverage, uncontrolled script execution. | Runbook CI / Recovery Rehearsals, automated drift detection, formal Recovery Contracts with rollback safety guarantees. |
| **Priya (Engineering VP / CTO)** | Executive Stakeholder | High MTTR (Mean Time to Recovery), SLA breaches, risk of unverified AI wreaking havoc in production. | Deterministic Safety Kernel guarantees fail-closed operations, zero unvetted shell execution, full audit trails for compliance. |

---

## 4. Core Capabilities & Feature Requirements

### 4.1 Feature 1: Recovery Contracts (Machine-Enforceable Runbooks)
- **Description:** Converts human free-text markdown runbooks into structured JSON/Zod-validated recovery contracts.
- **Contract Schema Requirements:**
  - `step_id`, `description`, `intent`
  - `required_evidence`: Pre-conditions of facts needed before triggering step
  - `action`: Specific typed MCP tool call
  - `risk_classification`: `READ_ONLY`, `LOW_RISK_REVERSIBLE`, `STATE_CHANGING`, `HIGH_RISK`, `DESTRUCTIVE`
  - `blast_radius`: Direct and downstream dependent services impacted
  - `approval_policy`: `AUTOMATIC`, `HUMAN_APPROVAL_REQUIRED`, `DENY`
  - `success_criteria`: Objective deterministic assertions (HTTP code, latency threshold, error rate)
  - `compensation` / `fallback`: Exact rollback procedure if step fails
- **Acceptance Criteria:** Free-form runbooks must compile into valid Recovery Contracts with zero undefined risks or ambiguous timeouts.

### 4.2 Feature 2: Proof-Carrying Actions
- **Description:** Every action proposal dispatched by the agent must bundle cryptographic-grade justification.
- **Required Metadata:**
  1. What is the action?
  2. Why is it being performed?
  3. What objective evidence justifies it?
  4. Which runbook step authorizes it?
  5. What is the blast radius?
  6. Is it reversible?
  7. What indicates success vs failure?
- **Acceptance Criteria:** The control plane rejects any mutation proposal that lacks complete Proof-Carrying Action metadata.

### 4.3 Feature 3: Deterministic Safety Kernel
- **Description:** An out-of-band policy engine that enforces hard constraints on tool calls.
- **Policy Enforcement:**
  - `READ_ONLY` -> Allowed autonomously.
  - `LOW_RISK_REVERSIBLE` (e.g. restart isolated replica) -> Allowed autonomously if permitted by active Recovery Contract.
  - `HIGH_RISK` / `DESTRUCTIVE` (e.g. rollback, traffic redirection, resource drop) -> **HARD STOP**. Dispatches approval request and blocks execution until human signs off.
  - `UNKNOWN` -> Fails **CLOSED**. Denies execution immediately.
- **Acceptance Criteria:** LLM prompt injection or hallucinated parameters can never bypass the Safety Kernel.

### 4.4 Feature 4: Sandboxed Diagnostic Code Execution (TrueForge)
- **Description:** High-volume telemetry and raw log processing is offloaded to generated Python diagnostic scripts running inside TrueForge sandboxes.
- **Workflow:**
  1. Agent notices error spike.
  2. Agent generates analysis script (`analyze_logs.py`).
  3. TrueForge executes script in an isolated sandbox.
  4. Script outputs structured JSON metrics (e.g. error distribution by version, exception frequency).
  5. Evidence Engine consumes structured output.
- **Acceptance Criteria:** Generated code never interacts directly with production infrastructure; it runs strictly isolated in the sandbox.

### 4.5 Feature 5: Progressive / Canary Remediation
- **Description:** For multi-replica systems, RunSafe applies changes progressively rather than all-at-once.
- **Workflow:**
  - Roll back `checkout-api-1` to previous stable version v1 while `checkout-api-2` remains on v2.
  - Route canary traffic and compare metrics (v1 error rate: 0.2% vs v2 error rate: 18%).
  - Confirm remediation effectiveness on the canary before executing full rollout.
- **Acceptance Criteria:** Blast radius is minimized; failed fixes only impact one canary replica.

### 4.6 Feature 6: Independent Outcome Verification & Abstention
- **Description:** Command exit code 0 does not mean recovery. The Verifier runs automated health, database, and synthetic transaction tests.
- **Confidence-Based Abstention:**
  - If diagnostic evidence yields split or low-confidence root cause hypotheses (< 70% confidence threshold), RunSafe halts autonomous remediation and requests human engineering escalation.
- **Acceptance Criteria:** Incidents remain open until all success criteria pass. Ambiguous incidents are escalated, not guessed.

### 4.7 Feature 7: Runbook CI / Continuous Recovery Rehearsal
- **Description:** Staging test harness that simulates real failures (crashes, bad versions, connection pool leaks) to verify runbook efficacy.
- **Reporting:** Produces recovery coverage scores (e.g., "82% verified recovery paths") and flags broken steps or missing compensations.
- **Acceptance Criteria:** Operators can run rehearsals on demand and review pass/fail reports.

### 4.8 Feature 8: Runbook Drift Detection & Audit Trail
- **Description:** Complete auditable timeline from incident trigger to resolution. If a runbook step repeatedly fails while an alternative succeeds, RunSafe suggests an evidence-backed update for human operator approval.
- **Acceptance Criteria:** RunSafe never silently updates operational rules. All proposals require human acceptance.

---

## 5. User Experience & Interface Requirements

The user interface is a professional SRE Command Center (Next.js + Tailwind CSS):
1. **Command Center:** Live topology, active incident ticker, MTTR counter, Runbook CI health gauge.
2. **Incident Room:** Live incident timeline, hypothesis ranking, streaming tool execution, sandboxed code viewer, live verification status.
3. **Approval Center:** Interactive card presenting Proof-Carrying Actions, evidence diffs, blast radius node highlight, and explicit Approve/Reject buttons.
4. **Dependency / Blast-Radius Graph (React Flow):** Visual topological map showing affected services and downstream dependencies.
5. **Runbook Lab & CI:** Interactive editor and rehearsal runner showing automated recovery pass/fail matrix.
6. **Audit & Postmortem:** Complete chronological log of events, tool calls, human approvals, and drift suggestions.

---

## 6. Success Metrics & Demonstration Acceptance Criteria

- **Zero Hallucinated Actions:** 100% of mutations pass through the Safety Kernel.
- **Verified Local Execution:** Zero mocked backends; real Docker Compose services.
- **Human-in-the-Loop Integrity:** Destructive / rollback actions stop cleanly for user approval.
- **Clear Hero Scenario:** Controlled deployment failure -> sandboxed log analysis -> canary rollback -> verification -> drift suggestion.

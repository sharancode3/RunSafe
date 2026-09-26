# RUNSAFE — UI/UX Specification

**Document Identifier:** RUNSAFE-UIUX-001  
**Target File Path:** `docs/06_UI_UX_SPECIFICATION.md`  
**Document Version:** 1.0.0 (Authoritative Base Specification)  
**Status:** FROZEN / BASELINE SOURCE OF TRUTH  
**Date:** 26 September 2026  
**Event:** Agents That Act: TrueFoundry × Polaris Hackathon (Bengaluru, In-Person)  
**Core Theme:** *"Build agents that act, not ones that just answer."*  
**Primary Source Documents:** `docs/RUNSAFE_PROJECT_CONTEXT.md`, `docs/03_PRD.md`, `docs/04_TRD.md`, `docs/05_WORKFLOW_AND_DATA_FLOW.md`  
**Intended Audience:** Frontend Engineers, UI/UX Designers, Product Architects, Hackathon Evaluators  

---

## 1. Document Control & Governance

### 1.1 Revision History
| Version | Date | Author / Role | Status | Description |
|---|---|---|---|---|
| **1.0.0** | 2026-09-26 | RunSafe Design Lead | Frozen Baseline | Authoritative UI/UX and product interaction specification. Defines visual design tokens, restrained rounded-corner scale, monochrome status language, page layouts, component behaviors, and live demo interaction flows. |

### 1.2 Purpose & Scope Boundaries
This document defines the complete visual, architectural, and interaction specifications for the RunSafe user interface. It establishes a high-stakes, editorial, monochrome SRE command environment built for speed, safety transparency, and live hackathon demonstration impact.

#### Explicit Scope Boundaries:
- **What This Document Owns:** Screen layout hierarchies, visual styling rules, design tokens, typography scales, monochrome semantic state indicators, wireframe anatomies, real-time timeline behaviors, human approval decision card UX, and responsive priority rules.
- **What This Document Delegates:** 
  - Backend API route handlers and SSE payloads $\longrightarrow$ `docs/16_API_SPECIFICATION.md`.
  - SQLite table structures $\longrightarrow$ `docs/07_DATA_ARCHITECTURE.md`.
  - TrueForge agent runtime internals $\longrightarrow$ `docs/08_TRUEFORGE_AGENT_ARCHITECTURE.md`.
  - Live judging presentation script $\longrightarrow$ `docs/17_DEMO_RUNBOOK_PRESENTATION_FLOW.md`.

---

## 2. Product Visual Identity & Design Philosophy

### 2.1 The Minimalist Monochrome Aesthetic
RunSafe rejects the conventional, chaotic multi-colored "SaaS dashboard" aesthetic. It embodies a **premium, architectural, editorial monochrome identity** inspired by high-end technical journals, brutalist engineering consoles, and luxury editorial design. 

```
+-----------------------------------------------------------------------------------+
|                            THE RUNSAFE VISUAL IDENTITY                            |
+-----------------------------------------------------------------------------------+
|  1. PALETTE:      Absolute Monochrome (Pure #FFFFFF & Deep #000000)               |
|  2. CORNERS:      Tasteful Controlled Rounded Corners (NO Sharp 0px Edges)        |
|  3. DEPTH:        Zero Drop Shadows; Hierarchy via Inversion, Rules & Spacing     |
|  4. TYPOGRAPHY:   Triad Hierarchy: Playfair Display + Source Serif 4 + Mono       |
|  5. TEXTURE:      Subtle Tactile Micro-Textures (Paper, Grid, Diagonal Hatch)     |
|  6. TRANSITIONS:  Instant & Purposeful (0ms - 100ms; Zero Bouncy Spring Physics) |
+-----------------------------------------------------------------------------------+
```

### 2.2 The Controlled Rounded-Corner Scale (Explicit Design System Correction)
> **CRITICAL OVERRIDE NOTICE:** The original base design template required sharp 0px corners everywhere. **RunSafe explicitly overrides this requirement.** RunSafe enforces a **tasteful, architectural rounded-corner scale** across all components. Rounded corners eliminate visual harshness while preserving an austere, authoritative, enterprise-grade feel. Bubbly, pill-shaped, or toy-like rounding is strictly prohibited.

#### Frozen Corner Radius System:
- **`radius-none` (`0px`):** Reserved strictly for structural dividers, table header separators, and vertical spine lines.
- **`radius-sm` (`4px`):** Monospace badges, status pills, code chips, tool argument tags, and inline metadata labels.
- **`radius-md` (`8px`):** Standard buttons, text inputs, dropdown selects, table rows, and secondary action cards.
- **`radius-lg` (`12px`):** Primary cards, evidence containers, timeline event blocks, and modal window frames.
- **`radius-xl` (`16px`):** Major page hero panels, active incident banners, and the Approval Center Decision Card.

### 2.3 The No-Shadow Depth Strategy
RunSafe utilizes **zero box shadows** (`box-shadow: none`). Spatial depth, component layering, and visual importance are achieved exclusively through:
1. **Black/White Inversion:** Reserving deep black backgrounds (`#000000`) with pure white text (`#FFFFFF`) for moments of extreme operational focus (e.g. active incident hero, pending approval card, verified recovery banner).
2. **Border Hierarchy:** Varying border thickness from subtle divider borders (`1px solid #E5E5E5`) to structural containment borders (`1px solid #000000`) and high-priority focus borders (`2px solid #000000`).
3. **Negative Space & Padding:** Utilizing disciplined spacing rhythm to separate logical execution phases without relying on floating colored cards.
4. **Subtle Micro-Textures:** Incorporating faint, low-opacity CSS textures to prevent visual flatness without degrading text legibility.

### 2.4 Editorial Typography Triad
RunSafe pairs three distinct typefaces to separate editorial authority, human explanation, and technical truth:

```
[Playfair Display]   --> HIGH EDITORIAL AUTHORITY
                         Used for page titles, incident status heroes, and postmortem banners.
                         (e.g., "Verified Recovery", "Autonomous Action Blocked")

[Source Serif 4]     --> HUMAN COGNITIVE EXPLANATION
                         Used for diagnostic hypotheses, runbook intent, and operator notes.
                         (e.g., "Evidence indicates connection leak in checkout replica 1...")

[JetBrains Mono]     --> DETERMINISTIC MACHINE TRUTH
                         Used for timestamps, UUIDs, tool names, exit codes, metrics, and JSON.
                         (e.g., "GET /health 503", "rollback_canary(checkout-api-1, v1)")
```

---

## 3. Design Token System

All styling must reference standardized CSS/Tailwind design tokens. Hardcoded arbitrary values are strictly prohibited.

### 3.1 Color Tokens (Absolute Monochrome)
```css
:root {
  /* Surface Layers */
  --bg-primary: #FFFFFF;          /* Pure white canvas */
  --bg-secondary: #F5F5F5;        /* Muted background for sidebars & code blocks */
  --bg-tertiary: #EBEBEB;         /* Subtle hover state for secondary rows */
  --bg-inverted: #000000;         /* Deep black for inverted focus surfaces */
  
  /* Foreground & Typography */
  --text-primary: #000000;        /* Pure black primary body and titles */
  --text-secondary: #525252;      /* Muted charcoal for metadata, subtitles, labels */
  --text-tertiary: #8A8A8A;       /* Light charcoal for timestamps and placeholders */
  --text-inverted: #FFFFFF;       /* Pure white text on inverted surfaces */
  
  /* Borders & Dividers */
  --border-light: #E5E5E5;        /* Subtle hairline dividers (1px) */
  --border-medium: #8A8A8A;       /* Secondary card outlines */
  --border-strong: #000000;       /* High-contrast structural boundaries (1px/2px) */
  --border-inverted: #FFFFFF;     /* White boundaries on dark panels */
  
  /* Interactive Accents */
  --focus-ring: #000000;          /* 2px solid black focus ring */
  --accent-black: #000000;        /* Primary button and selected state */
  --accent-white: #FFFFFF;        /* Inverted button background */
}
```

### 3.2 Spacing & Layout Tokens
RunSafe enforces an 8-point geometric scale:
- `--space-1`: `4px` (tight padding inside tags)
- `--space-2`: `8px` (button vertical padding, gap between badges)
- `--space-3`: `12px` (card internal padding, metadata gaps)
- `--space-4`: `16px` (standard card padding, grid column gaps)
- `--space-6`: `24px` (section spacing, drawer padding)
- `--space-8`: `32px` (hero panel padding, primary view gaps)
- `--space-12`: `48px` (page container margin, major editorial breaks)

### 3.3 Subtle Micro-Texture Definitions
Textures must maintain an opacity of $\le 0.04$ on light surfaces and $\le 0.08$ on dark surfaces:
- **`texture-paper` (Global Canvas):** Ultra-fine monochromatic noise overlay applied to `body`.
- **`texture-grid` (Runbook Lab / Topology):** $16\text{px} \times 16\text{px}$ hairline grid pattern (`#E5E5E5`).
- **`texture-hatch` (Abstention / Blocked Warnings):** $45^\circ$ diagonal repeating lines (`1px black`, $8\text{px}$ pitch).
- **`texture-lines-inverted` (Approval Hero / Critical Banners):** Vertical hairline pin-stripes (`#FFFFFF` at $4\%$ opacity).

---

## 4. Global Monochrome Semantic Status System

Because color is strictly prohibited, system states must be instantly, unmistakably distinguishable through **inversion, border style, typography, and explicit iconography**.

| Semantic State | Visual Treatment & Surface | Border Style | Icon Category | Text Label Format (JetBrains Mono) |
|---|---|---|---|---|
| **HEALTHY / NORMAL** | Pure White (`#FFFFFF`) | `1px solid #E5E5E5` | CheckCircle (Outline) | `[HEALTHY] 200 OK` |
| **INVESTIGATING / ACTIVE** | Muted Gray (`#F5F5F5`) | `1px dashed #000000` | Search / Activity | `[INVESTIGATING] LOGS INGESTED` |
| **AWAITING APPROVAL** | **Pure Black Inverted** (`#000000`) | `2px solid #000000` | AlertTriangle / Hand | `[APPROVAL REQUIRED] HIGH-RISK MUTATION` |
| **AUTONOMOUS EXECUTION**| White with Double Border | `2px double #000000`| Play / Terminal | `[EXECUTING] RESTART_SERVICE` |
| **VERIFYING OBJECTIVE** | White with Texture Grid | `1px dashed #8A8A8A` | ShieldCheck / Activity | `[VERIFYING] PROBES ACTIVE (2/4)` |
| **VERIFIED RECOVERY** | White with Heavy Border | `2px solid #000000` | ShieldCheck (Solid) | `[VERIFIED RECOVERY] ALL PROBES PASS` |
| **RECOVERY FAILED** | Light Gray with Hatch Pattern | `1px solid #000000` | XCircle (Outline) | `[FAILED RECOVERY] ACTION INEFFECTIVE` |
| **ABSTAINED / BLOCKED** | **Diagonal Line Hatch** (`texture-hatch`)| `2px solid #000000` | Slash / ShieldAlert | `[AUTONOMOUS ACTION BLOCKED] UNCERTAINTY`|
| **RUNBOOK DRIFT DETECTED**| White with Dot Pattern Border | `1px dotted #000000`| GitBranch / RefreshCw| `[DRIFT DETECTED] REVISION PROPOSED` |

*Accessibility Rule:* No status may ever be communicated through border weight or fill alone. An explicit uppercase text label (e.g. `[APPROVAL REQUIRED]`) and an accompanying icon are **mandatory** on all state representations.

---

## 5. Product Shell & Global Navigation Architecture

RunSafe utilizes an **editorial command rail** optimized for instant situational awareness and rapid incident response:

```
+------------------------------------------------------------------------------------------------------+
| [R] RUNSAFE SRE CONTROL PLANE     | ACTIVE INCIDENT: INC-002 [CRITICAL] | AGENT: ACTIVE | MTTR: 04:12|
+------------------------------------------------------------------------------------------------------+
| [RAIL]    |                                                                                          |
|           |                                                                                          |
| Command   |                                                                                          |
| Center    |                                                                                          |
|           |                                                                                          |
| Incidents |                                                                                          |
| [1 Active]|                                                                                          |
|           |                                    PRIMARY WORKSPACE                                     |
| Approvals |                                                                                          |
| [1 Alert] |                                                                                          |
|           |                                                                                          |
| Runbook   |                                                                                          |
| Lab       |                                                                                          |
|           |                                                                                          |
| Rehearsal |                                                                                          |
| (CI)      |                                                                                          |
|           |                                                                                          |
| Topology  |                                                                                          |
|           |                                                                                          |
| Audit Log |                                                                                          |
+-----------+------------------------------------------------------------------------------------------+
```

### 5.1 Global Persistent Header
- **Left:** RunSafe wordmark in `Playfair Display` + SRE Control Plane descriptor (`JetBrains Mono`).
- **Center (Incident Ticker):** 
  - If incident is active: Inverted black pill displaying `● ACTIVE INCIDENT: INC-002` + affected service (`checkout-api`) + severity (`CRITICAL`) + running MTTR stopwatch (`02:45`). Clicking jumps directly to the Incident Room.
  - If system is healthy: Muted white pill displaying `○ SYSTEM RESILIENT — ALL SERVICES VERIFIED`.
- **Right (System Telemetry & Mode):**
  - Model indicator: `ENGINE: QWEN3-4B [OLLAMA]` or `ENGINE: GPT-4O [HOSTED]`.
  - TrueForge status: `TRUEFORGE: ONLINE (:8790)`.

### 5.2 Navigation Rail Specifications
- Slim vertical rail on the left ($72\text{px}$ width collapsed on laptop, expandable to $200\text{px}$).
- Top-to-bottom destinations:
  1. **Command Center:** High-level topology overview and system readiness.
  2. **Incident Room:** Live incident triage, timeline, and remediation runner.
  3. **Approval Center:** Pending Proof-Carrying Actions awaiting operator sign-off. (Displays black notification badge with pending count).
  4. **Runbook Lab:** Markdown runbook ingestion, compilation, and Recovery Contract inspection.
  5. **Runbook CI (Rehearsals):** Continuous staging rehearsal runner and recovery coverage matrix.
  6. **Recovery Graph:** React Flow service topology, blast-radius mapping, and canary routes.
  7. **Audit & Postmortems:** Historical chronological logs and runbook drift proposals.
- **Active State:** Selected navigation item inverts (`bg-black text-white`) with `radius-md` ($8\text{px}$) bounds.

---

## 6. Page-by-Page Specifications & Wireframe Anatomies

### 6.1 Command Center (`/`)
- **Purpose:** Primary operational overview communicating system resilience, active failures, and rehearsal readiness.
- **Above-the-Fold Priority:** Active incident alerts take 100% precedence. If an incident is active, a high-contrast inverted banner occupies the top half of the screen.

```
+------------------------------------------------------------------------------------------------------+
| COMMAND CENTER                                                      SYSTEM READINESS: 100% VERIFIED  |
| Operational overview across controlled infrastructure and continuous recovery rehearsals             |
+------------------------------------------------------------------------------------------------------+
| [ACTIVE INCIDENT BANNER (INVERTED BLACK PANEL - radius-xl)]                                          |
|                                                                                                      |
|  INCIDENT INC-002                                                          ELAPSED TIME: 03:14       |
|  Checkout API Failure: Error Rate Exceeds 15% (HTTP 503)                  PHASE: AWAITING APPROVAL   |
|                                                                                                      |
|  Hypothesis: Connection Pool Leak in v2 Deployment (94.2% Conf)           ACTION REQUIRED:           |
|  Target: checkout-api-1 | Blast Radius: orders, payments                   [REVIEW PROOF & APPROVE]  |
|                                                                                                      |
+------------------------------------------------------------------------------------------------------+
| [TOPOLOGY & SERVICES (radius-lg)]                | [RUNBOOK CI REHEARSAL HEALTH (radius-lg)]         |
|                                                  |                                                   |
| Service         Version   Status      Health     | Scenario             Target    Status   Coverage  |
| ------------------------------------------------ | ------------------------------------------------- |
| nginx-ingress   v1.25     ACTIVE      200 OK     | 1. Service Crash     api-1     PASS     100%      |
| checkout-api-1  v2.0      DEGRADED    503 ERR    | 2. Bad Deployment    api-1/2   PASS     100%      |
| checkout-api-2  v2.0      DEGRADED    503 ERR    | 3. Ambiguous Outage  api-1     PASS     100%      |
| postgres-db     v16.0     CONNECTED   NORMAL     | ------------------------------------------------- |
|                                                  | OVERALL RECOVERY COVERAGE: 100% (3/3 VERIFIED)    |
+------------------------------------------------------------------------------------------------------+
```

### 6.2 Incident Room (`/incidents/[id]`) — The Hero Experience
- **Purpose:** The principal live triage screen where judges and operators watch RunSafe observe real infrastructure, execute sandboxed Python analysis, construct Proof-Carrying Actions, enforce approvals, and objectively verify recovery.
- **Screen Layout:** Responsive two-column split-view ($65\%$ Left: Live Chronological Timeline; $35\%$ Right: Contextual Evidence & Blast-Radius Inspector).

```
+------------------------------------------------------------------------------------------------------+
| INCIDENT ROOM: INC-002                                                   STATUS: AWAITING APPROVAL   |
| Service: checkout-api | Started: 10:14:22 UTC | Contract: CHECKOUT-RECOVERY v1.0 | MTTR: 03:45       |
+------------------------------------------------------------------------------------------------------+
| [LIVE AGENT CHRONOLOGICAL TIMELINE (65%)]        | [EVIDENCE & BLAST-RADIUS INSPECTOR (35%)]         |
|                                                  |                                                   |
| 10:14:22 [ANOMALY DETECTED]                      | CURRENT ROOT CAUSE HYPOTHESIS                     |
| Ingress 5xx error rate spiked to 18.5%.          | Version v2 Connection Pool Leak                   |
| Source: Nginx Telemetry Poller (EVD-101)         | Confidence Signal: 0.94 / 1.00                    |
|                                                  | Supporting Evidence: EVD-101, EVD-102, EVD-103    |
| 10:14:28 [READ-ONLY OBSERVATION]                 | ------------------------------------------------- |
| Tool: get_recent_logs(checkout-api, 500 lines)   | SUPPORTING EVIDENCE VAULT                         |
| Result: 500 lines returned. 142 connection       |                                                   |
| timeout exceptions detected.                     | [EVD-101] HTTP 503 Spike (18.5% rate)             |
|                                                  |   Source: Nginx Ingress | 10:14:22 UTC            |
| 10:14:35 [TRUEFORGE SANDBOX ANALYSIS]            | [EVD-102] Error Log Burst (142 exceptions)        |
| Script: analyze_logs.py (Isolated Container)     |   Source: Docker Container | 10:14:28 UTC         |
| Result: 94.2% of exceptions correlate with v2.  | [EVD-103] Sandbox Statistical Correlation         |
| Stderr: Empty | Exit Code: 0 (EVD-103)           |   Source: TrueForge Sandbox | 10:14:35 UTC        |
|                                                  | ------------------------------------------------- |
| 10:14:42 [LOW-RISK REVERSIBLE ACTION]            | TOPOLOGY BLAST RADIUS                             |
| Step 1: restart_service(checkout-api-1)          |                                                   |
| Safety Kernel: AUTO-AUTHORIZED (Contract Rule)   | [checkout-api-1] (TARGET: MUTATING)               |
| Result: Container restarted (1,420ms).           |       |                                           |
|                                                  |       +--> [order-service] (DOWNSTREAM IMPACT)    |
| 10:14:50 [INDEPENDENT VERIFICATION FAILED]       |       +--> [payment-gateway] (DOWNSTREAM IMPACT)  |
| Probe 1: GET /health --> 503 ERROR               | ------------------------------------------------- |
| Probe 2: Synthetic Checkout --> FAILED           | OBJECTIVE VERIFICATION CRITERIA                   |
| Outcome: Action Executed / Recovery INEFFECTIVE  | [ ] Ingress Health Check == 200 OK                |
|                                                  | [ ] Direct Replica Probe == Healthy               |
| 10:15:02 [PROOF-CARRYING ACTION CONSTRUCTED]     | [ ] PostgreSQL Query Latency < 50ms               |
| Proposing: rollback_canary(checkout-api-1, v1)   | [ ] Synthetic Checkout Order == 201 Created       |
| Safety Kernel: HIGH-RISK -> APPROVAL REQUIRED    |                                                   |
| >> SYSTEM PAUSED AWAITING OPERATOR <<            |                                                   |
+------------------------------------------------------------------------------------------------------+
```

### 6.3 Approval Center (`/approvals`) & The Operational Decision Card
- **Purpose:** Where the operator conducts informed operational evaluations. The Proof-Carrying Action is presented as a high-stakes, black-inverted architectural card.

```
+------------------------------------------------------------------------------------------------------+
| [OPERATIONAL DECISION CARD: ACTION PCA-401 (INVERTED BLACK PANEL - radius-xl)]                       |
|                                                                                                      |
|  PROPOSED MUTATION:                                          RISK CLASSIFICATION: HIGH_RISK          |
|  rollback_canary(replica: "checkout-api-1", version: "v1")   REVERSIBILITY: 100% REVERSIBLE          |
|                                                                                                      |
|  OPERATIONAL JUSTIFICATION (THE "WHY"):                                                              |
|  "Sandboxed log analysis (EVD-103) proved that 94.2% of 503 errors correlate exclusively with        |
|  version v2 deployment. Initial service restart (Step 1) failed independent verification. Step 2     |
|  authorizes canary rollback of a single replica to minimize blast radius."                           |
|                                                                                                      |
|  AUTHORIZING CONTRACT: CHECKOUT-RECOVERY v1.0 [STEP-002: CANARY ROLLBACK]                            |
|                                                                                                      |
|  BLAST RADIUS & AFFECTED SERVICES:                           ROLLBACK & COMPENSATION PLAN:           |
|  - checkout-api-1 (Direct Target: 50% traffic slice)        If canary rollback verification fails,   |
|  - order-service (Dependent consumer)                        re-route 100% traffic to replica 2 and   |
|  - payment-gateway (Dependent consumer)                      escalate to Senior SRE on-call.         |
|                                                                                                      |
|  PRECONDITION EVALUATION:                                    OBJECTIVE SUCCESS CRITERIA:             |
|  [x] Error rate > 5.0% confirmed (Current: 18.5%)            1. Ingress GET /health == 200 OK        |
|  [x] Sibling replica checkout-api-2 running v2               2. Synthetic order placement succeeds   |
|  [x] PostgreSQL database confirmed healthy (latency: 12ms)   3. Canary error rate < 1.0% over 15s    |
|                                                                                                      |
|  OPERATOR AUDIT SIGNATURE (OPTIONAL NOTE):                                                           |
|  [ Approving canary rollback to verify v1 stability on 50% traffic slice.           ]                |
|                                                                                                      |
|  +--------------------------------------------+    +-----------------------------------------------+ |
|  | [APPROVE & EXECUTE MUTATION] (radius-md)   |    | [REJECT & ESCALATE TO SRE] (radius-md)        | |
|  | Pure White Button, Black Text              |    | Black Outline Button, White Text              | |
|  +--------------------------------------------+    +-----------------------------------------------+ |
+------------------------------------------------------------------------------------------------------+
```

### 6.4 Recovery & Dependency Graph View (`/topology`)
- **Technology:** Implemented using React Flow (`@xyflow/react`) styled in monochrome.
- **Node Semantics:**
  - **Standard Service Node:** White fill, `1px solid #000000`, `radius-md` ($8\text{px}$). Displays service name, version badge (`v1`), and latency.
  - **Mutating / Target Node:** Deep black inverted fill (`#000000`), white text, `2px solid #000000`. Displays animated dashed border while mutation is executing.
  - **Blast-Radius Downstream Node:** White fill with diagonal hatch border (`texture-hatch`), showing impacted dependencies.
  - **Database Node:** Cylindrical visual styling with connection pool saturation gauge.
- **Canary Routing Visualization:** Directed edges from `nginx-ingress` render traffic split percentage labels: `[50% Traffic -> api-1 (v1)]` and `[50% Traffic -> api-2 (v2)]`.

### 6.5 Runbook Lab (`/runbooks`)
- **Purpose:** Interactive environment where operators import Markdown runbooks, inspect compiled Recovery Contracts, validate tool bindings, and review drift proposals.
- **Split-View Comparison:**
  - **Left Pane ($50\%$):** Raw human-authored Markdown document with line numbering.
  - **Right Pane ($50\%$):** Structured Recovery Contract rendered as interactive collapsible step blocks with Zod validation status badges.
- **Contract Step Block Elements:** Step ID, Intent description, Precondition checklist, Target MCP tool badge, Risk tier tag, Compensation procedure, and Transition pointers (`on_success`, `on_failure`).

### 6.6 Runbook CI / Recovery Rehearsal Console (`/rehearsal`)
- **Purpose:** The staging test runner where runbooks are continuously proven through automated fault injection before real emergencies occur.
- **Key Display Elements:**
  1. **Scenario Runner Header:** Dropdown to select Recovery Contract (`CHECKOUT-RECOVERY v1.0`) and target failure scenario. Primary button: **[Run Continuous Rehearsal]** (`bg-black text-white radius-md`).
  2. **Scenario Execution Matrix:**
     - Columns: Scenario Name, Injected Fault, Steps Attempted, Verification Result, Duration, Status.
     - Row 1: *Process Crash* | `SIGKILL api-1` | 1 Step (Restart) | PASS (200 OK) | $12.4\text{s}$ | `[VERIFIED]`
     - Row 2: *Bad Deployment* | `Deploy Buggy v2` | 2 Steps (Canary) | PASS (201 Created) | $28.6\text{s}$ | `[VERIFIED]`
     - Row 3: *Ambiguous Latency* | `Network Delay` | 0 Steps (Abstain) | PASS (Safely Stopped) | $08.2\text{s}$ | `[VERIFIED]`
  3. **Recovery Coverage Gauge:** Large editorial metric display:
     ```
     RECOVERY COVERAGE: 100%
     3 of 3 operational failure modes verified against controlled staging infrastructure.
     Last full rehearsal completed: Today at 09:30 UTC.
     ```

### 6.7 Audit & Postmortem Console (`/audit`)
- **Purpose:** Comprehensive, chronological reconstruction of an incident from alert trigger to verified resolution.
- **Timeline Table Columns:** Timestamp (UTC), Actor (`AGENT`, `SAFETY_KERNEL`, `HUMAN_OPERATOR`, `VERIFIER`), Event Type, Target Resource, Result, Proof Link (`[View PCA]`).
- **Postmortem Summary Block:** AI-synthesized narrative report labeled with `[SYNTHESIZED POSTMORTEM — AUDIT RECORD AUTHORITATIVE]`.
- **Runbook Drift Card:** Displays side-by-side diff showing proposed runbook updates with **[Accept Revision]** and **[Dismiss]** actions.

---

## 7. Reusable Component System & Interaction Patterns

All UI elements belong to a strictly defined, composable component library:

### 7.1 Buttons & Interactive Controls
- **Primary Action Button (`btn-primary`):** 
  - Background: `#000000`; Text: `#FFFFFF`; Border: `1px solid #000000`; Border Radius: `radius-md` ($8\text{px}$).
  - Padding: `10px 20px`; Font: `JetBrains Mono`, $13\text{px}$, bold uppercase.
  - Hover: Inverts to `bg-white text-black` with instant $50\text{ms}$ transition.
- **Secondary Action Button (`btn-secondary`):**
  - Background: `#FFFFFF`; Text: `#000000`; Border: `1px solid #000000`; Border Radius: `radius-md` ($8\text{px}$).
  - Hover: Inverts to `bg-black text-white`.
- **Destructive / Rejection Button (`btn-destructive`):**
  - Background: `#FFFFFF`; Text: `#000000`; Border: `2px dashed #000000`; Border Radius: `radius-md` ($8\text{px}$).
  - Displays explicit warning prefix icon. Hover: Inverts to `bg-black text-white`.

### 7.2 Badges & Technical Tags
- **Risk Tier Badge:** Small rectangular pill (`radius-sm` $4\text{px}$), $11\text{px}$ `JetBrains Mono`:
  - `READ_ONLY`: White background, `1px solid #E5E5E5`, text `#525252`.
  - `LOW_RISK_REVERSIBLE`: White background, `1px solid #000000`, text `#000000`.
  - `HIGH_RISK`: Inverted black background, text `#FFFFFF`.
  - `DESTRUCTIVE`: Inverted black background with white outline border.
- **Evidence Badge (`badge-evidence`):** `[EVD-101]` rendered in monospace with underline. Clicking opens evidence inspector drawer.

### 7.3 The Live Timeline Event Card
Every event in the Incident Room timeline renders as an architectural card with `radius-lg` ($12\text{px}$) and a vertical timeline spine:
- **Header:** Timestamp + Actor tag + Event Category pill.
- **Body:** Concise plain-English explanation in `Source Serif 4`.
- **Footer:** Monospace metadata block displaying tool parameters, exit code, and execution duration.

---

## 8. Visualizing the Core Hero Scenarios

### 8.1 Scenario 1: Autonomous Process Crash Recovery (Service Crash)
1. **Initial Alert:** Ingress `/health` fails. Active incident banner mounts on Command Center with tag `[DETECTED]`.
2. **Timeline Progression:** 
   - Event 1: `[OBSERVATION]` reads Docker state; identifies container exit code `137`.
   - Event 2: `[POLICY DECISION]` Safety Kernel evaluates `restart_service` as `LOW_RISK_REVERSIBLE`. Badge: `AUTO-AUTHORIZED`.
   - Event 3: `[TOOL EXECUTION]` Container restarted in $1,240\text{ ms}$.
   - Event 4: `[INDEPENDENT VERIFICATION]` Multi-probe checklist passes.
3. **Resolution:** Screen inverts momentarily to black banner: `VERIFIED RECOVERY — ZERO OPERATOR INTERVENTIONS REQUIRED`. Total time $< 30$ seconds.

### 8.2 Scenario 2: Bad Deployment, Sandboxed Diagnostics & Canary Rollback (Hero Demo)
1. **Error Spike:** Controlled deployment of `v2` causes 5xx error rate to jump to $18.5\%$.
2. **Sandbox Analysis:** Timeline renders event card: `[TRUEFORGE SANDBOX ANALYSIS]`. Clicking expands preview of `analyze_logs.py` and shows output: `94.2% of exceptions correlate with v2`.
3. **Ineffective Restart:** Contract Step 1 (Restart) executes. Verifier runs probes; returns `HTTP 503 ERROR`. Timeline card renders: `ACTION EXECUTED / RECOVERY INEFFECTIVE — INCIDENT REMAINS OPEN`.
4. **Approval Request:** Screen smoothly scrolls to mount the black inverted **Operational Decision Card** (`PCA-401`). Focus locks on approval actions.
5. **Canary Execution:** SRE clicks **[Approve & Execute]**. Timeline renders: `[CANARY ROLLBACK: CHECKOUT-API-1 -> V1]`.
6. **Telemetry Comparison Graph:** Recharts dual-line chart renders in real time:
   - Line 1 (Canary `api-1`, v1): Error rate drops to $0.1\%$.
   - Line 2 (Baseline `api-2`, v2): Error rate remains $18.5\%$.
7. **Fleet Rollback & Final Verification:** Fleet rollback executes. Verifier runs `POST /api/checkout/synthetic-order`; returns `HTTP 201 Created`. Incident marked `RESOLVED`.
8. **Runbook Drift:** Postmortem renders a drift proposal card: *"Recommend checking version delta prior to restart."* Operator clicks **[Accept Proposal]**.

### 8.3 Scenario 3: Confidence-Based Abstention on Ambiguous Failure
1. **Telemetry Anomaly:** Intermittent latency ($1,200\text{ms}$) injected without error logs.
2. **Triage:** Investigator computes hypotheses: Database ($41\%$), Network ($32\%$), Memory ($27\%$).
3. **Epistemic Halt:** Timeline renders high-contrast hatched card (`texture-hatch`):
   ```
   [AUTONOMOUS ACTION BLOCKED — CONFIDENCE 0.41 BELOW 0.70 THRESHOLD]
   RunSafe has deliberately halted autonomous remediation to prevent unintended blast radius.
   Root cause evidence is ambiguous. Escalation ticket paged to Senior SRE on-call.
   ```
4. **Result:** Proves to evaluators that RunSafe *"knows when to stop"*.

---

## 9. Real-Time Streaming & State Synchronization UX

### 9.1 Non-Disruptive Event Appending
- New timeline events stream via Server-Sent Events (`GET /api/v1/events/stream`).
- Events append to the top of the timeline with a crisp $80\text{ms}$ fade-in.
- **Smart Scroll Lock:** If the operator has scrolled down to inspect historical logs, incoming events do not force-scroll the page. A floating button appears: `↓ Jump to Latest Event (2 new)`.
- If the operator is at the top of the timeline, new events smoothly push content downward without jarring layout shifts.

### 9.2 Reconnection & Network Resilience
If local SSE connection drops:
- A subtle top banner displays: `[NETWORK RECONNECTING...]`.
- UI attempts exponential backoff reconnection.
- Upon reconnection, UI requests state reconciliation (`GET /api/v1/incidents/:id/reconcile`) to fetch missing events. Zero duplicated timeline entries.

---

## 10. Responsive Design & Viewport Adaptations

RunSafe is built primarily for 14-inch to 16-inch laptops (standard hackathon and SRE on-call workstations):

| Viewport Category | Width Breakpoint | Primary Layout Adjustments |
|---|---|---|
| **Desktop / Laptop (Hero)** | $\ge 1280\text{px}$ | Full two-column split-view in Incident Room ($65/35$). Persistent left navigation rail ($72\text{px}$). Live topology graph side-by-side with evidence vault. |
| **Tablet / Compact** | $768\text{px} - 1279\text{px}$ | Navigation rail collapses to bottom bar. Incident Room stacks into single vertical column: Header $\rightarrow$ Timeline $\rightarrow$ Collapsible Evidence Accordion. |
| **Mobile Emergency** | $< 768\text{px}$ | Dedicated Emergency Response Mode. Large typography scales down ($32\text{px}$ max). Incident status and Approval Decision Card occupy full screen. Secondary graphs hidden behind tabs. |

---

## 11. Accessibility & Assistive Tech Architecture (WCAG 2.1 AAA)

RunSafe complies with strict enterprise accessibility standards:
1. **Absolute Contrast:** Pure black on pure white exceeds the $7:1$ contrast ratio for all body copy and controls.
2. **Keyboard-Only Incident Command:**
   - `Tab` / `Shift+Tab`: Clean, visible 2px black focus rings (`outline: 2px solid #000000; outline-offset: 2px;`).
   - `Shift + A`: Instant focus on the primary **[Approve & Execute]** button in the Approval Center.
   - `Shift + R`: Instant focus on the **[Reject]** button.
   - `Escape`: Closes open drawers and modal inspectors.
3. **Screen Reader Landmarks:** Proper semantic tags (`<main>`, `<nav>`, `<aside>`, `<section aria-labelledby="...">`). All state badges include hidden descriptive text (e.g. `<span className="sr-only">Incident status: Awaiting Operator Approval</span>`).

---

## 12. UI Truthfulness, Content Guidelines & Copywriting Rules

### 12.1 Absolute UI Truthfulness Directives
1. **Zero Mocked Success States:** The UI must never display "Service Restarted" unless Docker API returns exit code 0.
2. **Zero Premature Resolution:** The UI must never display "Incident Resolved" until the Independent Verifier passes synthetic checkout transactions.
3. **Transparent Execution Boundaries:** The interface must visibly distinguish *Analysis* (Sandbox Python code) from *Mutation* (Real Docker container changes).

### 12.2 SRE Copywriting Standards
- **Tone:** Calm, authoritative, concise, precise, technical.
- **Prohibited Anthropomorphism:** Never use "I think", "I believe", "RunSafe feels".
- **Approved Phrasing:**
  - *"Current diagnostic hypothesis correlates 503 errors with v2 deployment."*
  - *"Deterministic Safety Kernel policy mandates human approval for canary rollback."*
  - *"Independent verification failed: synthetic transaction timed out after 5,000ms."*

---

## 13. UX Acceptance Criteria & Live Demo Success Metrics

| UX Metric / Interaction | Acceptance Benchmark | Verification Method |
|---|---|---|
| **Situational Awareness Speed** | Operator identifies active incident severity and current phase in $< 3$ seconds. | Visual inspection of Command Center hero panel. |
| **Approval Comprehension** | Operator understands proposed action, evidence, and blast radius within $< 10$ seconds. | Review of Operational Decision Card in Approval Center. |
| **Visual State Disambiguation** | 100% of observers distinguish safe actions, sandbox analysis, and real mutations without color. | Monospace status labels and distinct border/inversion styles. |
| **Accidental Click Prevention** | Approval requires deliberate click on high-contrast button; Enter key disabled for mutations. | Keyboard event testing on Approval form. |
| **Rehearsal Coverage Clarity** | Evaluator can inspect exact pass/fail scenario breakdown and coverage percentage. | Runbook CI scenario matrix inspection. |

---

## 14. UI/UX Completion & Downstream Handoff

### 14.1 Frozen Decisions in this Specification
1. **Visual System:** Minimalist Monochrome system (pure black `#000000` and pure white `#FFFFFF` only; zero accent colors; zero drop shadows).
2. **Corner Scale:** Enforced **controlled rounded-corner scale** (`radius-sm` 4px to `radius-xl` 16px). All 0px sharp-corner rules are completely overridden.
3. **Typography:** Triple-font architecture (`Playfair Display`, `Source Serif 4`, `JetBrains Mono`).
4. **Hero Workspaces:** Complete wireframe anatomies frozen for Command Center, Incident Room, Approval Center, Runbook Lab, Runbook CI, and Audit.
5. **Real-Time Experience:** Server-Sent Events integration with smart scroll lock and offline reconnection handling.

### 14.2 Downstream Document Boundaries
This document hands off directly to the remaining implementation blueprints:
- **`docs/07_DATA_ARCHITECTURE.md`:** Maps UI evidence cards and timeline items to SQLite relational tables.
- **`docs/16_API_SPECIFICATION.md`:** Maps UI action buttons and approval forms to REST endpoints.
- **`docs/17_DEMO_RUNBOOK_PRESENTATION_FLOW.md`:** Utilizes the screen wireframes to script the step-by-step judge demonstration flow.

---
*End of Authoritative UI/UX Specification — RunSafe v1.0.0*

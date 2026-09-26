# RunSafe Project Memory

## Official Challenge Definition & Primary Positioning
**Problem Statement:** Runbook Executor  
**Hackathon Theme:** Agents That Act (TrueFoundry × Polaris Hackathon, Bengaluru, 26 September 2026)  
**Primary Product Definition:**  
> **RunSafe — Verified Autonomous Runbook Executor for Safe Incident Recovery**  
> *A TrueForge-powered agent that executes human-written recovery runbooks against real infrastructure, automatically performs safe reversible steps, pauses destructive/high-risk steps for human approval, and independently verifies whether recovery succeeded.*  
*(Category descriptor: AI SRE Control Plane)*

## Current Stage
Stage 8: Runbook CI, Crash Recovery, and Confidence Abstention (Completed & Verified)
Stage 9: RunSafe Product Frontend UI (Completed & Verified)
All Stage 1–9 automated verifiers are 100% green; 93 unit and integration tests passing across 15 test suites; Next.js 15 production build compiled cleanly.

## Completed
- Official Problem Statement Alignment Audited & Locked: RunSafe is positioned unmistakably as a **Runbook Executor** first. All architectural subsystems (Recovery Contracts, Evidence Engine, Proof-Carrying Actions, Safety Kernel, TrueForge Sandbox, Progressive Canary Rollback, Independent Verifier, Runbook CI) are explicitly structured as capabilities that enhance and guarantee safe runbook execution.
- Canonical Master Project Context initialized and locked in `docs/RUNSAFE_PROJECT_CONTEXT.md` (Read-Only source of truth).
- Living implementation memory established in `docs/RUNSAFE_PROJECT_MEMORY.md`.
- Git repository initialized on `main` branch with remote: `https://github.com/sharancode3/RunSafe.git`.
- Strict `.gitignore` created to prevent leaking secrets, node_modules, environment files, SQLite databases/WAL files, and large traffic logs.
- Authoritative Product Requirements Document (PRD) completed and frozen in `docs/03_PRD.md` (IDs `FR-001` through `FR-049`, `NFR-001` through `NFR-012`).
- Authoritative Technical Requirements Document (TRD) completed and frozen in `docs/04_TRD.md` (IDs `TR-001` through `TR-016`, pipeline architectures, hardware budget, and scenario criteria).
- Authoritative Workflow & Data Flow Specification completed and frozen in `docs/05_WORKFLOW_AND_DATA_FLOW.md` (Workflows `WF-INC-001` through `WF-SSE-001`, sequence diagrams, state matrices, and hero flow traces).
- Authoritative UI/UX Specification completed and frozen in `docs/06_UI_UX_SPECIFICATION.md` (Minimalist Monochrome design system, controlled rounded-corner scale, zero drop shadows, typography triad, wireframes for 7 core surfaces, and live demo interaction flows).
- Authoritative Data, Database & API Design Specification completed and frozen in `docs/07_DATA_DATABASE_API_DESIGN.md` (Dual-database boundary: SQLite `runsafe.db` for control plane with 15 tables and SHA-256 payload integrity hashing vs PostgreSQL `checkout_db` on 5432 for demo workload; complete `/api/v1` REST matrix and `/api/v1/incidents/:id/stream` SSE channel).
- Authoritative System & Infrastructure Architecture Specification completed and frozen in `docs/architecture/09_SYSTEM_INFRASTRUCTURE_ARCHITECTURE.md` (C4 context & container architecture, physical deployment, network & trust boundaries, dual execution pipeline, Primary OpenAI Model integration via TrueForge + local Qwen3 4B fallback, AWS EC2 via SSM primary target + local Docker fallback, progressive canary rollback, and independent objective verifier).
- Authoritative Agent, TrueForge & Safety Architecture Specification completed and frozen in `docs/architecture/10_AGENT_TRUEFORGE_SAFETY_ARCHITECTURE.md` (Saved agent definition in TrueForge on localhost:8790, programmatic Next.js/Fastify integration, typed MCP tool layer, TrueForge isolated Python sandbox, deterministic Safety Kernel outside LLM, immutable Proof-Carrying Actions with SHA-256 fingerprinting, human approval gating, and independent objective verifier).
- Authoritative Incident Recovery & Reliability Architecture Specification completed and frozen in `docs/architecture/11_INCIDENT_RECOVERY_RELIABILITY_ARCHITECTURE.md` (Formal 12-state Incident and 15-state Action lifecycles, transactional Recovery Steps, evidence sufficiency gating, progressive single-replica canary remediation, multi-metric and synthetic checkout verification, confidence-based abstention, Runbook CI rehearsal isolation, and runbook drift proposals).
- Verified `@truefoundry/trueforge` CLI (v0.2.1) operational on default port `8790` (standalone SQLite mode, local network policy configured for localhost MCP/model bridging).
- TypeScript monorepo initialized with npm workspaces: `packages/shared`, `packages/mcp-server`, `packages/trueforge-client`, `packages/infrastructure-adapter`, `packages/runbooks`, `packages/evidence`, `apps/control-plane`, `apps/demo-workload/checkout-api`.
- Shared operational contracts created (`packages/shared/src/operational`): `target-environment`, `errors`, `sanitizer`, `resource-registry`, `tool-registry`, `envelope`, `schemas`.
- Resource Registry implemented: 5 registered resources (`checkout-service`, `checkout-api-1`, `checkout-api-2`, `postgres`, `nginx`); unknown targets fail closed immediately.
- Tool Registry implemented: 15 typed tools (8 observation, 3 mutation, 4 rehearsal) with risk metadata, reversibility, timeout, and capability mode filtering.
- Rehearsal isolation enforced: `RECOVERY` mode strictly blocks rehearsal-only tools with `REHEARSAL_ONLY_OPERATION`; `REHEARSAL` mode enables faults and reset.
- Provider-neutral Infrastructure Adapter implemented (`packages/infrastructure-adapter`):
  - `LocalDockerAdapter`: Real execution against Stage 2 Docker Compose (process health, bounded sanitized logs, PostgreSQL SELECT 1 query, deployment state across replicas, in-memory metrics, synthetic checkout via Nginx, technical restart, canary rollback, full rollback).
  - `AwsInfrastructureAdapter`: Clean `ADAPTER_NOT_CONFIGURED` fail-closed semantics awaiting organizer AWS account credentials.
  - Strict target separation: AWS does not silently fall back to LOCAL.
- Upgraded RunSafe MCP server (`packages/mcp-server/src/server.ts` on `http://127.0.0.1:4001/sse`):
  - Exposes all typed observation, mutation, and rehearsal tools wrapped in standardized, sanitized `ToolEnvelope`.
  - Mutation tools enforce server-side authorization context / development test guard.
  - Backward compatibility maintained for Stage 1 `get_runtime_status` and `stage1_guarded_noop`.
- TrueForge integration verified:
  - Agent `runsafe-agent` updated with approval policy requiring human checkpoint approval on destructive tools: `restart_service`, `rollback_canary`, `rollback_full`, `reset_environment`, `stage1_guarded_noop`.
  - TrueForge Read E2E: Agent queried `get_service_health` and `get_deployment_state` over MCP and synthesized grounded operational report.
  - TrueForge Mutation E2E: Agent called `restart_service` on crashed replica, TrueForge paused for human approval checkpoint, operator submitted approval, container was restored and verified healthy on Docker!
- Automated Stage 1, Stage 2, and Stage 3 Verifiers passing (`npm run stage1:verify`, `npm run stage2:verify`, `npm run stage3:verify`).
- Stage 4 Delivered (`packages/runbooks` and `packages/evidence`):
  - Canonical human-authored recovery runbook created (`runbooks/checkout_recovery_runbook.md`) and version 2 created (`runbooks/checkout_recovery_runbook_v2.md`).
  - SQLite database persistence initialized with WAL mode and `PRAGMA busy_timeout = 5000;` (`data/runsafe.db`) across 5 Stage 4 tables (`runbooks`, `runbook_versions`, `recovery_contracts`, `evidence`, `hypotheses`).
  - RecoveryContract schema & deterministic validators:
    - Tool reference validator (fails closed on unregistered tools).
    - Resource reference validator (fails closed on unregistered resources).
    - Risk downgrade prevention (AI models cannot lower risk tier below registry level).
    - Rehearsal tool isolation (fault injection tools prohibited in recovery contracts).
    - Branch graph integrity (validates entryStepId, edge targets, reachability, cycle safety).
    - Contract activation guards (only `STRUCTURALLY_VALID` contracts can be activated; enforces single active contract invariant).
  - Evidence Engine:
    - Normalizers convert Stage 3 observation outputs into typed `EvidenceRecord`s.
    - Credential and secret sanitization on all observed values.
    - Freshness evaluation (`FRESH` vs `STALE`).
    - Sufficiency evaluation (`SATISFIED` vs `MISSING` vs `CONFLICTING`).
    - Telemetry conflict detector (catches shallow health probe fallacy: HTTP 200 health probe vs failed synthetic transaction).
    - Isolated Python diagnostic script execution (`analyze_logs.py`) in isolated subprocess/container with SIGKILL timeout, producing schema-enforced derived evidence linked to source raw evidence IDs.
    - Hypothesis generation citing validated Evidence IDs; rejects hallucinated or unverified IDs.
  - Fastify Control Plane upgraded with REST APIs:
    - `/api/v1/runbooks`, `/api/v1/runbooks/compile`, `/api/v1/runbooks/contracts/:id/activate`, `/api/v1/runbooks/active/:service`.
    - `/api/v1/evidence`, `/api/v1/evidence/collect`, `/api/v1/evidence/sandbox/analyze`, `/api/v1/evidence/hypotheses`, `/api/v1/evidence/sufficiency`.
  - 57 Vitest unit tests passing 100% across 7 test suites (`npm test`).
  - Automated Stage 4 Verifier script (`scripts/stage4_verify.ts` via `npm run stage4:verify`) passing 100% across all 22 criteria.
- Stage 5 Delivered (`packages/actions` and `packages/safety-kernel`):
  - `@runsafe/actions` package created:
    - Domain schemas: `ProofCarryingAction`, `ActionProposalInput`, `ActionStatus`, `BlastRadius`.
    - Cryptographic SHA-256 deterministic fingerprinting (`computeActionFingerprint`, `verifyActionFingerprint`). Key order canonicalization guarantees tamper resistance.
    - Authoritative risk enrichment: Tool risk tier and reversibility are locked to `TOOL_REGISTRY` (cannot be downgraded by LLMs).
    - SQLite repository (`ActionRepository`) with atomic status transitions (`updateActionStatus`) preventing invalid states and concurrent race conditions.
  - `@runsafe/safety-kernel` package created:
    - Pure deterministic policy pipeline (zero LLM reliance):
      - Tool Risk Policy: Tool must be registered in authoritative registry; capability mode isolation strictly enforced (`REHEARSAL_TOOL_IN_RECOVERY` fail-closed).
      - Contract Authority Policy: Action must bind to an active `RecoveryContract` and step; step tool and resource must match.
      - Evidence Freshness & Coverage Policy: Supporting evidence must exist, have age <= 120s (`STALE_EVIDENCE` fail-closed), and cover all mandatory contract evidence requirements.
      - Precondition Policy: Deterministic evaluation of contract step assertions (`STATUS_DEGRADED`, `PROCESS_CRASHED`, `ERROR_RATE_GT_5`, `DB_HEALTHY`, `SCHEMA_LOCK_DETECTED`) against observed evidence.
      - Blast Radius Policy: Restricts blast radius according to environment boundaries.
    - Decision mapping:
      - Read-only tools -> `AUTO_ALLOW` (`READ_ONLY_OBSERVATION_ALLOWED`).
      - Low-risk reversible tools matching contract preconditions -> `AUTO_ALLOW` (`AUTONOMOUS_LOW_RISK_APPROVED`).
      - High-risk / destructive tools or steps with `requiresApproval: true` -> `APPROVAL_REQUIRED` (`HUMAN_APPROVAL_MANDATORY_HIGH_RISK`).
    - Approval Service (`ApprovalService`):
      - Creates `approval_requests` records in SQLite bound to exact `payload_hash`.
      - Enforces exact cryptographic SHA-256 fingerprint verification on operator approval (tampered arguments/targets fail with `FINGERPRINT_MISMATCH`).
    - Execution Authorizer (`ExecutionAuthorizer`):
      - Single-use cryptographically random execution token (`token_...`).
      - Atomic execution claim guard: transitions status to `EXECUTING` only if in valid runnable state; subsequent concurrent claim attempts fail immediately with `DUPLICATE_EXECUTION_BLOCKED`.
      - Non-declaration invariant: technical success (`exitCode === 0`) records tool execution output without declaring business recovery (Stage 6 independent verifier owns truth).
  - SQLite persistence extended to 9 tables: added `proof_carrying_actions`, `safety_policy_decisions`, `approval_requests`, `tool_executions`.
  - Fastify Control Plane endpoints added in `apps/control-plane/src/routes/actions.ts`:
    - `POST /api/v1/actions/propose`: builds and saves validated PCA.
    - `POST /api/v1/actions/:id/evaluate`: runs Safety Kernel policies, creates approval request if needed.
    - `GET /api/v1/actions/:id`: retrieves PCA, safety decision, approval request, and tool execution logs.
    - `POST /api/v1/actions/:id/approval`: approves or rejects action with cryptographic fingerprint verification.
    - `POST /api/v1/actions/:id/execute`: atomically claims execution and dispatches tool via `InfrastructureAdapter`.
  - MCP Server mutation guard upgraded: validates single-use execution tokens against `tool_executions` table in SQLite.
  - 78 Vitest unit tests passing 100% across 10 test suites (`tests/unit/pca.test.ts`, `tests/unit/safety-kernel.test.ts`, `tests/unit/action-routes.test.ts`, etc.).
  - Automated Stage 5 Verifier (`scripts/stage5_verify.ts` via `npm run stage5:verify`) passing 100% across all 12 validation criteria.
- Stage 6 Delivered (`packages/verifier` and `packages/recovery-engine`):
  - `@runsafe/verifier` package created:
    - Domain schemas: `VerificationStatus` (`PASS`, `FAIL`, `UNKNOWN`), `ProbeEvaluation`, `VerificationRun`, `VerificationResult`.
    - Pure, deterministic Verifier Engine enforcing negative evidence recording and all-must-pass invariant.
    - Multi-sample live probes: `SYNTHETIC_ORDER` (probes multi-replica round-robin up to 3 times to guarantee catching any failing replica), `ERROR_RATE_DELTA`, `INGRESS_HEALTH`, `DB_LATENCY`, `REPLICA_HEALTH`.
    - SQLite persistence in `verification_runs` table with probe payload JSON and structured evaluation logs.
  - `@runsafe/recovery-engine` package created:
    - Incident state machine: `DETECTED` -> `INVESTIGATING` -> `REMEDIATING` -> `VERIFYING` -> `VERIFIED_RECOVERY` / `ESCALATED` / `ABSTAINED`.
    - Incident Repository with full lifecycle CRUD, atomic state transitions, and chronological event ledger in `incident_events` table.
    - Recovery Orchestrator (`RecoveryOrchestrator`):
      - Proposes Proof-Carrying Actions based on active contract step.
      - Dispatches to Safety Kernel for invariant evaluation.
      - Automatically executes `AUTO_ALLOW` low-risk reversible steps.
      - Pauses execution and creates approval requests for `APPROVAL_REQUIRED` high-risk steps (`rollback_canary`, `rollback_full`).
      - Single-use execution token issuance and atomic execution claiming.
      - Post-action verification via Independent Verifier:
        - Non-declaration invariant: technical success (`exitCode === 0`) does NOT declare recovery.
        - Verifier failure causes branch progression to `onFailure` step, recording negative evidence.
        - Verifier pass causes branch progression to `onSuccess` step or `VERIFIED_RECOVERY` resolution.
      - Baseline evidence gathering for steps lacking prior telemetry.
  - SQLite persistence expanded to 12 tables: added `incidents`, `verification_runs`, and `incident_events`.
  - Fastify Control Plane upgraded with incident REST routes in `apps/control-plane/src/routes/incidents.ts`:
    - `POST /api/v1/incidents`: detects/opens incident.
    - `GET /api/v1/incidents`: lists incidents with optional status and service filters.
    - `GET /api/v1/incidents/:id`: retrieves incident record.
    - `GET /api/v1/incidents/:id/events`: retrieves chronological event audit trail.
  - Automated Stage 6 Verifier (`scripts/stage6_verify.ts` via `npm run stage6:verify`) passing 100% across all 10 validation criteria.
- Stage 7 Delivered (Bad Deployment Autonomous Recovery Hero):
  - Hero Scenario 2 fully automated and validated end-to-end against live controlled infrastructure:
    - Fault Injection: Upgrades `checkout-api-2` to faulty `v2.0.0` (deceptive failure: shallow `/health` returns HTTP 200 OK, but business `/orders` transactions fail with HTTP 500 schema lock constraint).
    - Step 1: Ingress Observation confirms fleet degradation.
    - Step 2: Log Extraction captures schema lock exception excerpts.
    - Step 3: Database Health Check verifies PostgreSQL is healthy and responsive (< 50ms).
    - Step 4: Autonomous Reversible Step: Safety Kernel auto-approves `restart_service(checkout-api-2)` as `LOW_RISK_REVERSIBLE`. Action executes with technical exit code 0.
    - Invariant Proven: Independent Verifier runs synthetic transaction probe, detects HTTP 500 failure, marks verification `FAIL`, and records negative evidence. Incident remains OPEN.
    - Step 5: High-Risk Step: Agent proposes `rollback_canary(checkout-api-2, v1.0.0)`. Safety Kernel strictly pauses for human operator approval (`APPROVAL_REQUIRED`).
    - Operator Approval: Cryptographically verified digital token authorizes canary rollback.
    - Verification: Replica 2 rolled back to `v1.0.0`, error rate drops to 0%.
    - Step 6: Full Fleet Rollback: Agent proposes `rollback_full` to ensure fleet-wide consistency.
    - Step 7: Final Synthetic Verification: Independent Verifier executes end-to-end synthetic ACID orders through Nginx ingress. All probes PASS.
    - Resolution: Incident transitions to `VERIFIED_RECOVERY` with complete 54-event chronological audit trail.
  - Stage 7 Verification script (`scripts/stage7_verify.ts` via `npm run stage7:verify`) executed across 3 consecutive cycles: 39/39 checks passed 100%.
  - Stage 8 Delivered (Runbook CI, Crash Recovery, and Confidence Abstention):
    - Target isolation strictly enforced on LOCAL environment.
    - Scenario 1 (Process Crash): Autonomous low-risk recovery verified (PASS).
    - Scenario 2 (Bad Deployment Hero): Staging rehearsal with approval checkpoints and canary rollback verified (PASS).
    - Scenario 3 (Ambiguous Telemetry): Diagnostic confidence score (0.41) below 0.70 safety threshold triggers explicit epistemic halt (ABSTAINED) with ZERO mutations dispatched (PASS).
    - SQLite tables: rehearsal_scenarios and rehearsal_runs.
    - Fastify routes: /api/v1/rehearsals/* and /api/v1/events/* with SSE streaming.
    - Automated Stage 8 Verifier (`scripts/stage8_verify.ts` via `npm run stage8:verify`) passing 10/10 checks.
  - Stage 9 Delivered (RunSafe Product Frontend UI):
    - Minimalist Monochrome UI built in `apps/web` with Next.js 15 App Router, React 19, and Tailwind CSS following `docs/06_UI_UX_SPECIFICATION.md`:
      - Command Center (/): Real system readiness, active incident banner, and service status.
      - Incident Room (/incidents/[id]): 65% chronological timeline, 35% evidence vault, SSE real-time stream.
      - Approval Center (/approvals): High-stakes inverted Operational Decision Card with SHA-256 fingerprint, Approve/Reject controls.
      - Runbook CI (/rehearsals): Staging runner, coverage gauge (100%), and run history ledger.
    - Next.js production build (`npm run web:build`) compiled 100% cleanly.
    - Automated Stage 9 Verifier (`scripts/stage9_verify.ts` via `npm run stage9:verify`) passing 7/7 checks.
  - Complete monorepo unit & integration test suite passing: 93/93 tests across 15 test suites (`npm test`).
  - Zero TypeScript compiler errors (`npx tsc --noEmit` clean).

## Blocked on Organizer Provisioning
- Organizer OpenAI Model Provider: Local Qwen3 4B via Ollama actively verified as working fallback.
- Daytona Sandbox Provider: Local isolated Python subprocess verified as working fallback.
- Organizer AWS Account Credentials: Local multi-container Docker environment (Nginx, 2x replicas, Postgres) verified 100%.

## Pending
- Stage 10: Live Demo Recording, Presentation Script & Final Hackathon Submission Package.


## Current Architecture Reality
- Repository initialized on Windows 11 host (HP Victus: AMD Ryzen 5000 series, 24 GB RAM, NVIDIA RTX 3050 Laptop GPU, 4GB VRAM).
- Toolchain Verified:
  - Node.js: v24.11.0
  - npm: 11.12.1
  - Docker: 29.7.2
  - Docker Compose: v5.5.0
  - Ollama: 0.34.3 (Model `qwen3:4b-instruct-2507-q4_K_M` verified installed and ready, `gemma3:4b` available)
  - Python: 3.10.11
- Directory structure: `/docs` created with canonical documents.

## Services / Ports
- *To be assigned during Stage 1 & 2 implementation:*
  - Control Plane API (Fastify): Port 4000 (planned)
  - Control Plane Frontend (Next.js): Port 3000 (planned)
  - Demo Nginx Ingress: Port 8080 (planned)
  - Checkout API Replica 1: Port 8081 (internal / target)
  - Checkout API Replica 2: Port 8082 (internal / target)
  - Demo PostgreSQL: Port 5432 (demo workload)
  - Ollama API: Port 11434 (local AI)

## TrueForge Configuration
- CLI & Runtime: `@truefoundry/trueforge` v0.2.1 and `@truefoundry/trueforge-core` v0.2.1.
- Runtime Port: Default port `8790` (standalone mode, SQLite backed).
- Integration Scope: Agent runtime harness, session management, typed MCP client integration, sandboxed generated Python code execution, human approval checkpoints.

## Models
- Local Primary: `qwen3:4b-instruct-2507-q4_K_M` (via Ollama on port 11434) verified present. Used for runbook extraction, triage, schema conversion, log summarization.
- Hosted: OpenAI / AWS Bedrock (conditional upon hackathon credit provisioning) for complex multi-step reasoning and root-cause hypothesis.
- Verification: Deterministic machine verifiers (NO LLM for "did it work?").

## MCP Tools
- Planned Typed Tools:
  - `get_service_health(service_id)`
  - `get_service_metrics(service_id, window)`
  - `get_recent_logs(service_id, lines)`
  - `get_database_health()`
  - `get_current_deployment(service_id)`
  - `get_previous_deployment(service_id)`
  - `get_dependencies(service_id)`
  - `restart_service(service_id, replica_id)`
  - `rollback_canary(service_id, target_version)`
  - `rollback_full(service_id, target_version)`
  - `modify_safe_config(service_id, key, value)`
  - `delete_resource(resource_id)` [Destructive / requires hard approval]

## Recovery Contracts
- Schemas to be authored with Zod defining:
  - `step_id`, `description`, `intent`, `required_evidence`, `preconditions`, `action`, `action_parameters`, `risk_classification`, `reversibility`, `blast_radius`, `approval_policy`, `timeout`, `success_criteria`, `postconditions`, `compensation`, `rollback_fallback`, `next_step_on_success`, `next_step_on_failure`, `escalation_condition`.

## Safety Policies
- Action Classes:
  - `READ_ONLY` -> Automatic
  - `LOW_RISK_REVERSIBLE` -> Automatic if contract allows
  - `STATE_CHANGING` -> Policy dependent
  - `HIGH_RISK` -> Human approval mandatory
  - `DESTRUCTIVE` -> Hard human approval mandatory
  - `UNKNOWN` -> Deny / Escalate (Fail Closed)

## Demo Infrastructure
- Local-first Docker Compose setup:
  - Nginx (canary routing)
  - 2x Checkout API replicas (Node/TypeScript)
  - PostgreSQL demo database
  - Fault injector & synthetic traffic runner

## Demo Scenarios
1. Process/Service Crash: Autonomous low-risk recovery via restart + independent verification.
2. Bad Deployment (Hero Demo): Error spike -> log diagnosis via sandboxed code -> failed restart -> Proof-Carrying Action -> Canary Rollback proposal with blast radius -> Human Approval -> 1-replica rollback -> traffic comparison -> full rollback -> verification -> runbook drift suggestion.
3. Unknown / Ambiguous Failure: Ambiguous evidence -> confidence < threshold -> abstention and engineer escalation.

## Known Bugs
- None (pre-code phase).

## Known Limitations
- Hardware: 4 GB VRAM limit -> strictly avoid running multiple local LLMs concurrently. Keep local model quantized (Qwen 4B).

## Decisions Made
- Frozen canonical context locked in `docs/RUNSAFE_PROJECT_CONTEXT.md`.
- Architecture strictly adheres to TypeScript end-to-end (Fastify + Next.js + Zod + SQLite for control plane).
- Avoid unnecessary bloat (no LangChain/LangGraph, no Kubernetes, no Kafka/Redis/vector DBs).

## Decisions Awaiting User Approval
- Confirm package manager preference (`pnpm` vs `npm`).
- Details on TrueForge SDK / package specifics provided by TrueFoundry hackathon organizers (exact package name / repo / docs).

## Next Exact Steps
1. Review output of toolchain checks (Node, Docker, Ollama).
2. Clarify TrueForge SDK details (npm package name, CLI, or repository URL provided by organizers).
3. Proceed with Stage 1 scaffolding (monorepo / packages / Fastify + Next.js + Zod core).

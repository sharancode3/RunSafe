# RunSafe Project Memory

## Current Stage
Stage 2: Real Controlled Infrastructure (Completed & Verified locally; AWS deployment artifacts prepared, awaiting organizer AWS account credentials).

## Completed
- Canonical Master Project Context initialized and locked in `docs/RUNSAFE_PROJECT_CONTEXT.md` (Read-Only source of truth).
- Living implementation memory established in `docs/RUNSAFE_PROJECT_MEMORY.md`.
- Git repository initialized on `main` branch with remote: `https://github.com/sharancode3/RunSafe.git`.
- Strict `.gitignore` created to prevent leaking secrets, node_modules, environment files, and large traffic logs.
- Authoritative Product Requirements Document (PRD) completed and frozen in `docs/03_PRD.md` (IDs `FR-001` through `FR-049`, `NFR-001` through `NFR-012`).
- Authoritative Technical Requirements Document (TRD) completed and frozen in `docs/04_TRD.md` (IDs `TR-001` through `TR-016`, pipeline architectures, hardware budget, and scenario criteria).
- Authoritative Workflow & Data Flow Specification completed and frozen in `docs/05_WORKFLOW_AND_DATA_FLOW.md` (Workflows `WF-INC-001` through `WF-SSE-001`, sequence diagrams, state matrices, and hero flow traces).
- Authoritative UI/UX Specification completed and frozen in `docs/06_UI_UX_SPECIFICATION.md` (Minimalist Monochrome design system, controlled rounded-corner scale, zero drop shadows, typography triad, wireframes for 7 core surfaces, and live demo interaction flows).
- Authoritative Data, Database & API Design Specification completed and frozen in `docs/07_DATA_DATABASE_API_DESIGN.md` (Dual-database boundary: SQLite `runsafe.db` for control plane with 15 tables and SHA-256 payload integrity hashing vs PostgreSQL `checkout_db` on 5432 for demo workload; complete `/api/v1` REST matrix and `/api/v1/incidents/:id/stream` SSE channel).
- Authoritative System & Infrastructure Architecture Specification completed and frozen in `docs/architecture/09_SYSTEM_INFRASTRUCTURE_ARCHITECTURE.md` (C4 context & container architecture, physical deployment, network & trust boundaries, dual execution pipeline, Primary OpenAI Model integration via TrueForge + local Qwen3 4B fallback, AWS EC2 via SSM primary target + local Docker fallback, progressive canary rollback, and independent objective verifier).
- Authoritative Agent, TrueForge & Safety Architecture Specification completed and frozen in `docs/architecture/10_AGENT_TRUEFORGE_SAFETY_ARCHITECTURE.md` (Saved agent definition in TrueForge on localhost:8790, programmatic Next.js/Fastify integration, typed MCP tool layer, TrueForge isolated Python sandbox, deterministic Safety Kernel outside LLM, immutable Proof-Carrying Actions with SHA-256 fingerprinting, human approval gating, and independent objective verifier).
- Authoritative Incident Recovery & Reliability Architecture Specification completed and frozen in `docs/architecture/11_INCIDENT_RECOVERY_RELIABILITY_ARCHITECTURE.md` (Formal 12-state Incident and 15-state Action lifecycles, transactional Recovery Steps, evidence sufficiency gating, progressive single-replica canary remediation, multi-metric and synthetic checkout verification, confidence-based abstention, Runbook CI rehearsal isolation, and runbook drift proposals).
- Verified `@truefoundry/trueforge` CLI (v0.2.1) operational on default port `8790` (standalone SQLite mode, local network policy configured for localhost MCP/model bridging).
- TypeScript monorepo initialized with npm workspaces: `packages/shared`, `packages/mcp-server`, `packages/trueforge-client`, `apps/control-plane`, `apps/demo-workload/checkout-api`.
- Shared runtime schemas and Zod contracts created: `RuntimeStatusSchema`, `GuardedNoopInputSchema`, `GuardedNoopOutputSchema`, `ReadinessReportSchema`, `RunSafeEventEnvelopeSchema`, `CheckoutRequestSchema`, `CheckoutResponseSchema`, `WorkloadHealthSchema`, `WorkloadVersionSchema`, `WorkloadMetricsSchema`, `TrafficRecordSchema`.
- RunSafe MCP server implemented (`@runsafe/mcp-server` on `http://127.0.0.1:4001/sse`) exposing `get_runtime_status` and `stage1_guarded_noop`.
- Saved agent `runsafe-agent` registered in TrueForge with attached `runsafe-mcp` server, `preload: true`, and checkpoint approval required on `stage1_guarded_noop`.
- Fastify control plane implemented (`@runsafe/control-plane` on `http://127.0.0.1:4000`) with `/health`, `/api/system/readiness`, `/api/dev/trueforge/smoke-run`, and `/api/dev/trueforge/approval-run`.
- Real Controlled Infrastructure implemented (`apps/demo-workload/checkout-api`):
  - Fastify microservice with transactional PostgreSQL orders/products inventory flow.
  - Multi-replica deployment (`checkout-api-1` and `checkout-api-2`) behind Nginx reverse proxy at `:8080`.
  - PostgreSQL container `runsafe-postgres` with deterministic seed data (`prod-001`, `prod-002`, `prod-003`, `prod-fail`).
  - Real in-memory metrics (`requestsTotal`, `checkoutTotal`, `errorRate`, `avgLatencyMs`).
  - Structured JSON logging (`timestamp`, `service`, `version`, `replica`, `route`, `status`, `durationMs`, `errorCategory`, `error`).
- Real Synthetic Traffic Generator (`infrastructure/scripts/traffic_generator.ts`):
  - Emits real HTTP checkout requests across products.
  - Captures version and replica tracking headers (`x-runsafe-version`, `x-runsafe-replica`).
  - Records observations to rolling JSONL file `artifacts/traffic_log.jsonl`.
- Three Deterministic Controlled Fault Scenarios implemented & verified:
  1. Process Crash (`infrastructure/scripts/fault_crash.ts`): stops target container, observable outage, recoverable by restart.
  2. Bad Deployment - Hero Demo (`infrastructure/scripts/fault_bad_deployment.ts`): deploys `v2.0.0` on replica 2. Process `/health` stays 200, PostgreSQL stays connected, but business `/checkout` fails with HTTP 500 schema regression error. Nginx traffic exhibits 50% error rate correlated 100% with `v2.0.0` on `checkout-api-2`. Proves restart is ineffective and rollback is required.
  3. Ambiguous Failure (`infrastructure/scripts/fault_ambiguous.ts`): injects intermittent 503 downstream timeouts spread across replicas without version correlation.
- Deterministic Environment Reset (`infrastructure/scripts/reset_env.ts`):
  - Idempotently restores both API replicas to `v1.0.0`.
  - Reseeds products and truncates order tables in PostgreSQL.
  - Truncates traffic log.
  - Polls all endpoints until 100% healthy.
- Baseline Verification Script (`infrastructure/scripts/baseline_verify.ts`):
  - Validates Docker Compose containers, Nginx ingress, PostgreSQL seed data, API replica health/version, synthetic checkout persistence, and in-memory metrics.
- Repeatability verified: 2 consecutive cycles of fault -> reset -> verify passed without manual intervention.
- AWS Deployment Artifacts created (`infrastructure/aws/`):
  - `docker-compose.yml`: EC2 deployment with strictly private PostgreSQL network isolation (port 5432 unmapped to host).
  - `setup_ec2.sh`: Host provisioning with Docker, UFW firewall allowing HTTP/SSH and blocking 5432.
  - `README.md`: AWS runbook for deployment and remote fault testing.
- Automated Stage 2 Verifier (`scripts/stage2_verify.ts`):
  - End-to-end execution of Stage 1 regression, Compose build, baseline reset/verify, traffic generator, all 3 fault scenarios, repeatability cycles, and AWS status check.
- 25 Vitest unit tests passing across all packages (`tests/unit/`).
- TypeScript typecheck passing cleanly across entire repository.

## Blocked on Organizer Provisioning
- Organizer OpenAI Model Provider: Awaiting `OPENAI_API_KEY`. (Local Qwen3 4B via Ollama on port 11434 actively verified as functional working fallback).
- Daytona Sandbox Provider: Awaiting `DAYTONA_API_KEY`. (TrueForge on Windows 11 host requires Daytona SDK for sandbox execution; `LocalSandboxProvider` supports macOS and Linux only).
- Organizer AWS Account Credentials: Awaiting AWS account credentials / EC2 host to deploy live remote target. (Local controlled infrastructure is 100% verified; AWS docker-compose, setup script, and runbook are complete in `infrastructure/aws/`).

## Pending
- Stage 3: TrueForge Agent Core & Model Routing.

- Stage 3: TrueForge Agent Core & Model Routing.
- Stage 4: Typed MCP Tool Layer.
- Stage 5: Runbook Compiler & Recovery Contracts.
- Stage 6: Deterministic Safety Kernel.
- Stage 7: Incident & Evidence Engine.
- Stage 8: TrueForge Sandbox Execution.
- Stage 9: Proof-Carrying Autonomous Recovery Orchestrator.
- Stage 10: Progressive / Canary Recovery & Rollback.
- Stage 11: Independent Verification & Confidence Abstention.
- Stage 12: Runbook CI / Continuous Recovery Rehearsal.
- Stage 13: Learning, Drift & Audit Intelligence.
- Stage 14: Product UI / Command Center (Next.js, React Flow, Recharts, live SSE/WebSocket).
- Stage 15: End-to-End Validation & Demo Hardening (Scenarios 1, 2, 3).

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

# RUNSAFE — Technical Requirements Document (TRD)

**Document Version:** 1.0.0  
**Status:** Approved / Read-Only Source of Truth Reference  
**Product Name:** RunSafe  
**Architectural Scope:** Control Plane, Agent Runtime, Tool Layer, Infrastructure Adapters, Real Demo Environment

---

## 1. Technical Goals & Non-Functional Requirements

### 1.1 Non-Functional Requirements
- **Local-First & Offline Resilience:** Core demo and execution must run entirely on a local machine (Windows 11 with Docker and Ollama) without requiring paid external cloud or active internet.
- **Strict Safety Boundaries:** Fail-closed security architecture. Zero unauthenticated or unvalidated shell execution.
- **Deterministic Latency & Responsiveness:** Control plane API latency < 50ms for telemetry ingestion; real-time event streaming to UI via Server-Sent Events (SSE) or WebSocket.
- **Resource Constraints:** Designed to run comfortably within 24 GB RAM and 4 GB VRAM (RTX 3050). No simultaneous loading of multiple 4B+ models.
- **Full Auditability:** Every tool invocation, evidence observation, LLM thought, and human approval decision recorded in persistent append-only storage.

---

## 2. System Architecture & Component Breakdown

```
+---------------------------------------------------------------------------------+
|                               RUNSAFE CONTROL PLANE                             |
|                                                                                 |
|  +--------------------+        +--------------------+        +---------------+  |
|  | Next.js Frontend   | <----> | Fastify API Server | <----> | SQLite Engine |  |
|  | (React, Flow, Recharts)     | (TypeScript, Zod)  |        | (Audit & State)  |
|  +--------------------+        +---------+----------+        +---------------+  |
|                                          |                                      |
|                 +------------------------+-----------------------+              |
|                 |                                                |              |
|                 v                                                v              |
|     +-----------------------+                        +-----------------------+  |
|     |  Deterministic        |                        |  TrueForge Harness    |  |
|     |  Safety Kernel        |                        |  Agent Core           |  |
|     |  - Action Policy      |                        |  - Ollama Qwen3 4B    |  |
|     |  - Proof Verifier     |                        |  - MCP Client         |  |
|     |  - Approval Gate      |                        |  - Code Sandbox       |  |
|     +-----------+-----------+                        +-----------+-----------+  |
|                 |                                                |              |
+-----------------|------------------------------------------------|--------------+
                  |                                                |
                  v                                                v
      +-----------------------+                        +-----------------------+
      | Typed MCP Server      |                        | TrueForge Sandbox     |
      | - Health & Logs       |                        | - Python Runtime      |
      | - Docker API Ops      |                        | - Diagnostic Scripts  |
      | - Metric Collectors   |                        | - Isolated Execution  |
      +-----------+-----------+                        +-----------------------+
                  |
                  v
+---------------------------------------------------------------------------------+
|                       REAL CONTROLLED DEMO INFRASTRUCTURE                       |
|                                                                                 |
|  +-------------------+       +-----------------------+-----------------------+  |
|  | Nginx Canary      | ----> | checkout-api-1 (vA/B) | checkout-api-2 (vA/B) |  |
|  | Reverse Proxy     |       +-----------------------+-----------------------+  |
|  +-------------------+                               |                          |
|                                                      v                          |
|                                              +---------------+                  |
|                                              | PostgreSQL DB |                  |
|                                              +---------------+                  |
+---------------------------------------------------------------------------------+
```

---

## 3. Technology Stack & Justification

| Layer | Chosen Technology | Justification |
|---|---|---|
| **Control Plane Server** | Fastify + TypeScript | High throughput, low overhead, first-class TypeScript integration, native JSON schema support. |
| **Control Plane Database** | SQLite (`better-sqlite3`) | Zero-configuration, zero network overhead, file-based portability, ACID compliant. |
| **Data Validation** | Zod (v3.x / 4.x compatible) | Shared TypeScript types between frontend, backend, MCP schemas, and Recovery Contracts. |
| **Agent Runtime** | `@truefoundry/trueforge-core` | Mandatory hackathon harness, native MCP client, sandbox execution management. |
| **Model Infrastructure** | Ollama (`qwen3:4b-instruct-2507-q4_K_M`) | Local, fast, low VRAM footprint, zero cost, completely offline. Optional hosted fallback for OpenAI/AWS Bedrock. |
| **Frontend Framework** | Next.js (App Router) + React + Tailwind | Responsive, industry-grade SRE console with dark mode and component-level rendering. |
| **Graph Visualization** | React Flow | Dependency topologies and blast-radius visualization. |
| **Telemetry Charts** | Recharts | Live error rate, latency, and throughput comparison graphs. |
| **Demo Infrastructure** | Docker Compose + Nginx + Node.js APIs + Postgres | Real processes, real HTTP endpoints, real TCP connections, real restart and rollback mechanics. |

---

## 4. Subsystem Specifications

### 4.1 Subsystem 1: Deterministic Safety Kernel
- **Class Definitions:**
  - `READ_ONLY`: Pure queries (`get_service_health`, `get_recent_logs`, `get_dependencies`).
  - `LOW_RISK_REVERSIBLE`: Single container restart, cache flush.
  - `STATE_CHANGING`: Traffic weight adjustments, configuration changes.
  - `HIGH_RISK`: Canary rollback, traffic drain.
  - `DESTRUCTIVE`: Full rollback, dropping resources, terminating persistent storage.
  - `UNKNOWN`: Unrecognized tool or malformed payload.
- **Enforcement Rules:**
  1. `READ_ONLY` actions auto-execute.
  2. `LOW_RISK_REVERSIBLE` actions execute automatically ONLY if an active Recovery Contract allows autonomous remediation for the current step.
  3. `HIGH_RISK` and `DESTRUCTIVE` actions throw a `HumanApprovalRequiredError` and insert an approval ticket into the SQLite state store.
  4. `UNKNOWN` actions fail closed with an immediate security audit log.

### 4.2 Subsystem 2: Typed MCP Server (`runsafe-mcp-server`)
- Exposes typed tools over stdio/HTTP:
  - `get_service_health(serviceId: string): ServiceHealthResult`
  - `get_service_metrics(serviceId: string, timeWindowSec: number): MetricSummary`
  - `get_recent_logs(serviceId: string, maxLines: number): LogEntry[]`
  - `get_database_health(): DbHealthResult`
  - `restart_service(serviceId: string, replicaId?: string): RestartResult`
  - `rollback_canary(serviceId: string, targetVersion: string): CanaryRollbackResult`
  - `rollback_full(serviceId: string, targetVersion: string): RollbackResult`
  - `set_traffic_weight(serviceId: string, weights: Record<string, number>): TrafficResult`
- All schemas defined via Zod with strict typing and input validation.

### 4.3 Subsystem 3: Sandboxed Diagnostic Engine
- Used when log volume exceeds raw LLM token context or requires statistical grouping.
- TrueForge spawns an isolated Python container/sandbox.
- Script reads JSON/text log streams, computes anomaly frequency, correlates version tags with error timestamps, and outputs:
  ```json
  {
    "total_lines_analyzed": 5420,
    "error_rate_by_version": {
      "v1": 0.002,
      "v2": 0.185
    },
    "top_exceptions": [
      { "type": "ConnectionTimeoutError", "count": 894, "percentage": 94.2 }
    ],
    "first_occurrence_timestamp": "2026-09-26T10:14:22Z"
  }
  ```
- Output ingested directly into the Evidence Engine.

### 4.4 Subsystem 4: Independent Outcome Verifier
- Executes outside the LLM reasoning loop.
- Performs objective deterministic assertions:
  1. `HTTP GET /health` on ingress returns 200 OK within 500ms.
  2. Synthetic order placement `POST /checkout` returns HTTP 201 with valid transaction ID.
  3. Error rate over a 30-second rolling window is strictly < 1.0%.
  4. PostgreSQL connection pool has > 20% available slots.
- Only when all assertions pass does the Verifier mark the incident as `RESOLVED`.

---

## 5. Security & Threat Modeling

1. **Prompt Injection Defense:** The LLM cannot emit raw shell commands. All actions map to pre-compiled TypeScript functions in the MCP server with strict Zod argument checks.
2. **Replay Prevention:** Every Proof-Carrying Action contains a unique cryptographic `action_id` and timestamp nonce. The Safety Kernel prevents double-execution.
3. **Fail-Closed Default:** In the event of network disruption, database timeout, or unhandled exception, the Safety Kernel locks all mutations and alerts the human operator.
4. **Credential Isolation:** No cloud credentials or database passwords enter LLM prompts or sandbox execution contexts. Infrastructure operations use local Docker socket bindings with minimal privileges.

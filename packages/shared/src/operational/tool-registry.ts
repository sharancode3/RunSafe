import { z } from "zod";
import { CapabilityMode } from "./target-environment.js";

export const ToolCategorySchema = z.enum(["OBSERVATION", "MUTATION", "REHEARSAL"]);
export type ToolCategory = z.infer<typeof ToolCategorySchema>;

export const ToolRiskSchema = z.enum([
  "READ_ONLY",
  "LOW_RISK_REVERSIBLE",
  "STATE_CHANGING",
  "HIGH_RISK",
  "DESTRUCTIVE",
]);
export type ToolRisk = z.infer<typeof ToolRiskSchema>;

export interface ToolRecord {
  toolId: string;
  category: ToolCategory;
  description: string;
  readOnly: boolean;
  mutation: boolean;
  rehearsalOnly: boolean;
  risk: ToolRisk;
  reversible: boolean;
  verificationRequired: boolean;
  timeoutMs: number;
  idempotent: boolean;
  enabled: boolean;
}

export const TOOL_REGISTRY: Record<string, ToolRecord> = {
  get_service_health: {
    toolId: "get_service_health",
    category: "OBSERVATION",
    description:
      "Read the current runtime/process health of a known RunSafe-managed service or replica. Read-only. This does not prove complete business recovery.",
    readOnly: true,
    mutation: false,
    rehearsalOnly: false,
    risk: "READ_ONLY",
    reversible: true,
    verificationRequired: false,
    timeoutMs: 5000,
    idempotent: true,
    enabled: true,
  },
  get_recent_logs: {
    toolId: "get_recent_logs",
    category: "OBSERVATION",
    description:
      "Retrieve bounded, sanitized operational log records for a known service or replica. Maximum 100 lines. Sensitive credentials are redacted.",
    readOnly: true,
    mutation: false,
    rehearsalOnly: false,
    risk: "READ_ONLY",
    reversible: true,
    verificationRequired: false,
    timeoutMs: 8000,
    idempotent: true,
    enabled: true,
  },
  get_metrics: {
    toolId: "get_metrics",
    category: "OBSERVATION",
    description:
      "Return real in-memory operational metrics (requests_total, checkout_total, error_rate, avg_latency_ms) for a known service/replica.",
    readOnly: true,
    mutation: false,
    rehearsalOnly: false,
    risk: "READ_ONLY",
    reversible: true,
    verificationRequired: false,
    timeoutMs: 5000,
    idempotent: true,
    enabled: true,
  },
  get_database_health: {
    toolId: "get_database_health",
    category: "OBSERVATION",
    description:
      "Perform a harmless real query (SELECT 1 and table verification) against the workload PostgreSQL database. Read-only.",
    readOnly: true,
    mutation: false,
    rehearsalOnly: false,
    risk: "READ_ONLY",
    reversible: true,
    verificationRequired: false,
    timeoutMs: 5000,
    idempotent: true,
    enabled: true,
  },
  get_deployment_state: {
    toolId: "get_deployment_state",
    category: "OBSERVATION",
    description:
      "Return the current real deployment version and replica mapping for a known managed service across all replicas.",
    readOnly: true,
    mutation: false,
    rehearsalOnly: false,
    risk: "READ_ONLY",
    reversible: true,
    verificationRequired: false,
    timeoutMs: 5000,
    idempotent: true,
    enabled: true,
  },
  get_replica_state: {
    toolId: "get_replica_state",
    category: "OBSERVATION",
    description:
      "Inspect the live operational state, running container status, and version tag of a specific replica.",
    readOnly: true,
    mutation: false,
    rehearsalOnly: false,
    risk: "READ_ONLY",
    reversible: true,
    verificationRequired: false,
    timeoutMs: 5000,
    idempotent: true,
    enabled: true,
  },
  get_dependencies: {
    toolId: "get_dependencies",
    category: "OBSERVATION",
    description:
      "Return only known deterministic dependencies and downstream connections from the trusted resource registry.",
    readOnly: true,
    mutation: false,
    rehearsalOnly: false,
    risk: "READ_ONLY",
    reversible: true,
    verificationRequired: false,
    timeoutMs: 3000,
    idempotent: true,
    enabled: true,
  },
  run_synthetic_checkout: {
    toolId: "run_synthetic_checkout",
    category: "OBSERVATION",
    description:
      "Execute a real ACID SQL synthetic checkout against the controlled RunSafe demo workload via Nginx and return the business result.",
    readOnly: true,
    mutation: false,
    rehearsalOnly: false,
    risk: "READ_ONLY",
    reversible: true,
    verificationRequired: false,
    timeoutMs: 10000,
    idempotent: false,
    enabled: true,
  },
  restart_service: {
    toolId: "restart_service",
    category: "MUTATION",
    description:
      "Restart one known managed service or replica container. State-changing and reversible. Technical execution success does not prove business recovery.",
    readOnly: false,
    mutation: true,
    rehearsalOnly: false,
    risk: "LOW_RISK_REVERSIBLE",
    reversible: true,
    verificationRequired: true,
    timeoutMs: 25000,
    idempotent: false,
    enabled: true,
  },
  rollback_canary: {
    toolId: "rollback_canary",
    category: "MUTATION",
    description:
      "Roll back exactly one known replica to a specified known-good version for limited-scope canary remediation.",
    readOnly: false,
    mutation: true,
    rehearsalOnly: false,
    risk: "HIGH_RISK",
    reversible: true,
    verificationRequired: true,
    timeoutMs: 35000,
    idempotent: true,
    enabled: true,
  },
  rollback_full: {
    toolId: "rollback_full",
    category: "MUTATION",
    description:
      "Roll back all replicas belonging to a target service to a specified known-good version.",
    readOnly: false,
    mutation: true,
    rehearsalOnly: false,
    risk: "HIGH_RISK",
    reversible: true,
    verificationRequired: true,
    timeoutMs: 45000,
    idempotent: true,
    enabled: true,
  },
  inject_process_crash: {
    toolId: "inject_process_crash",
    category: "REHEARSAL",
    description:
      "[REHEARSAL ONLY] Injects a crash fault into target replica container for demo or rehearsal verification.",
    readOnly: false,
    mutation: false,
    rehearsalOnly: true,
    risk: "DESTRUCTIVE",
    reversible: true,
    verificationRequired: false,
    timeoutMs: 15000,
    idempotent: true,
    enabled: true,
  },
  inject_bad_deployment: {
    toolId: "inject_bad_deployment",
    category: "REHEARSAL",
    description:
      "[REHEARSAL ONLY] Upgrades replica 2 to v2.0.0 with schema lock defect, creating the hero incident.",
    readOnly: false,
    mutation: false,
    rehearsalOnly: true,
    risk: "DESTRUCTIVE",
    reversible: true,
    verificationRequired: false,
    timeoutMs: 30000,
    idempotent: true,
    enabled: true,
  },
  inject_ambiguous_failure: {
    toolId: "inject_ambiguous_failure",
    category: "REHEARSAL",
    description:
      "[REHEARSAL ONLY] Injects intermittent downstream 503 timeouts across replicas to test agent abstention.",
    readOnly: false,
    mutation: false,
    rehearsalOnly: true,
    risk: "DESTRUCTIVE",
    reversible: true,
    verificationRequired: false,
    timeoutMs: 15000,
    idempotent: true,
    enabled: true,
  },
  reset_environment: {
    toolId: "reset_environment",
    category: "REHEARSAL",
    description:
      "[REHEARSAL ONLY] Idempotently restores the environment to baseline v1.0.0 and reseeds database.",
    readOnly: false,
    mutation: false,
    rehearsalOnly: true,
    risk: "HIGH_RISK",
    reversible: true,
    verificationRequired: true,
    timeoutMs: 40000,
    idempotent: true,
    enabled: true,
  },
};

export function getToolRecord(toolId: string): ToolRecord {
  const tool = TOOL_REGISTRY[toolId];
  if (!tool) {
    throw new Error(`Tool '${toolId}' is not registered in TOOL_REGISTRY.`);
  }
  return tool;
}

export function filterToolsByMode(mode: CapabilityMode): ToolRecord[] {
  return Object.values(TOOL_REGISTRY).filter((tool) => {
    if (!tool.enabled) return false;
    if (mode === "RECOVERY") {
      return !tool.rehearsalOnly;
    }
    if (mode === "REHEARSAL") {
      return tool.readOnly || tool.rehearsalOnly;
    }
    return true; // "TEST" mode enables all
  });
}

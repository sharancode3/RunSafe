import { sanitizeOutput, type TargetEnvironment } from "@runsafe/shared";
import type { EvidenceRecord, EvidenceType } from "../schemas.js";

export interface NormalizerOptions {
  environment: TargetEnvironment;
  targetResource: string;
  incidentId?: string | null;
  sourceExecutionId?: string | null;
  observedAt?: string;
}

const TOOL_TO_EVIDENCE_TYPE: Record<string, EvidenceType> = {
  get_service_health: "SERVICE_HEALTH",
  get_recent_logs: "RECENT_LOGS",
  get_metrics: "METRICS",
  get_database_health: "DATABASE_HEALTH",
  get_deployment_state: "DEPLOYMENT_STATE",
  get_replica_state: "REPLICA_STATE",
  get_dependencies: "DEPENDENCY_STATE",
  run_synthetic_checkout: "SYNTHETIC_CHECKOUT",
};

export function normalizeToolOutputToEvidence(
  toolId: string,
  rawOutput: unknown,
  options: NormalizerOptions
): EvidenceRecord {
  const evidenceType = TOOL_TO_EVIDENCE_TYPE[toolId] || "SERVICE_HEALTH";
  const now = new Date().toISOString();
  const observedAt = options.observedAt || now;

  // 1. Scrub credentials and sensitive data
  const scrubbed = (sanitizeOutput(rawOutput) || {}) as Record<string, unknown>;

  // 2. Synthesize clear operational summary
  let summary = `Observed ${evidenceType} on resource '${options.targetResource}' via tool '${toolId}'.`;
  if (toolId === "get_service_health") {
    const status = (scrubbed as any)?.status || (scrubbed as any)?.overallStatus || "unknown";
    const httpCode = (scrubbed as any)?.httpStatus || 200;
    summary = `Service health probe on '${options.targetResource}': HTTP ${httpCode} (${status}).`;
  } else if (toolId === "get_recent_logs") {
    const lines = (scrubbed as any)?.lines || (scrubbed as any)?.logLines || [];
    const count = Array.isArray(lines) ? lines.length : 0;
    summary = `Extracted ${count} bounded operational log records for '${options.targetResource}'.`;
  } else if (toolId === "get_metrics") {
    const reqs = (scrubbed as any)?.requestsTotal ?? 0;
    const errRate = (scrubbed as any)?.errorRate ?? 0;
    summary = `Telemetry metrics for '${options.targetResource}': requests=${reqs}, errorRate=${errRate}%.`;
  } else if (toolId === "get_database_health") {
    const connected = (scrubbed as any)?.connected ?? true;
    const latency = (scrubbed as any)?.latencyMs ?? 0;
    summary = `PostgreSQL persistence probe: connected=${connected}, latency=${latency}ms.`;
  } else if (toolId === "get_deployment_state") {
    const replicas = (scrubbed as any)?.replicas || [];
    summary = `Deployment state for '${options.targetResource}': ${replicas.length} active replicas inspected.`;
  } else if (toolId === "get_replica_state") {
    const ver = (scrubbed as any)?.version || "unknown";
    const running = (scrubbed as any)?.running ?? true;
    summary = `Replica '${options.targetResource}' state: running=${running}, activeVersion=${ver}.`;
  } else if (toolId === "get_dependencies") {
    const deps = (scrubbed as any)?.dependencies || [];
    summary = `Dependencies for '${options.targetResource}': [${deps.join(", ")}].`;
  } else if (toolId === "run_synthetic_checkout") {
    const success = (scrubbed as any)?.success ?? false;
    const code = (scrubbed as any)?.httpStatus || (success ? 200 : 500);
    summary = `Synthetic checkout transaction against '${options.targetResource}': HTTP ${code} (success=${success}).`;
  }

  // 3. Raw excerpt bounded to max 4096 bytes
  const rawString = JSON.stringify(scrubbed);
  const boundedRawExcerpt =
    rawString.length > 4000
      ? rawString.substring(0, 4000) + "... [truncated to 4KB]"
      : rawString;

  const id = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  return {
    id,
    incidentId: options.incidentId || null,
    environment: options.environment,
    targetResource: options.targetResource,
    evidenceType,
    sourceType: "OBSERVATION_TOOL",
    sourceTool: toolId,
    sourceExecutionId: options.sourceExecutionId || null,
    observedAt,
    collectedAt: now,
    summary,
    structuredValue: scrubbed,
    boundedRawExcerpt,
    freshnessStatus: "FRESH",
    derived: false,
    sourceEvidenceIds: [],
    sandboxExecutionId: null,
    createdAt: now,
  };
}

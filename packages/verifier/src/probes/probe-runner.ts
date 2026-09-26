import { randomUUID } from "node:crypto";
import type { InfrastructureAdapter } from "@runsafe/infrastructure-adapter";
import type { SuccessCriterion } from "@runsafe/runbooks";
import type { EvidenceRecord } from "@runsafe/evidence";
import type { ProbeEvaluation } from "../schemas.js";

export interface ProbeExecutionResult {
  evaluation: ProbeEvaluation;
  evidenceRecord: EvidenceRecord;
}

export async function runProbe(
  criterion: SuccessCriterion,
  adapter: InfrastructureAdapter,
  incidentId: string
): Promise<ProbeExecutionResult> {
  const startTime = Date.now();
  const now = new Date().toISOString();
  const probeId = `probe_${randomUUID()}`;
  const evId = `ev_${randomUUID()}`;

  switch (criterion.probeType) {
    case "INGRESS_HEALTH": {
      const res = await adapter.getServiceHealth(criterion.targetResource);
      const durationMs = Date.now() - startTime;
      const expectedStatus = Number(criterion.expected) || 200;
      const actualStatus = Number(res.httpStatus || 0);

      const passed = res.reachable === true && actualStatus === expectedStatus;
      const isUnknown = res.reachable === false && (res.error as string)?.includes("Timeout");

      const status = passed ? "PASS" : isUnknown ? "UNKNOWN" : "FAIL";
      const message = passed
        ? `Ingress probe to '${criterion.targetResource}' passed with HTTP ${actualStatus} in ${durationMs}ms`
        : `Ingress probe failed: expected HTTP ${expectedStatus}, received HTTP ${actualStatus}. ${res.error || ""}`.trim();

      const evaluation: ProbeEvaluation = {
        probeType: "INGRESS_HEALTH",
        targetResource: criterion.targetResource,
        expected: criterion.expected,
        actual: actualStatus,
        status,
        latencyMs: durationMs,
        message,
      };

      const evidenceRecord: EvidenceRecord = {
        id: evId,
        incidentId,
        environment: adapter.environment,
        targetResource: criterion.targetResource,
        evidenceType: "SERVICE_HEALTH",
        sourceType: "VERIFICATION_PROBE",
        sourceTool: "get_service_health",
        sourceExecutionId: probeId,
        observedAt: now,
        collectedAt: now,
        summary: message,
        structuredValue: res,
        boundedRawExcerpt: JSON.stringify(res).slice(0, 500),
        freshnessStatus: "FRESH",
        derived: false,
        sourceEvidenceIds: [],
        createdAt: now,
      };

      return { evaluation, evidenceRecord };
    }

    case "REPLICA_HEALTH": {
      const res = await adapter.getServiceHealth(criterion.targetResource);
      const durationMs = Date.now() - startTime;
      const expectedStatus = Number(criterion.expected) || 200;
      const actualStatus = Number(res.httpStatus || 0);

      const passed = res.reachable === true && actualStatus === expectedStatus;
      const isUnknown = res.reachable === false && (res.error as string)?.includes("Timeout");

      const status = passed ? "PASS" : isUnknown ? "UNKNOWN" : "FAIL";
      const message = passed
        ? `Replica probe to '${criterion.targetResource}' passed with HTTP ${actualStatus} in ${durationMs}ms`
        : `Replica probe failed on '${criterion.targetResource}': expected HTTP ${expectedStatus}, received HTTP ${actualStatus}. ${res.error || ""}`.trim();

      const evaluation: ProbeEvaluation = {
        probeType: "REPLICA_HEALTH",
        targetResource: criterion.targetResource,
        expected: criterion.expected,
        actual: actualStatus,
        status,
        latencyMs: durationMs,
        message,
      };

      const evidenceRecord: EvidenceRecord = {
        id: evId,
        incidentId,
        environment: adapter.environment,
        targetResource: criterion.targetResource,
        evidenceType: "SERVICE_HEALTH",
        sourceType: "VERIFICATION_PROBE",
        sourceTool: "get_service_health",
        sourceExecutionId: probeId,
        observedAt: now,
        collectedAt: now,
        summary: message,
        structuredValue: res,
        boundedRawExcerpt: JSON.stringify(res).slice(0, 500),
        freshnessStatus: "FRESH",
        derived: false,
        sourceEvidenceIds: [],
        createdAt: now,
      };

      return { evaluation, evidenceRecord };
    }

    case "DB_LATENCY": {
      const res = await adapter.getDatabaseHealth(criterion.targetResource);
      const durationMs = Date.now() - startTime;
      const latency = Number(res.latencyMs || durationMs);
      const maxAllowed = typeof criterion.expected === "number" ? criterion.expected : 100;

      const passed = res.reachable === true && res.querySucceeded === true && latency <= maxAllowed;
      const isUnknown = res.reachable === false && (res.error as string)?.includes("Timeout");

      const status = passed ? "PASS" : isUnknown ? "UNKNOWN" : "FAIL";
      const message = passed
        ? `PostgreSQL latency probe passed: ${latency}ms (threshold <= ${maxAllowed}ms)`
        : `PostgreSQL probe failed: querySucceeded=${res.querySucceeded}, latency=${latency}ms. ${res.error || ""}`.trim();

      const evaluation: ProbeEvaluation = {
        probeType: "DB_LATENCY",
        targetResource: criterion.targetResource,
        expected: `< ${maxAllowed}ms`,
        actual: `${latency}ms`,
        status,
        latencyMs: latency,
        message,
      };

      const evidenceRecord: EvidenceRecord = {
        id: evId,
        incidentId,
        environment: adapter.environment,
        targetResource: criterion.targetResource,
        evidenceType: "DATABASE_HEALTH",
        sourceType: "VERIFICATION_PROBE",
        sourceTool: "get_database_health",
        sourceExecutionId: probeId,
        observedAt: now,
        collectedAt: now,
        summary: message,
        structuredValue: res,
        boundedRawExcerpt: JSON.stringify(res).slice(0, 500),
        freshnessStatus: "FRESH",
        derived: false,
        sourceEvidenceIds: [],
        createdAt: now,
      };

      return { evaluation, evidenceRecord };
    }

    case "SYNTHETIC_ORDER": {
      // In a multi-replica round-robin cluster, probe up to 3 times to ensure all active upstreams are exercised
      let res: any = null;
      for (let i = 0; i < 3; i++) {
        res = await adapter.runSyntheticCheckout("prod-001", 1);
        if (!res.success || res.httpStatus !== (Number(criterion.expected) || 200)) {
          break;
        }
      }
      const durationMs = Date.now() - startTime;
      const expectedStatus = Number(criterion.expected) || 200;
      const actualStatus = Number(res?.httpStatus || 0);

      const passed = res?.success === true && actualStatus === expectedStatus && Boolean(res?.orderId);
      const isUnknown = actualStatus === 0 || (res?.error as string)?.includes("Timeout");

      const status = passed ? "PASS" : isUnknown ? "UNKNOWN" : "FAIL";
      const message = passed
        ? `Synthetic order verification probe PASSED: order ${res.orderId} committed to database in ${durationMs}ms`
        : `Synthetic order verification probe FAILED: HTTP ${actualStatus}, error: ${res?.error || "order not committed"}`;

      const evaluation: ProbeEvaluation = {
        probeType: "SYNTHETIC_ORDER",
        targetResource: criterion.targetResource,
        expected: `HTTP ${expectedStatus} with committed order`,
        actual: `HTTP ${actualStatus} (success: ${res.success})`,
        status,
        latencyMs: durationMs,
        message,
      };

      const evidenceRecord: EvidenceRecord = {
        id: evId,
        incidentId,
        environment: adapter.environment,
        targetResource: criterion.targetResource,
        evidenceType: "SYNTHETIC_CHECKOUT",
        sourceType: "VERIFICATION_PROBE",
        sourceTool: "run_synthetic_checkout",
        sourceExecutionId: probeId,
        observedAt: now,
        collectedAt: now,
        summary: message,
        structuredValue: res,
        boundedRawExcerpt: JSON.stringify(res).slice(0, 500),
        freshnessStatus: "FRESH",
        derived: false,
        sourceEvidenceIds: [],
        createdAt: now,
      };

      return { evaluation, evidenceRecord };
    }

    case "ERROR_RATE_DELTA": {
      // Check metrics or replica health for canary verification
      let res: Record<string, unknown>;
      try {
        res = await adapter.getMetrics(criterion.targetResource);
      } catch {
        res = await adapter.getServiceHealth(criterion.targetResource);
      }

      const durationMs = Date.now() - startTime;
      const errorRate = typeof res.errorRate === "number" ? res.errorRate : 0;
      const expectedRate = Number(criterion.expected) || 0;

      // Also check replica state if replicaId
      let replicaHealthy = true;
      if (criterion.targetResource.includes("checkout-api")) {
        const repState = await adapter.getReplicaState(criterion.targetResource);
        replicaHealthy = repState.running === true && repState.faultProfile === "none";
      }

      const passed = errorRate <= expectedRate && replicaHealthy;
      const status = passed ? "PASS" : "FAIL";
      const message = passed
        ? `Error rate delta probe passed: error rate ${errorRate}% <= ${expectedRate}% (healthy=${replicaHealthy})`
        : `Error rate delta probe failed: error rate ${errorRate}% (healthy=${replicaHealthy})`;

      const evaluation: ProbeEvaluation = {
        probeType: "ERROR_RATE_DELTA",
        targetResource: criterion.targetResource,
        expected: `<= ${expectedRate}%`,
        actual: `${errorRate}%`,
        status,
        latencyMs: durationMs,
        message,
      };

      const evidenceRecord: EvidenceRecord = {
        id: evId,
        incidentId,
        environment: adapter.environment,
        targetResource: criterion.targetResource,
        evidenceType: "METRICS",
        sourceType: "VERIFICATION_PROBE",
        sourceTool: "get_metrics",
        sourceExecutionId: probeId,
        observedAt: now,
        collectedAt: now,
        summary: message,
        structuredValue: res,
        boundedRawExcerpt: JSON.stringify(res).slice(0, 500),
        freshnessStatus: "FRESH",
        derived: false,
        sourceEvidenceIds: [],
        createdAt: now,
      };

      return { evaluation, evidenceRecord };
    }

    default: {
      const evaluation: ProbeEvaluation = {
        probeType: criterion.probeType,
        targetResource: criterion.targetResource,
        expected: criterion.expected,
        actual: "UNKNOWN_PROBE_TYPE",
        status: "UNKNOWN",
        latencyMs: 0,
        message: `Unknown probe type: ${criterion.probeType}`,
      };

      const evidenceRecord: EvidenceRecord = {
        id: evId,
        incidentId,
        environment: adapter.environment,
        targetResource: criterion.targetResource,
        evidenceType: "SERVICE_HEALTH",
        sourceType: "VERIFICATION_PROBE",
        sourceTool: "unknown",
        sourceExecutionId: probeId,
        observedAt: now,
        collectedAt: now,
        summary: `Unknown probe type: ${criterion.probeType}`,
        structuredValue: { probeType: criterion.probeType },
        freshnessStatus: "FRESH",
        derived: false,
        sourceEvidenceIds: [],
        createdAt: now,
      };

      return { evaluation, evidenceRecord };
    }
  }
}

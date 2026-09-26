import type { EvidenceRecord } from "../schemas.js";

export interface ConflictReport {
  hasConflict: boolean;
  conflicts: string[];
}

export function detectEvidenceConflicts(evidenceList: EvidenceRecord[]): ConflictReport {
  const conflicts: string[] = [];

  // Group evidence by targetResource or overall service
  const healthRecords = evidenceList.filter((e) => e.evidenceType === "SERVICE_HEALTH");
  const syntheticRecords = evidenceList.filter((e) => e.evidenceType === "SYNTHETIC_CHECKOUT");
  const metricRecords = evidenceList.filter((e) => e.evidenceType === "METRICS");
  const dbRecords = evidenceList.filter((e) => e.evidenceType === "DATABASE_HEALTH");
  const logRecords = evidenceList.filter((e) => e.evidenceType === "RECENT_LOGS");

  // 1. Process Health (200 OK) vs Synthetic Business Failure (500 Error)
  const healthyProbe = healthRecords.some((h) => {
    const val = h.structuredValue as any;
    return val?.status === "healthy" || val?.httpStatus === 200;
  });

  const failedSynthetic = syntheticRecords.find((s) => {
    const val = s.structuredValue as any;
    return val?.success === false || (val?.httpStatus && val.httpStatus >= 500);
  });

  if (healthyProbe && failedSynthetic) {
    conflicts.push(
      `Shallow health probe fallacy detected: Service reports HTTP 200 process health, but synthetic checkout transaction failed (${failedSynthetic.summary}). Process is alive but business transactions are broken.`
    );
  }

  // 2. Database Health Probe (healthy) vs Log Exceptions (DB failure)
  const dbHealthy = dbRecords.some((d) => (d.structuredValue as any)?.connected === true);
  const logMentionsDbCrash = logRecords.some((l) => {
    const excerpt = (l.boundedRawExcerpt || "").toLowerCase();
    return excerpt.includes("connection refused") || excerpt.includes("database dead");
  });

  if (dbHealthy && logMentionsDbCrash) {
    conflicts.push(
      `Database telemetry contradiction: Direct PostgreSQL probe is healthy, but application logs report database connection errors.`
    );
  }

  // 3. Low Error Rate in Metrics vs High Failure in Logs
  for (const m of metricRecords) {
    const errorRate = (m.structuredValue as any)?.errorRate ?? 0;
    if (errorRate === 0 && failedSynthetic) {
      conflicts.push(
        `Metric divergence: In-memory metrics indicate 0% error rate on '${m.targetResource}', yet synthetic checkout transactions are failing.`
      );
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

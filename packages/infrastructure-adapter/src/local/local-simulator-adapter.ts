import { randomUUID } from "node:crypto";
import { TargetEnvironment, validateResource } from "@runsafe/shared";
import type { InfrastructureAdapter } from "../core/infrastructure-adapter.js";

interface SimulatedReplica {
  id: string;
  serviceId: string;
  version: string;
  status: "healthy" | "crashed" | "degraded" | "error";
  httpStatus: number;
  uptimeSeconds: number;
  errorRate: number;
}

interface SimulatedDatabase {
  id: string;
  status: "healthy" | "unreachable" | "degraded";
  latencyMs: number;
  connections: number;
}

/**
 * LocalSimulatorAdapter provides a deterministic, in-memory simulated infrastructure
 * for RunSafe local demonstrations.
 *
 * Guarantees:
 * - Zero Docker, cloud, AWS, or Daytona dependencies.
 * - Resettable per test run with clean v1.0.0 baseline.
 * - Deterministic fault injection (process crash, bad deployment, ambiguous metrics).
 * - Multi-replica topology (checkout-api-1, checkout-api-2, ingress, postgres).
 * - Explicitly labeled as simulated/local on all outputs.
 */
export class LocalSimulatorAdapter implements InfrastructureAdapter {
  public readonly provider = "LOCAL_SIMULATOR";
  public readonly environment: TargetEnvironment = "LOCAL";

  private replicas: Map<string, SimulatedReplica> = new Map();
  private databases: Map<string, SimulatedDatabase> = new Map();
  private ambiguousActive = false;

  constructor() {
    this.resetToBaseline();
  }

  /**
   * Resets simulator to deterministic v1.0.0 healthy baseline.
   */
  public resetToBaseline(): void {
    this.ambiguousActive = false;
    this.replicas.clear();
    this.databases.clear();
    this.ambiguousActive = false;

    this.replicas.set("checkout-api-1", {
      id: "checkout-api-1",
      serviceId: "checkout-service",
      version: "v1.0.0",
      status: "healthy",
      httpStatus: 200,
      uptimeSeconds: 3600,
      errorRate: 0.0,
    });

    this.replicas.set("checkout-api-2", {
      id: "checkout-api-2",
      serviceId: "checkout-service",
      version: "v1.0.0",
      status: "healthy",
      httpStatus: 200,
      uptimeSeconds: 3600,
      errorRate: 0.0,
    });

    this.databases.set("postgres", {
      id: "postgres",
      status: "healthy",
      latencyMs: 12,
      connections: 8,
    });
  }

  // 1. Service Health (Ingress routing over replicas)
  public async getServiceHealth(serviceId: string): Promise<Record<string, unknown>> {
    validateResource(serviceId, this.environment, "get_service_health");
    const rep1 = this.replicas.get("checkout-api-1");
    const rep2 = this.replicas.get("checkout-api-2");

    const bothHealthy = rep1?.status === "healthy" && rep2?.status === "healthy";
    const oneDegraded = rep1?.status === "crashed" || rep2?.status === "error" || rep2?.version === "v2.0.0";
    const status = bothHealthy ? "healthy" : oneDegraded ? "degraded" : "unhealthy";
    const httpStatus = bothHealthy ? 200 : oneDegraded ? (rep2?.version === "v2.0.0" ? 500 : 200) : 503;

    return {
      serviceId,
      environment: this.environment,
      provider: this.provider,
      simulated: true,
      reachable: true,
      httpStatus,
      status,
      activeVersion: rep2?.version === "v2.0.0" ? "v2.0.0 (canary)" : "v1.0.0",
      fleet: {
        totalReplicas: 2,
        healthyReplicas: [rep1, rep2].filter((r) => r?.status === "healthy").length,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // 2. Recent Logs
  public async getRecentLogs(serviceId: string, limit = 50): Promise<Array<Record<string, unknown>>> {
    validateResource(serviceId, this.environment, "get_recent_logs");
    const rep1 = this.replicas.get("checkout-api-1");
    const rep2 = this.replicas.get("checkout-api-2");
    const now = new Date().toISOString();

    const logs: Array<Record<string, unknown>> = [];

    if (rep1?.status === "crashed") {
      logs.push({
        service: serviceId,
        container: "checkout-api-1",
        level: "FATAL",
        message: "SIGSEGV: Segmentation fault in checkout worker process. Exited with status 137.",
        simulated: true,
        timestamp: now,
      });
    }

    if (rep2?.version === "v2.0.0" || rep2?.status === "error") {
      logs.push({
        service: serviceId,
        container: "checkout-api-2",
        level: "ERROR",
        message: "NullPointerException: invalid checkout discount calculation in canary v2.0.0",
        simulated: true,
        timestamp: now,
      });
    }

    if (this.ambiguousActive) {
      logs.push({
        service: serviceId,
        container: "checkout-api-2",
        level: "WARN",
        message: "Network jitter detected on upstream payment gateway. Intermittent retry timeout.",
        simulated: true,
        timestamp: now,
      });
    }

    // Baseline normal logs
    logs.push(
      {
        service: serviceId,
        container: "checkout-api-1",
        level: "INFO",
        message: "GET /api/checkout/cart 200 OK duration=12ms",
        simulated: true,
        timestamp: now,
      },
      {
        service: serviceId,
        container: "checkout-api-2",
        level: "INFO",
        message: "GET /health 200 OK",
        simulated: true,
        timestamp: now,
      }
    );

    return logs.slice(0, limit);
  }

  // 3. Metrics
  public async getMetrics(serviceId: string): Promise<Record<string, unknown>> {
    validateResource(serviceId, this.environment, "get_metrics");
    const rep2 = this.replicas.get("checkout-api-2");
    const hasBadCanary = rep2?.version === "v2.0.0";

    return {
      serviceId,
      environment: this.environment,
      provider: this.provider,
      simulated: true,
      errorRate: hasBadCanary ? 0.85 : this.ambiguousActive ? 0.35 : 0.0,
      p95LatencyMs: hasBadCanary ? 450 : this.ambiguousActive ? 280 : 25,
      throughputRps: 150,
      timestamp: new Date().toISOString(),
    };
  }

  // 4. Database Health
  public async getDatabaseHealth(databaseId = "postgres"): Promise<Record<string, unknown>> {
    validateResource(databaseId, this.environment, "get_database_health");
    const db = this.databases.get(databaseId) || {
      id: databaseId,
      status: "healthy",
      latencyMs: 12,
      connections: 8,
    };
    const isHealthy = db.status === "healthy";

    return {
      databaseId,
      database: "checkout_db",
      environment: this.environment,
      provider: this.provider,
      simulated: true,
      reachable: isHealthy,
      querySucceeded: isHealthy,
      status: db.status,
      latencyMs: db.latencyMs,
      connections: db.connections,
      maxConnections: 100,
      timestamp: new Date().toISOString(),
    };
  }

  // 5. Deployment State
  public async getDeploymentState(serviceId = "checkout-service"): Promise<Record<string, unknown>> {
    validateResource(serviceId, this.environment, "get_deployment_state");
    const rep1 = this.replicas.get("checkout-api-1");
    const rep2 = this.replicas.get("checkout-api-2");

    return {
      serviceId,
      environment: this.environment,
      provider: this.provider,
      simulated: true,
      primaryVersion: rep1?.version || "v1.0.0",
      canaryVersion: rep2?.version || "v1.0.0",
      isCanaryActive: rep1?.version !== rep2?.version,
      replicas: [
        { id: "checkout-api-1", version: rep1?.version, status: rep1?.status },
        { id: "checkout-api-2", version: rep2?.version, status: rep2?.status },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  // 6. Replica State
  public async getReplicaState(replicaId: string): Promise<Record<string, unknown>> {
    validateResource(replicaId, this.environment, "get_replica_state");
    const rep = this.replicas.get(replicaId);
    if (!rep) {
      return {
        replicaId,
        environment: this.environment,
        provider: this.provider,
        simulated: true,
        reachable: false,
        running: false,
        healthy: false,
        faultProfile: "unknown",
        status: "notFound",
      };
    }

    const running = rep.status === "healthy";
    const faultProfile = rep.version === "v2.0.0" ? "schema_lock" : (rep.status === "crashed" ? "crash" : "none");

    return {
      replicaId,
      service: "checkout-service",
      environment: this.environment,
      provider: this.provider,
      simulated: true,
      status: rep.status,
      version: rep.version,
      httpStatus: rep.httpStatus,
      uptimeSeconds: rep.uptimeSeconds,
      running,
      healthy: running && faultProfile === "none",
      faultProfile,
      timestamp: new Date().toISOString(),
    };
  }

  // 7. Dependencies
  public async getDependencies(resourceId: string): Promise<Record<string, unknown>> {
    validateResource(resourceId, this.environment, "get_dependencies");
    return {
      resourceId,
      environment: this.environment,
      provider: this.provider,
      simulated: true,
      upstream: ["checkout-ingress"],
      downstream: ["postgres", "payment-gateway"],
      timestamp: new Date().toISOString(),
    };
  }

  // 8. Synthetic Checkout
  public async runSyntheticCheckout(productId = "prod-001", quantity = 1): Promise<Record<string, unknown>> {
    const rep1 = this.replicas.get("checkout-api-1");
    const rep2 = this.replicas.get("checkout-api-2");

    // If canary v2.0.0 is running or both crashed, synthetic checkout fails
    if (rep2?.version === "v2.0.0") {
      return {
        success: false,
        httpStatus: 500,
        statusCode: 500,
        provider: this.provider,
        simulated: true,
        orderId: null,
        error: "HTTP 500 Internal Server Error: checkout discount calculation failed in v2.0.0",
        durationMs: 45,
        timestamp: new Date().toISOString(),
      };
    }

    if (rep1?.status === "crashed" && rep2?.status === "crashed") {
      return {
        success: false,
        httpStatus: 503,
        statusCode: 503,
        provider: this.provider,
        simulated: true,
        orderId: null,
        error: "HTTP 503 Service Unavailable: all replicas down",
        durationMs: 10,
        timestamp: new Date().toISOString(),
      };
    }

    const orderId = `ord_sim_${randomUUID().substring(0, 8)}`;
    return {
      success: true,
      httpStatus: 200,
      statusCode: 200,
      provider: this.provider,
      simulated: true,
      orderId,
      productId,
      quantity,
      durationMs: 24,
      servedVersion: "v1.0.0",
      servedReplica: rep1?.status === "healthy" ? "checkout-api-1" : "checkout-api-2",
      timestamp: new Date().toISOString(),
    };
  }

  // 9. Restart Service (Mutation)
  public async restartService(target: string): Promise<{
    technicalStatus: string;
    beforeState?: unknown;
    afterState?: unknown;
    operationId: string;
  }> {
    const beforeState: any = {};
    if (target === "checkout-service") {
      for (const [id, rep] of this.replicas.entries()) {
        beforeState[id] = { ...rep };
        rep.status = "healthy";
        rep.httpStatus = 200;
        rep.uptimeSeconds = 0;
        rep.errorRate = 0.0;
      }
    } else {
      const rep = this.replicas.get(target);
      if (rep) {
        beforeState[target] = { ...rep };
        rep.status = "healthy";
        rep.httpStatus = 200;
        rep.uptimeSeconds = 0;
        rep.errorRate = 0.0;
      }
    }

    return {
      technicalStatus: "SUCCESS",
      beforeState,
      afterState: Object.fromEntries(this.replicas.entries()),
      operationId: `op_restart_${randomUUID().substring(0, 8)}`,
    };
  }

  // 10. Rollback Canary (Mutation)
  public async rollbackCanary(
    serviceId: string,
    replicaId: string,
    targetVersion: string
  ): Promise<{
    technicalStatus: string;
    fromVersion: string;
    toVersion: string;
    targetReplica: string;
    operationId: string;
  }> {
    const rep = this.replicas.get(replicaId);
    const fromVersion = rep?.version || "unknown";

    if (rep) {
      rep.version = targetVersion;
      rep.status = "healthy";
      rep.httpStatus = 200;
      rep.errorRate = 0.0;
    }

    return {
      technicalStatus: "SUCCESS",
      fromVersion,
      toVersion: targetVersion,
      targetReplica: replicaId,
      operationId: `op_rb_canary_${randomUUID().substring(0, 8)}`,
    };
  }

  // 11. Rollback Full (Mutation)
  public async rollbackFull(
    serviceId: string,
    targetVersion: string
  ): Promise<{
    technicalStatus: string;
    affectedReplicas: string[];
    targetVersion: string;
    operationId: string;
  }> {
    const affected: string[] = [];
    for (const [id, rep] of this.replicas) {
      rep.version = targetVersion;
      rep.status = "healthy";
      rep.httpStatus = 200;
      rep.errorRate = 0.0;
      affected.push(id);
    }

    return {
      technicalStatus: "SUCCESS",
      affectedReplicas: affected,
      targetVersion,
      operationId: `op_rb_full_${randomUUID().substring(0, 8)}`,
    };
  }

  // 12. Rehearsal: Inject Process Crash
  public async injectProcessCrash(targetReplica: string): Promise<Record<string, unknown>> {
    const rep = this.replicas.get(targetReplica);
    if (rep) {
      rep.status = "crashed";
      rep.httpStatus = 0;
      rep.uptimeSeconds = 0;
    }

    return {
      injected: true,
      faultType: "PROCESS_CRASH",
      targetReplica,
      provider: this.provider,
      simulated: true,
      timestamp: new Date().toISOString(),
    };
  }

  // 13. Rehearsal: Inject Bad Deployment
  public async injectBadDeployment(targetReplica: string, badVersion = "v2.0.0"): Promise<Record<string, unknown>> {
    const rep = this.replicas.get(targetReplica);
    if (rep) {
      rep.version = badVersion;
      rep.status = "error";
      rep.httpStatus = 500;
      rep.errorRate = 0.85;
    }

    return {
      injected: true,
      faultType: "BAD_DEPLOYMENT",
      targetReplica,
      badVersion,
      provider: this.provider,
      simulated: true,
      timestamp: new Date().toISOString(),
    };
  }

  // 14. Rehearsal: Inject Ambiguous Failure
  public async injectAmbiguousFailure(probability = 0.5): Promise<Record<string, unknown>> {
    this.ambiguousActive = true;
    return {
      injected: true,
      faultType: "AMBIGUOUS_TELEMETRY",
      probability,
      provider: this.provider,
      simulated: true,
      message: "Injected conflicting telemetry with low confidence score (0.41 < 0.70)",
      timestamp: new Date().toISOString(),
    };
  }

  // 15. Reset Environment
  public async resetEnvironment(): Promise<Record<string, unknown>> {
    this.resetToBaseline();
    return {
      reset: true,
      baselineVersion: "v1.0.0",
      provider: this.provider,
      simulated: true,
      replicasReset: ["checkout-api-1", "checkout-api-2"],
      databaseReset: ["postgres"],
      timestamp: new Date().toISOString(),
    };
  }
}

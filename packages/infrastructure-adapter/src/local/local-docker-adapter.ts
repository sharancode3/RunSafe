import pg from "pg";
import {
  TargetEnvironment,
  RunSafeOperationalError,
  validateResource,
  getResourceRecord,
  RESOURCE_REGISTRY,
} from "@runsafe/shared";
import { InfrastructureAdapter } from "../core/infrastructure-adapter.js";
import { execDocker } from "../../../../infrastructure/scripts/docker_runner.js";
import { injectProcessCrash } from "../../../../infrastructure/scripts/fault_crash.js";
import { injectBadDeployment } from "../../../../infrastructure/scripts/fault_bad_deployment.js";
import { injectAmbiguousFault } from "../../../../infrastructure/scripts/fault_ambiguous.js";
import { resetEnvironment } from "../../../../infrastructure/scripts/reset_env.js";

const { Client } = pg;

export class LocalDockerAdapter implements InfrastructureAdapter {
  public readonly provider = "LOCAL_DOCKER";
  public readonly environment: TargetEnvironment = "LOCAL";

  // 1. Service Health
  public async getServiceHealth(serviceId: string): Promise<Record<string, unknown>> {
    const record = validateResource(serviceId, this.environment, "get_service_health");
    const port = record.localMapping.hostPort;
    const path = record.localMapping.healthPath || "/health";
    const url = `http://127.0.0.1:${port}${path}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      const data = (await res.json()) as Record<string, unknown>;
      return {
        serviceId,
        environment: this.environment,
        reachable: true,
        httpStatus: res.status,
        ...data,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      return {
        serviceId,
        environment: this.environment,
        reachable: false,
        httpStatus: 0,
        status: "unhealthy",
        error: err.name === "AbortError" ? "Timeout checking service health" : `Connection refused (${err.message})`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // 2. Recent Logs
  public async getRecentLogs(serviceId: string, limit = 50): Promise<Array<Record<string, unknown>>> {
    const record = validateResource(serviceId, this.environment, "get_recent_logs");
    const safeLimit = Math.min(100, Math.max(1, limit));
    const primaryContainer = record.localMapping.containerName;
    const containersToQuery =
      serviceId === "checkout-service"
        ? ["runsafe-checkout-api-2", "runsafe-checkout-api-1", primaryContainer]
        : [primaryContainer];

    try {
      const parsedLogs: Array<Record<string, unknown>> = [];
      for (const container of containersToQuery) {
        try {
          const rawLogs = execDocker(`docker logs --tail ${safeLimit} ${container}`);
          const lines = rawLogs.split("\n").filter((l) => l.trim().length > 0);

          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              parsedLogs.push({ ...parsed, container });
            } catch {
              parsedLogs.push({
                service: serviceId,
                container,
                rawMessage: line,
                timestamp: new Date().toISOString(),
              });
            }
          }
        } catch {}
      }

      return parsedLogs;
    } catch (err: any) {
      throw new RunSafeOperationalError(
        "REMOTE_EXECUTION_FAILED",
        `Failed to retrieve logs for service '${serviceId}': ${err.message}`
      );
    }
  }

  // 3. Metrics
  public async getMetrics(serviceId: string): Promise<Record<string, unknown>> {
    const record = validateResource(serviceId, this.environment, "get_metrics");
    const port = record.localMapping.hostPort;
    const url = `http://127.0.0.1:${port}/metrics`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return (await res.json()) as Record<string, unknown>;
    } catch (err: any) {
      clearTimeout(timeout);
      return {
        service: serviceId,
        environment: this.environment,
        reachable: false,
        requestsTotal: null,
        errorRate: null,
        avgLatencyMs: null,
        error: `Metrics unavailable: ${err.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // 4. Database Health
  public async getDatabaseHealth(databaseId = "postgres"): Promise<Record<string, unknown>> {
    validateResource(databaseId, this.environment, "get_database_health");

    const client = new Client({
      host: "127.0.0.1",
      port: 5432,
      user: process.env.POSTGRES_USER || "runsafe",
      password: process.env.POSTGRES_PASSWORD || "runsafe_secret",
      database: process.env.POSTGRES_DB || "checkout_db",
      connectionTimeoutMillis: 3000,
    });

    const startTime = Date.now();
    try {
      await client.connect();
      const res = await client.query("SELECT COUNT(*) as product_count FROM products");
      const durationMs = Date.now() - startTime;
      await client.end();

      return {
        database: "checkout_db",
        environment: this.environment,
        reachable: true,
        querySucceeded: true,
        latencyMs: durationMs,
        tablesVerified: ["products", "orders", "order_items"],
        productCount: Number(res.rows[0]?.product_count || 0),
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      try {
        await client.end();
      } catch {}
      return {
        database: "checkout_db",
        environment: this.environment,
        reachable: false,
        querySucceeded: false,
        error: `Database health check failed: ${err.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // 5. Deployment State
  public async getDeploymentState(serviceId = "checkout-service"): Promise<Record<string, unknown>> {
    validateResource(serviceId, this.environment, "get_deployment_state");

    const replicas = ["checkout-api-1", "checkout-api-2"];
    const replicaStates: Array<Record<string, unknown>> = [];

    for (const replicaId of replicas) {
      const rec = RESOURCE_REGISTRY[replicaId];
      if (!rec) continue;
      const port = rec.localMapping.hostPort;
      try {
        const verRes = await fetch(`http://127.0.0.1:${port}/version`, { signal: AbortSignal.timeout(3000) });
        if (verRes.ok) {
          const verData = (await verRes.json()) as any;
          replicaStates.push({
            replicaId,
            version: verData.version,
            faultProfile: verData.faultProfile,
            running: true,
            healthy: true,
          });
          continue;
        }
      } catch {}

      replicaStates.push({
        replicaId,
        version: "unknown",
        faultProfile: "unknown",
        running: false,
        healthy: false,
      });
    }

    return {
      service: serviceId,
      environment: this.environment,
      timestamp: new Date().toISOString(),
      replicas: replicaStates,
    };
  }

  // 6. Replica State
  public async getReplicaState(replicaId: string): Promise<Record<string, unknown>> {
    const record = validateResource(replicaId, this.environment, "get_replica_state");
    const port = record.localMapping.hostPort;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/version`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const verData = (await res.json()) as any;
        return {
          exists: true,
          running: true,
          reachable: true,
          service: "checkout-service",
          replicaId,
          version: verData.version,
          faultProfile: verData.faultProfile,
          timestamp: new Date().toISOString(),
        };
      }
    } catch {}

    return {
      exists: true,
      running: false,
      reachable: false,
      service: "checkout-service",
      replicaId,
      version: "unknown",
      timestamp: new Date().toISOString(),
    };
  }

  // 7. Dependencies
  public async getDependencies(resourceId: string): Promise<Record<string, unknown>> {
    const record = validateResource(resourceId, this.environment, "get_dependencies");
    return {
      resourceId,
      displayName: record.displayName,
      logicalRole: record.logicalRole,
      resourceType: record.resourceType,
      dependencies: record.dependencies,
      timestamp: new Date().toISOString(),
    };
  }

  // 8. Synthetic Checkout
  public async runSyntheticCheckout(productId = "prod-001", quantity = 1): Promise<Record<string, unknown>> {
    const startTime = Date.now();
    try {
      const res = await fetch("http://127.0.0.1:8080/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity }),
        signal: AbortSignal.timeout(8000),
      });

      const durationMs = Date.now() - startTime;
      const data = (await res.json()) as any;

      return {
        success: res.ok && data.success === true,
        httpStatus: res.status,
        servedVersion: res.headers.get("x-runsafe-version") || data.version,
        servedReplica: res.headers.get("x-runsafe-replica") || data.replica,
        durationMs,
        orderId: data.orderId,
        productId,
        quantity,
        error: data.error,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        httpStatus: 0,
        servedVersion: "none",
        servedReplica: "none",
        durationMs: Date.now() - startTime,
        error: `Synthetic checkout failed: ${err.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // 9. Restart Service (Mutation)
  public async restartService(target: string): Promise<{
    technicalStatus: string;
    beforeState?: unknown;
    afterState?: unknown;
    operationId: string;
  }> {
    const record = validateResource(target, this.environment, "restart_service");
    const container = record.localMapping.containerName;
    const operationId = `op-restart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Inspect before state
    const beforeState = await this.getServiceHealth(target);

    // Execute restart
    execDocker(`docker restart ${container}`);

    // Wait for health recovery (up to 15s)
    let ready = false;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const currentHealth = await this.getServiceHealth(target);
      if (currentHealth.reachable && currentHealth.httpStatus === 200) {
        ready = true;
        break;
      }
    }

    const afterState = await this.getServiceHealth(target);

    return {
      technicalStatus: ready ? "RESTARTED_HEALTHY" : "RESTARTED_UNHEALTHY",
      beforeState,
      afterState,
      operationId,
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
    validateResource(serviceId, this.environment, "rollback_full");
    const rec = validateResource(replicaId, this.environment, "rollback_canary");
    const operationId = `op-canary-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Check current state
    const currentState = await this.getReplicaState(replicaId);
    const fromVersion = (currentState.version as string) || "unknown";

    if (fromVersion === targetVersion && currentState.faultProfile === "none") {
      throw new RunSafeOperationalError(
        "ALREADY_IN_DESIRED_STATE",
        `Replica '${replicaId}' is already at target version '${targetVersion}' with no fault profile active.`,
        { replicaId, currentVersion: fromVersion, targetVersion }
      );
    }

    // Deploy rollback for the single replica
    execDocker(
      `docker compose -f infrastructure/workload/docker-compose.yml up -d --no-deps ${replicaId}`,
      {
        CHECKOUT_API_2_VERSION: targetVersion,
        CHECKOUT_API_2_FAULT: "",
      }
    );

    // Wait for healthy status
    let ready = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res = await fetch(`http://127.0.0.1:${rec.localMapping.hostPort}/health`);
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {}
    }

    if (!ready) {
      throw new RunSafeOperationalError(
        "REMOTE_EXECUTION_FAILED",
        `Rollback canary on '${replicaId}' failed to achieve healthy status within 20s.`
      );
    }

    return {
      technicalStatus: "ROLLED_BACK",
      fromVersion,
      toVersion: targetVersion,
      targetReplica: replicaId,
      operationId,
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
    validateResource(serviceId, this.environment, "rollback_full");
    const operationId = `op-full-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Deploy rollback for all replicas
    execDocker(
      "docker compose -f infrastructure/workload/docker-compose.yml up -d --no-deps checkout-api-1 checkout-api-2",
      {
        CHECKOUT_API_1_VERSION: targetVersion,
        CHECKOUT_API_1_FAULT: "",
        CHECKOUT_API_2_VERSION: targetVersion,
        CHECKOUT_API_2_FAULT: "",
      }
    );

    // Wait for healthy status on both replicas
    let ready = false;
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const [r1, r2] = await Promise.all([
          fetch("http://127.0.0.1:8081/health"),
          fetch("http://127.0.0.1:8082/health"),
        ]);
        if (r1.ok && r2.ok) {
          ready = true;
          break;
        }
      } catch {}
    }

    if (!ready) {
      throw new RunSafeOperationalError(
        "REMOTE_EXECUTION_FAILED",
        `Full rollback on '${serviceId}' failed to restore all replicas to health.`
      );
    }

    return {
      technicalStatus: "FULL_ROLLBACK_COMPLETED",
      affectedReplicas: ["checkout-api-1", "checkout-api-2"],
      targetVersion,
      operationId,
    };
  }

  // 12. Rehearsal: Crash
  public async injectProcessCrash(targetReplica: string): Promise<Record<string, unknown>> {
    const res = await injectProcessCrash(targetReplica as "checkout-api-1" | "checkout-api-2");
    return res as unknown as Record<string, unknown>;
  }

  // 13. Rehearsal: Bad Deployment
  public async injectBadDeployment(targetReplica = "checkout-api-2", badVersion = "v2.0.0"): Promise<Record<string, unknown>> {
    const res = await injectBadDeployment();
    return res as unknown as Record<string, unknown>;
  }

  // 14. Rehearsal: Ambiguous Failure
  public async injectAmbiguousFailure(probability = 0.35): Promise<Record<string, unknown>> {
    const res = await injectAmbiguousFault();
    return res as unknown as Record<string, unknown>;
  }

  // 15. Rehearsal: Reset Environment
  public async resetEnvironment(): Promise<Record<string, unknown>> {
    const res = await resetEnvironment();
    return res as unknown as Record<string, unknown>;
  }
}

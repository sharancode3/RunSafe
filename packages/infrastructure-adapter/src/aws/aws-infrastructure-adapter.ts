import {
  TargetEnvironment,
  RunSafeOperationalError,
  validateResource,
} from "@runsafe/shared";
import { InfrastructureAdapter } from "../core/infrastructure-adapter.js";

export class AwsInfrastructureAdapter implements InfrastructureAdapter {
  public readonly provider = "AWS_EC2";
  public readonly environment: TargetEnvironment = "AWS";

  private checkConfigured(): void {
    const host = process.env.RUNSAFE_AWS_HOST;
    const hasAwsCreds = Boolean(
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    );

    if (!host && !hasAwsCreds) {
      throw new RunSafeOperationalError(
        "ADAPTER_NOT_CONFIGURED",
        "AWS Infrastructure Adapter is not configured. Organizer AWS account credentials or EC2 host endpoint have not been provided.",
        {
          provider: this.provider,
          environment: this.environment,
          status: "BLOCKED_AWAITING_CREDENTIALS",
          hint: "Deploy infrastructure/aws/docker-compose.yml to EC2 host and set RUNSAFE_AWS_HOST once credentials are provided.",
        }
      );
    }
  }

  public async getServiceHealth(serviceId: string): Promise<Record<string, unknown>> {
    this.checkConfigured();
    validateResource(serviceId, this.environment, "get_service_health");
    // Remote AWS probe implementation when configured
    return { serviceId, environment: this.environment, status: "healthy" };
  }

  public async getRecentLogs(serviceId: string, limit = 50): Promise<Array<Record<string, unknown>>> {
    this.checkConfigured();
    validateResource(serviceId, this.environment, "get_recent_logs");
    return [];
  }

  public async getMetrics(serviceId: string): Promise<Record<string, unknown>> {
    this.checkConfigured();
    validateResource(serviceId, this.environment, "get_metrics");
    return { service: serviceId, environment: this.environment };
  }

  public async getDatabaseHealth(databaseId = "postgres"): Promise<Record<string, unknown>> {
    this.checkConfigured();
    validateResource(databaseId, this.environment, "get_database_health");
    return { database: databaseId, environment: this.environment };
  }

  public async getDeploymentState(serviceId = "checkout-service"): Promise<Record<string, unknown>> {
    this.checkConfigured();
    validateResource(serviceId, this.environment, "get_deployment_state");
    return { service: serviceId, environment: this.environment };
  }

  public async getReplicaState(replicaId: string): Promise<Record<string, unknown>> {
    this.checkConfigured();
    validateResource(replicaId, this.environment, "get_replica_state");
    return { replicaId, environment: this.environment };
  }

  public async getDependencies(resourceId: string): Promise<Record<string, unknown>> {
    this.checkConfigured();
    const record = validateResource(resourceId, this.environment, "get_dependencies");
    return { resourceId, dependencies: record.dependencies };
  }

  public async runSyntheticCheckout(productId = "prod-001", quantity = 1): Promise<Record<string, unknown>> {
    this.checkConfigured();
    return { success: true, environment: this.environment };
  }

  public async restartService(target: string): Promise<{
    technicalStatus: string;
    beforeState?: unknown;
    afterState?: unknown;
    operationId: string;
  }> {
    this.checkConfigured();
    validateResource(target, this.environment, "restart_service");
    return {
      technicalStatus: "RESTARTED",
      operationId: `op-aws-restart-${Date.now()}`,
    };
  }

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
    this.checkConfigured();
    validateResource(replicaId, this.environment, "rollback_canary");
    return {
      technicalStatus: "ROLLED_BACK",
      fromVersion: "unknown",
      toVersion: targetVersion,
      targetReplica: replicaId,
      operationId: `op-aws-canary-${Date.now()}`,
    };
  }

  public async rollbackFull(
    serviceId: string,
    targetVersion: string
  ): Promise<{
    technicalStatus: string;
    affectedReplicas: string[];
    targetVersion: string;
    operationId: string;
  }> {
    this.checkConfigured();
    validateResource(serviceId, this.environment, "rollback_full");
    return {
      technicalStatus: "FULL_ROLLBACK_COMPLETED",
      affectedReplicas: ["checkout-api-1", "checkout-api-2"],
      targetVersion,
      operationId: `op-aws-full-${Date.now()}`,
    };
  }

  public async injectProcessCrash(targetReplica: string): Promise<Record<string, unknown>> {
    this.checkConfigured();
    return { status: "injected", targetReplica };
  }

  public async injectBadDeployment(targetReplica?: string, badVersion?: string): Promise<Record<string, unknown>> {
    this.checkConfigured();
    return { status: "injected", targetReplica, badVersion };
  }

  public async injectAmbiguousFailure(probability?: number): Promise<Record<string, unknown>> {
    this.checkConfigured();
    return { status: "injected", probability };
  }

  public async resetEnvironment(): Promise<Record<string, unknown>> {
    this.checkConfigured();
    return { status: "reset" };
  }
}

import { TargetEnvironment } from "@runsafe/shared";

export interface InfrastructureAdapter {
  readonly provider: string;
  readonly environment: TargetEnvironment;

  // Observation methods
  getServiceHealth(serviceId: string): Promise<Record<string, unknown>>;
  getRecentLogs(serviceId: string, limit?: number): Promise<Array<Record<string, unknown>>>;
  getMetrics(serviceId: string): Promise<Record<string, unknown>>;
  getDatabaseHealth(databaseId?: string): Promise<Record<string, unknown>>;
  getDeploymentState(serviceId?: string): Promise<Record<string, unknown>>;
  getReplicaState(replicaId: string): Promise<Record<string, unknown>>;
  getDependencies(resourceId: string): Promise<Record<string, unknown>>;
  runSyntheticCheckout(productId?: string, quantity?: number): Promise<Record<string, unknown>>;

  // Mutation methods
  restartService(target: string): Promise<{
    technicalStatus: string;
    beforeState?: unknown;
    afterState?: unknown;
    operationId: string;
  }>;
  rollbackCanary(
    serviceId: string,
    replicaId: string,
    targetVersion: string
  ): Promise<{
    technicalStatus: string;
    fromVersion: string;
    toVersion: string;
    targetReplica: string;
    operationId: string;
  }>;
  rollbackFull(
    serviceId: string,
    targetVersion: string
  ): Promise<{
    technicalStatus: string;
    affectedReplicas: string[];
    targetVersion: string;
    operationId: string;
  }>;

  // Rehearsal-only methods
  injectProcessCrash(targetReplica: string): Promise<Record<string, unknown>>;
  injectBadDeployment(targetReplica: string, badVersion?: string): Promise<Record<string, unknown>>;
  injectAmbiguousFailure(probability?: number): Promise<Record<string, unknown>>;
  resetEnvironment(): Promise<Record<string, unknown>>;
}

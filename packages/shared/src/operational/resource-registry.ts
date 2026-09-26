import { z } from "zod";
import { TargetEnvironment } from "./target-environment.js";
import { RunSafeOperationalError } from "./errors.js";

export const ResourceTypeSchema = z.enum([
  "SERVICE",
  "REPLICA",
  "DATABASE",
  "PROXY",
  "WORKLOAD",
]);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

export interface ResourceRecord {
  resourceId: string;
  resourceType: ResourceType;
  displayName: string;
  logicalRole: string;
  supportedEnvironments: TargetEnvironment[];
  allowedOperations: string[];
  dependencies: string[];
  localMapping: {
    containerName: string;
    hostPort: number;
    healthPath?: string;
  };
  awsMapping: {
    serviceName: string;
    targetPort: number;
    healthPath?: string;
  };
}

export const RESOURCE_REGISTRY: Record<string, ResourceRecord> = {
  "checkout-service": {
    resourceId: "checkout-service",
    resourceType: "SERVICE",
    displayName: "Checkout Service (Cluster)",
    logicalRole: "Core e-commerce checkout business service load-balanced across replicas",
    supportedEnvironments: ["LOCAL", "AWS"],
    allowedOperations: [
      "get_service_health",
      "get_recent_logs",
      "get_metrics",
      "get_deployment_state",
      "get_dependencies",
      "run_synthetic_checkout",
      "rollback_full",
    ],
    dependencies: ["postgres", "nginx"],
    localMapping: {
      containerName: "runsafe-nginx",
      hostPort: 8080,
      healthPath: "/health",
    },
    awsMapping: {
      serviceName: "checkout-service",
      targetPort: 8080,
      healthPath: "/health",
    },
  },
  "checkout-api-1": {
    resourceId: "checkout-api-1",
    resourceType: "REPLICA",
    displayName: "Checkout API Replica 1",
    logicalRole: "Primary API replica 1 running Fastify transactional checkout service",
    supportedEnvironments: ["LOCAL", "AWS"],
    allowedOperations: [
      "get_service_health",
      "get_recent_logs",
      "get_metrics",
      "get_replica_state",
      "restart_service",
    ],
    dependencies: ["postgres"],
    localMapping: {
      containerName: "runsafe-checkout-api-1",
      hostPort: 8081,
      healthPath: "/health",
    },
    awsMapping: {
      serviceName: "checkout-api-1",
      targetPort: 8081,
      healthPath: "/health",
    },
  },
  "checkout-api-2": {
    resourceId: "checkout-api-2",
    resourceType: "REPLICA",
    displayName: "Checkout API Replica 2",
    logicalRole: "Canary/Secondary API replica 2 running Fastify transactional checkout service",
    supportedEnvironments: ["LOCAL", "AWS"],
    allowedOperations: [
      "get_service_health",
      "get_recent_logs",
      "get_metrics",
      "get_replica_state",
      "restart_service",
      "rollback_canary",
    ],
    dependencies: ["postgres"],
    localMapping: {
      containerName: "runsafe-checkout-api-2",
      hostPort: 8082,
      healthPath: "/health",
    },
    awsMapping: {
      serviceName: "checkout-api-2",
      targetPort: 8082,
      healthPath: "/health",
    },
  },
  "postgres": {
    resourceId: "postgres",
    resourceType: "DATABASE",
    displayName: "PostgreSQL Database (checkout_db)",
    logicalRole: "Relational persistence store for orders, products, and order_items",
    supportedEnvironments: ["LOCAL", "AWS"],
    allowedOperations: ["get_database_health", "reset_environment"],
    dependencies: [],
    localMapping: {
      containerName: "runsafe-postgres",
      hostPort: 5432,
    },
    awsMapping: {
      serviceName: "postgres",
      targetPort: 5432,
    },
  },
  "nginx": {
    resourceId: "nginx",
    resourceType: "PROXY",
    displayName: "Nginx Load Balancer",
    logicalRole: "Round-robin reverse proxy routing traffic across API replicas",
    supportedEnvironments: ["LOCAL", "AWS"],
    allowedOperations: ["get_service_health"],
    dependencies: ["checkout-api-1", "checkout-api-2"],
    localMapping: {
      containerName: "runsafe-nginx",
      hostPort: 8080,
      healthPath: "/nginx-health",
    },
    awsMapping: {
      serviceName: "nginx",
      targetPort: 8080,
      healthPath: "/nginx-health",
    },
  },
};

export function getResourceRecord(resourceId: string): ResourceRecord {
  const record = RESOURCE_REGISTRY[resourceId];
  if (!record) {
    throw new RunSafeOperationalError(
      "UNKNOWN_RESOURCE",
      `Resource '${resourceId}' is not registered in the trusted resource registry. Unknown targets are rejected.`,
      { resourceId, allowedResources: Object.keys(RESOURCE_REGISTRY) }
    );
  }
  return record;
}

export function validateResource(resourceId: string, environment: TargetEnvironment, operation?: string): ResourceRecord {
  const record = getResourceRecord(resourceId);

  if (!record.supportedEnvironments.includes(environment)) {
    throw new RunSafeOperationalError(
      "UNKNOWN_ENVIRONMENT",
      `Resource '${resourceId}' is not supported in environment '${environment}'.`,
      { resourceId, environment, supportedEnvironments: record.supportedEnvironments }
    );
  }

  if (operation && !record.allowedOperations.includes(operation)) {
    throw new RunSafeOperationalError(
      "UNSUPPORTED_OPERATION",
      `Operation '${operation}' is not permitted on resource '${resourceId}'.`,
      { resourceId, operation, allowedOperations: record.allowedOperations }
    );
  }

  return record;
}

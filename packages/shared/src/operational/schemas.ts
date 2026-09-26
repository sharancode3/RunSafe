import { z } from "zod";
import { TargetEnvironmentSchema } from "./target-environment.js";

export const GetServiceHealthInputSchema = z.object({
  environment: TargetEnvironmentSchema.default("LOCAL"),
  serviceId: z.string().trim().transform(s => s.replace(/["'”’\s,]/g, "")).pipe(z.string().min(1, "serviceId is required")),
}).strict();
export type GetServiceHealthInput = z.infer<typeof GetServiceHealthInputSchema>;

export const GetRecentLogsInputSchema = z.object({
  environment: TargetEnvironmentSchema.default("LOCAL"),
  serviceId: z.string().trim().transform(s => s.replace(/["'”’\s,]/g, "")).pipe(z.string().min(1, "serviceId is required")),
  limit: z.number().int().min(1).max(100).default(50),
}).strict();
export type GetRecentLogsInput = z.infer<typeof GetRecentLogsInputSchema>;

export const GetMetricsInputSchema = z.object({
  environment: TargetEnvironmentSchema.default("LOCAL"),
  serviceId: z.string().trim().transform(s => s.replace(/["'”’\s,]/g, "")).pipe(z.string().min(1, "serviceId is required")),
}).strict();
export type GetMetricsInput = z.infer<typeof GetMetricsInputSchema>;

export const GetDatabaseHealthInputSchema = z.object({
  environment: TargetEnvironmentSchema.default("LOCAL"),
  databaseId: z.string().trim().transform(s => s.replace(/["'”’\s,]/g, "")).default("postgres"),
}).strict();
export type GetDatabaseHealthInput = z.infer<typeof GetDatabaseHealthInputSchema>;

export const GetDeploymentStateInputSchema = z.object({
  environment: TargetEnvironmentSchema.default("LOCAL"),
  serviceId: z.string().trim().transform(s => s.replace(/["'”’\s,]/g, "")).default("checkout-service"),
}).strict();
export type GetDeploymentStateInput = z.infer<typeof GetDeploymentStateInputSchema>;

export const GetReplicaStateInputSchema = z.object({
  environment: TargetEnvironmentSchema.default("LOCAL"),
  replicaId: z.string().trim().transform(s => s.replace(/["'”’\s,]/g, "")).pipe(z.string().min(1, "replicaId is required")),
}).strict();
export type GetReplicaStateInput = z.infer<typeof GetReplicaStateInputSchema>;

export const GetDependenciesInputSchema = z.object({
  environment: TargetEnvironmentSchema.default("LOCAL"),
  resourceId: z.string().trim().transform(s => s.replace(/["'”’\s,]/g, "")).pipe(z.string().min(1, "resourceId is required")),
}).strict();
export type GetDependenciesInput = z.infer<typeof GetDependenciesInputSchema>;

export const RunSyntheticCheckoutInputSchema = z.object({
  environment: TargetEnvironmentSchema.default("LOCAL"),
  productId: z.string().default("prod-001"),
  quantity: z.number().int().positive().default(1),
}).strict();
export type RunSyntheticCheckoutInput = z.infer<typeof RunSyntheticCheckoutInputSchema>;

export const RestartServiceInputSchema = z.object({
  environment: TargetEnvironmentSchema.default("LOCAL"),
  target: z.string().min(1, "target replica/service is required"),
  authorizationContext: z.string().optional(),
}).strict();
export type RestartServiceInput = z.infer<typeof RestartServiceInputSchema>;

export const RollbackCanaryInputSchema = z.object({
  environment: TargetEnvironmentSchema.default("LOCAL"),
  serviceId: z.string().default("checkout-service"),
  replicaId: z.string().min(1, "replicaId is required"),
  targetVersion: z.enum(["v1.0.0", "v2.0.0"]).default("v1.0.0"),
  authorizationContext: z.string().optional(),
}).strict();
export type RollbackCanaryInput = z.infer<typeof RollbackCanaryInputSchema>;

export const RollbackFullInputSchema = z.object({
  environment: TargetEnvironmentSchema.default("LOCAL"),
  serviceId: z.string().default("checkout-service"),
  targetVersion: z.enum(["v1.0.0", "v2.0.0"]).default("v1.0.0"),
  authorizationContext: z.string().optional(),
}).strict();
export type RollbackFullInput = z.infer<typeof RollbackFullInputSchema>;

export const InjectProcessCrashInputSchema = z.object({
  environment: TargetEnvironmentSchema.default("LOCAL"),
  targetReplica: z.enum(["checkout-api-1", "checkout-api-2"]).default("checkout-api-1"),
}).strict();
export type InjectProcessCrashInput = z.infer<typeof InjectProcessCrashInputSchema>;

export const InjectBadDeploymentInputSchema = z.object({
  environment: TargetEnvironmentSchema.default("LOCAL"),
  targetReplica: z.enum(["checkout-api-1", "checkout-api-2"]).default("checkout-api-2"),
  badVersion: z.string().default("v2.0.0"),
}).strict();
export type InjectBadDeploymentInput = z.infer<typeof InjectBadDeploymentInputSchema>;

export const InjectAmbiguousFailureInputSchema = z.object({
  environment: TargetEnvironmentSchema.default("LOCAL"),
  probability: z.number().min(0).max(1).default(0.35),
}).strict();
export type InjectAmbiguousFailureInput = z.infer<typeof InjectAmbiguousFailureInputSchema>;

export const ResetEnvironmentInputSchema = z.object({
  environment: TargetEnvironmentSchema.default("LOCAL"),
}).strict();
export type ResetEnvironmentInput = z.infer<typeof ResetEnvironmentInputSchema>;

import { z } from "zod";

/**
 * Validated schema for input to the demo checkout transaction.
 */
export const CheckoutRequestSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  quantity: z.number().int().positive().default(1),
  syntheticRequestId: z.string().optional(),
});

export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

/**
 * Validated schema for output from the demo checkout transaction.
 */
export const CheckoutResponseSchema = z.object({
  success: z.boolean(),
  orderId: z.string().optional(),
  productId: z.string().optional(),
  quantity: z.number().optional(),
  total: z.number().optional(),
  version: z.string(),
  replica: z.string(),
  environment: z.string(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
});

export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;

/**
 * Validated schema for demo workload /health endpoint.
 */
export const WorkloadHealthSchema = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  service: z.string(),
  version: z.string(),
  replica: z.string(),
  environment: z.string(),
  db: z.enum(["connected", "disconnected"]),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});

export type WorkloadHealth = z.infer<typeof WorkloadHealthSchema>;

/**
 * Validated schema for demo workload /version endpoint.
 */
export const WorkloadVersionSchema = z.object({
  service: z.string(),
  version: z.string(),
  replica: z.string(),
  environment: z.string(),
  faultProfile: z.string(),
  buildId: z.string().optional(),
});

export type WorkloadVersion = z.infer<typeof WorkloadVersionSchema>;

/**
 * Validated schema for demo workload /metrics endpoint.
 */
export const WorkloadMetricsSchema = z.object({
  service: z.string(),
  version: z.string(),
  replica: z.string(),
  environment: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  requestsTotal: z.number().nonnegative(),
  requestsSuccess: z.number().nonnegative(),
  requestsFailed: z.number().nonnegative(),
  errorRate: z.number().min(0).max(1),
  checkoutTotal: z.number().nonnegative(),
  checkoutSuccess: z.number().nonnegative(),
  checkoutFailed: z.number().nonnegative(),
  avgLatencyMs: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});

export type WorkloadMetrics = z.infer<typeof WorkloadMetricsSchema>;

/**
 * Validated schema for structured traffic generator observation records.
 */
export const TrafficRecordSchema = z.object({
  timestamp: z.string().datetime(),
  requestId: z.string(),
  status: z.number(),
  success: z.boolean(),
  version: z.string(),
  replica: z.string(),
  durationMs: z.number().nonnegative(),
  environment: z.string(),
  error: z.string().optional(),
});

export type TrafficRecord = z.infer<typeof TrafficRecordSchema>;

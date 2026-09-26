import { z } from "zod";

/**
 * Validated schema for RunSafe MCP runtime status check tool.
 * Returned by `get_runtime_status`.
 */
export const RuntimeStatusSchema = z.object({
  service: z.string(),
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  timestamp: z.string().datetime(),
  runtime: z.string(),
  environment: z.string(),
  version: z.string(),
  nodeVersion: z.string(),
  uptimeSeconds: z.number().nonnegative(),
});

export type RuntimeStatus = z.infer<typeof RuntimeStatusSchema>;

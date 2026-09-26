import { z } from "zod";
import { TargetEnvironment, TargetEnvironmentSchema } from "./target-environment.js";
import { OperationalErrorCode, RunSafeOperationalError } from "./errors.js";
import { sanitizeOutput } from "./sanitizer.js";

export const ToolErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  timestamp: z.string(),
});
export type ToolErrorPayload = z.infer<typeof ToolErrorPayloadSchema>;

export const ToolEnvelopeSchema = z.object({
  success: z.boolean(),
  tool: z.string(),
  correlationId: z.string(),
  environment: TargetEnvironmentSchema,
  resource: z.string(),
  provider: z.string(),
  timestamp: z.string(),
  durationMs: z.number().nonnegative(),
  data: z.unknown().optional(),
  error: ToolErrorPayloadSchema.optional(),
  technicalStatus: z.string().optional(),
  operationId: z.string().optional(),
});
export type ToolEnvelope = z.infer<typeof ToolEnvelopeSchema>;

export function wrapToolResult<T>(params: {
  tool: string;
  environment: TargetEnvironment;
  resource: string;
  provider: string;
  data: T;
  durationMs: number;
  correlationId?: string;
  technicalStatus?: string;
  operationId?: string;
}): ToolEnvelope {
  const correlationId = params.correlationId || `corr-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  return {
    success: true,
    tool: params.tool,
    correlationId,
    environment: params.environment,
    resource: params.resource,
    provider: params.provider,
    timestamp: new Date().toISOString(),
    durationMs: Math.max(0, params.durationMs),
    data: sanitizeOutput(params.data),
    technicalStatus: params.technicalStatus,
    operationId: params.operationId,
  };
}

export function wrapToolError(params: {
  tool: string;
  environment: TargetEnvironment;
  resource: string;
  provider: string;
  error: unknown;
  durationMs: number;
  correlationId?: string;
}): ToolEnvelope {
  const correlationId = params.correlationId || `corr-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  let code: OperationalErrorCode = "INTERNAL_ADAPTER_ERROR";
  let message = "An internal error occurred.";
  let details: Record<string, unknown> | undefined;

  if (params.error instanceof RunSafeOperationalError) {
    code = params.error.code;
    message = params.error.message;
    details = params.error.details;
  } else if (params.error instanceof Error) {
    message = params.error.message;
    if (params.error.name === "AbortError" || message.toLowerCase().includes("timeout")) {
      code = "TIMEOUT";
    }
  }

  return {
    success: false,
    tool: params.tool,
    correlationId,
    environment: params.environment,
    resource: params.resource,
    provider: params.provider,
    timestamp: new Date().toISOString(),
    durationMs: Math.max(0, params.durationMs),
    error: {
      code,
      message: sanitizeOutput(message),
      details: sanitizeOutput(details),
      timestamp: new Date().toISOString(),
    },
  };
}

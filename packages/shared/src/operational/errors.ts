import { z } from "zod";

export const OperationalErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "UNKNOWN_RESOURCE",
  "UNKNOWN_ENVIRONMENT",
  "UNSUPPORTED_OPERATION",
  "TARGET_UNAVAILABLE",
  "TIMEOUT",
  "REMOTE_EXECUTION_FAILED",
  "SERVICE_NOT_FOUND",
  "DATABASE_UNAVAILABLE",
  "NETWORK_ERROR",
  "MALFORMED_RESULT",
  "OPERATION_CONFLICT",
  "ALREADY_IN_DESIRED_STATE",
  "REHEARSAL_ONLY_OPERATION",
  "AUTHORIZATION_CONTEXT_REQUIRED",
  "ADAPTER_NOT_CONFIGURED",
  "INTERNAL_ADAPTER_ERROR",
]);

export type OperationalErrorCode = z.infer<typeof OperationalErrorCodeSchema>;

export class RunSafeOperationalError extends Error {
  public readonly code: OperationalErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(code: OperationalErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "RunSafeOperationalError";
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  public toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

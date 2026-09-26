import { config } from "./config.js";

export interface LogPayload {
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  message: string;
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  errorCategory?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export function log(payload: LogPayload): void {
  const entry = {
    timestamp: new Date().toISOString(),
    service: "checkout-api",
    version: config.appVersion,
    replica: config.replicaId,
    environment: config.environment,
    ...payload,
  };

  const line = JSON.stringify(entry);
  if (payload.level === "ERROR") {
    console.error(line);
  } else if (payload.level === "WARN") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

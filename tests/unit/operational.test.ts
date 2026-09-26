import { describe, it, expect } from "vitest";
import {
  RESOURCE_REGISTRY,
  TOOL_REGISTRY,
  validateResource,
  getResourceRecord,
  filterToolsByMode,
  sanitizeOutput,
  redactSensitiveString,
  wrapToolResult,
  wrapToolError,
  RunSafeOperationalError,
  getToolRecord,
} from "@runsafe/shared";
import { getInfrastructureAdapter } from "@runsafe/infrastructure-adapter";

describe("Stage 3 Operational & Resource Registry", () => {
  it("contains all registered Stage 2 resources", () => {
    expect(RESOURCE_REGISTRY["checkout-service"]).toBeDefined();
    expect(RESOURCE_REGISTRY["checkout-api-1"]).toBeDefined();
    expect(RESOURCE_REGISTRY["checkout-api-2"]).toBeDefined();
    expect(RESOURCE_REGISTRY["postgres"]).toBeDefined();
    expect(RESOURCE_REGISTRY["nginx"]).toBeDefined();
  });

  it("validates known resource on LOCAL environment", () => {
    const record = validateResource("checkout-api-1", "LOCAL", "get_service_health");
    expect(record.resourceId).toBe("checkout-api-1");
    expect(record.localMapping.hostPort).toBe(8081);
  });

  it("fails closed on unknown resource", () => {
    expect(() => validateResource("server-unknown-999", "LOCAL")).toThrowError(
      RunSafeOperationalError
    );
    try {
      validateResource("server-unknown-999", "LOCAL");
    } catch (e: any) {
      expect(e.code).toBe("UNKNOWN_RESOURCE");
    }
  });

  it("fails closed on unsupported operation", () => {
    expect(() =>
      validateResource("nginx", "LOCAL", "rollback_canary")
    ).toThrowError(RunSafeOperationalError);
    try {
      validateResource("nginx", "LOCAL", "rollback_canary");
    } catch (e: any) {
      expect(e.code).toBe("UNSUPPORTED_OPERATION");
    }
  });
});

describe("Stage 3 Tool Registry & Mode Isolation", () => {
  it("contains all 15 operational tools with metadata", () => {
    const toolIds = Object.keys(TOOL_REGISTRY);
    expect(toolIds.length).toBe(15);
    expect(TOOL_REGISTRY["get_service_health"]?.readOnly).toBe(true);
    expect(TOOL_REGISTRY["restart_service"]?.mutation).toBe(true);
    expect(TOOL_REGISTRY["rollback_canary"]?.mutation).toBe(true);
    expect(TOOL_REGISTRY["rollback_full"]?.mutation).toBe(true);
    expect(TOOL_REGISTRY["inject_bad_deployment"]?.rehearsalOnly).toBe(true);
  });

  it("strictly excludes rehearsal-only tools in RECOVERY mode", () => {
    const recoveryTools = filterToolsByMode("RECOVERY");
    const recoveryToolIds = recoveryTools.map((t) => t.toolId);

    expect(recoveryToolIds).toContain("get_service_health");
    expect(recoveryToolIds).toContain("get_recent_logs");
    expect(recoveryToolIds).toContain("get_metrics");
    expect(recoveryToolIds).toContain("restart_service");
    expect(recoveryToolIds).toContain("rollback_canary");
    expect(recoveryToolIds).toContain("rollback_full");

    // Rehearsal tools MUST NOT be in RECOVERY mode
    expect(recoveryToolIds).not.toContain("inject_process_crash");
    expect(recoveryToolIds).not.toContain("inject_bad_deployment");
    expect(recoveryToolIds).not.toContain("inject_ambiguous_failure");
    expect(recoveryToolIds).not.toContain("reset_environment");
  });

  it("includes rehearsal tools in REHEARSAL mode", () => {
    const rehearsalTools = filterToolsByMode("REHEARSAL");
    const rehearsalToolIds = rehearsalTools.map((t) => t.toolId);

    expect(rehearsalToolIds).toContain("inject_bad_deployment");
    expect(rehearsalToolIds).toContain("reset_environment");
    expect(rehearsalToolIds).toContain("get_service_health");
  });
});

describe("Stage 3 Security Sanitization & Envelope", () => {
  it("redacts sensitive connection strings and secrets in strings", () => {
    const raw = "Connecting to postgres://admin:super_secret_pw@10.0.0.1:5432/db with key sk-1234567890abcdef1234567890";
    const sanitized = redactSensitiveString(raw);
    expect(sanitized).not.toContain("super_secret_pw");
    expect(sanitized).not.toContain("sk-1234567890abcdef1234567890");
    expect(sanitized).toContain("[REDACTED]");
  });

  it("recursively redacts sensitive keys in JSON payloads", () => {
    const payload = {
      service: "checkout-api-1",
      token: "secret-token-xyz",
      apiKey: "secret-api-key",
      nested: {
        password: "pword",
        safeValue: 42,
      },
    };
    const sanitized: any = sanitizeOutput(payload);
    expect(sanitized.token).toBe("[REDACTED]");
    expect(sanitized.apiKey).toBe("[REDACTED]");
    expect(sanitized.nested.password).toBe("[REDACTED]");
    expect(sanitized.nested.safeValue).toBe(42);
  });

  it("wraps successful result in standard envelope", () => {
    const envelope = wrapToolResult({
      tool: "get_service_health",
      environment: "LOCAL",
      resource: "checkout-api-1",
      provider: "LOCAL_DOCKER",
      data: { status: "healthy" },
      durationMs: 45,
    });

    expect(envelope.success).toBe(true);
    expect(envelope.tool).toBe("get_service_health");
    expect(envelope.environment).toBe("LOCAL");
    expect(envelope.correlationId).toMatch(/^corr-/);
    expect(envelope.durationMs).toBe(45);
    expect((envelope.data as any).status).toBe("healthy");
  });

  it("wraps operational error in standard envelope", () => {
    const opError = new RunSafeOperationalError(
      "UNKNOWN_RESOURCE",
      "Resource is unknown",
      { target: "foo" }
    );
    const envelope = wrapToolError({
      tool: "get_service_health",
      environment: "LOCAL",
      resource: "foo",
      provider: "LOCAL_DOCKER",
      error: opError,
      durationMs: 12,
    });

    expect(envelope.success).toBe(false);
    expect(envelope.error?.code).toBe("UNKNOWN_RESOURCE");
    expect(envelope.error?.message).toContain("Resource is unknown");
  });
});

describe("Stage 3 Infrastructure Adapter Factory", () => {
  it("resolves LocalDockerAdapter for LOCAL target", () => {
    const adapter = getInfrastructureAdapter("LOCAL");
    expect(adapter.provider).toBe("LOCAL_DOCKER");
    expect(adapter.environment).toBe("LOCAL");
  });

  it("resolves AwsInfrastructureAdapter for AWS target", () => {
    const adapter = getInfrastructureAdapter("AWS");
    expect(adapter.provider).toBe("AWS_EC2");
    expect(adapter.environment).toBe("AWS");
  });

  it("returns explicit BLOCKED/NOT_CONFIGURED error on AWS when unconfigured", async () => {
    const adapter = getInfrastructureAdapter("AWS");
    await expect(adapter.getServiceHealth("checkout-service")).rejects.toThrowError(
      RunSafeOperationalError
    );
    try {
      await adapter.getServiceHealth("checkout-service");
    } catch (e: any) {
      expect(e.code).toBe("ADAPTER_NOT_CONFIGURED");
    }
  });
});

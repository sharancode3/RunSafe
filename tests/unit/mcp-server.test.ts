import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RunSafeMcpServer } from "@runsafe/mcp-server";
import { RuntimeStatusSchema, GuardedNoopOutputSchema } from "@runsafe/shared";

describe("RunSafe MCP Server & Tools Tests", () => {
  let mcpServer: RunSafeMcpServer;
  const testPort = 4098;

  beforeAll(async () => {
    mcpServer = new RunSafeMcpServer();
    await mcpServer.start(testPort, "127.0.0.1");
  });

  afterAll(async () => {
    await mcpServer.stop();
  });

  it("answers HTTP health check with status ok", async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/health`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.status).toBe("ok");
    expect(data.service).toBe("runsafe-mcp");
    expect(data.mode).toBe("RECOVERY");
  });

  it("handles get_runtime_status tool request correctly", async () => {
    const testServer = mcpServer.createTestServer();
    const result = await (testServer as any)._requestHandlers.get("tools/call")({
      method: "tools/call",
      params: {
        name: "get_runtime_status",
        arguments: {},
      },
    });

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    const validated = RuntimeStatusSchema.parse(parsed);
    expect(validated.service).toBe("runsafe-mcp");
    expect(validated.status).toBe("healthy");
    expect(validated.nodeVersion).toBe(process.version);
  });

  it("handles stage1_guarded_noop tool request and tracks execution count", async () => {
    const testServer = mcpServer.createTestServer();
    const actionId = `test_action_${Date.now()}`;
    const result = await (testServer as any)._requestHandlers.get("tools/call")({
      method: "tools/call",
      params: {
        name: "stage1_guarded_noop",
        arguments: {
          actionId,
          reason: "Automated unit test execution",
        },
      },
    });

    const parsed = JSON.parse(result.content[0].text);
    const validated = GuardedNoopOutputSchema.parse(parsed);
    expect(validated.executed).toBe(true);
    expect(validated.actionId).toBe(actionId);
    expect(validated.executionCount).toBeGreaterThanOrEqual(1);

    const stats = mcpServer.getExecutionStats();
    expect(stats.executedActionIds).toContain(actionId);
  });

  it("fails cleanly when malformed input is sent to stage1_guarded_noop", async () => {
    const testServer = mcpServer.createTestServer();
    const result = await (testServer as any)._requestHandlers.get("tools/call")({
      method: "tools/call",
      params: {
        name: "stage1_guarded_noop",
        arguments: {}, // missing required actionId
      },
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBeDefined();
    expect(parsed.error.code).toBe("INTERNAL_ADAPTER_ERROR");
  });

  it("fails cleanly with structured error when an unknown tool is invoked", async () => {
    const testServer = mcpServer.createTestServer();
    const result = await (testServer as any)._requestHandlers.get("tools/call")({
      method: "tools/call",
      params: {
        name: "unregistered_magical_tool",
        arguments: {},
      },
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error.code).toBe("UNSUPPORTED_OPERATION");
    expect(parsed.error.message).toContain("unregistered_magical_tool");
  });

  it("isolates rehearsal-only tools when in RECOVERY mode", async () => {
    const testServer = mcpServer.createTestServer();
    const result = await (testServer as any)._requestHandlers.get("tools/call")({
      method: "tools/call",
      params: {
        name: "inject_bad_deployment",
        arguments: { environment: "LOCAL" },
      },
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error.code).toBe("REHEARSAL_ONLY_OPERATION");
    expect(parsed.error.message).toContain("REHEARSAL capability mode");
  });

  it("requires authorization context for mutation tools in production mode", async () => {
    const testServer = mcpServer.createTestServer();
    const originalEnv = process.env.RUNSAFE_ALLOW_STAGE3_TEST_MUTATIONS;
    delete process.env.RUNSAFE_ALLOW_STAGE3_TEST_MUTATIONS;

    const result = await (testServer as any)._requestHandlers.get("tools/call")({
      method: "tools/call",
      params: {
        name: "restart_service",
        arguments: { environment: "LOCAL", target: "checkout-api-1" },
      },
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error.code).toBe("AUTHORIZATION_CONTEXT_REQUIRED");

    if (originalEnv) {
      process.env.RUNSAFE_ALLOW_STAGE3_TEST_MUTATIONS = originalEnv;
    }
  });
});

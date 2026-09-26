import { describe, it, expect } from "vitest";
import {
  RuntimeStatusSchema,
  GuardedNoopInputSchema,
  GuardedNoopOutputSchema,
  ReadinessReportSchema,
  RunSafeEventEnvelopeSchema,
} from "@runsafe/shared";

describe("Shared Schemas Unit Tests", () => {
  describe("RuntimeStatusSchema", () => {
    it("validates a healthy status payload successfully", () => {
      const valid = {
        service: "runsafe-mcp",
        status: "healthy",
        timestamp: new Date().toISOString(),
        runtime: "node v24.11.0",
        environment: "development",
        version: "0.1.0",
        nodeVersion: "v24.11.0",
        uptimeSeconds: 120,
      };
      const result = RuntimeStatusSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects invalid status enum value", () => {
      const invalid = {
        service: "runsafe-mcp",
        status: "exploding",
        timestamp: new Date().toISOString(),
        runtime: "node v24.11.0",
        environment: "development",
        version: "0.1.0",
        nodeVersion: "v24.11.0",
        uptimeSeconds: 120,
      };
      const result = RuntimeStatusSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects negative uptimeSeconds", () => {
      const invalid = {
        service: "runsafe-mcp",
        status: "healthy",
        timestamp: new Date().toISOString(),
        runtime: "node v24.11.0",
        environment: "development",
        version: "0.1.0",
        nodeVersion: "v24.11.0",
        uptimeSeconds: -5,
      };
      const result = RuntimeStatusSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("GuardedNoop schemas", () => {
    it("validates valid GuardedNoopInput", () => {
      const valid = {
        actionId: "act_verify_123",
        reason: "Stage 1 verification",
      };
      const result = GuardedNoopInputSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects empty actionId", () => {
      const invalid = {
        actionId: "",
      };
      const result = GuardedNoopInputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("validates valid GuardedNoopOutput", () => {
      const valid = {
        executed: true,
        actionId: "act_1",
        executionCount: 1,
        timestamp: new Date().toISOString(),
        note: "Verified execution",
      };
      const result = GuardedNoopOutputSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects executed: false on GuardedNoopOutput", () => {
      const invalid = {
        executed: false,
        actionId: "act_1",
        executionCount: 1,
        timestamp: new Date().toISOString(),
        note: "Not executed",
      };
      const result = GuardedNoopOutputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("ReadinessReportSchema", () => {
    it("validates a complete readiness report", () => {
      const now = new Date().toISOString();
      const valid = {
        overall: "READY",
        timestamp: now,
        components: {
          controlPlane: { state: "READY", message: "ok", lastChecked: now },
          trueForge: { state: "READY", message: "ok", lastChecked: now },
          primaryModel: { state: "READY", message: "ok", lastChecked: now },
          runSafeAgent: { state: "READY", message: "ok", lastChecked: now },
          mcpServer: { state: "READY", message: "ok", lastChecked: now },
          toolExecution: { state: "READY", message: "ok", lastChecked: now },
          sandbox: { state: "BLOCKED", message: "waiting credentials", lastChecked: now },
          approvalCheckpoint: { state: "READY", message: "ok", lastChecked: now },
          programmaticIntegration: { state: "READY", message: "ok", lastChecked: now },
        },
      };
      const result = ReadinessReportSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe("RunSafeEventEnvelopeSchema", () => {
    it("validates normalized event envelope", () => {
      const valid = {
        id: "evt_1",
        type: "TOOL_CALL_STARTED",
        sessionId: "sess_101",
        turnId: "turn_202",
        timestamp: new Date().toISOString(),
        payload: { toolName: "get_runtime_status" },
      };
      const result = RunSafeEventEnvelopeSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });
});

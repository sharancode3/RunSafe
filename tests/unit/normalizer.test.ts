import { describe, it, expect } from "vitest";
import { normalizeTrueForgeEvent } from "@runsafe/trueforge-client";

describe("TrueForge Event Normalizer Tests", () => {
  const sessionId = "session_test_123";
  const turnId = "turn_test_456";

  it("normalizes tool.approval_required into APPROVAL_WAITING", () => {
    const raw = {
      type: "tool.approval_required",
      thread_id: "thread_1",
      tool_call_id: "call_abc",
      tool_name: "stage1_guarded_noop",
      arguments: { actionId: "test_action" },
    };

    const normalized = normalizeTrueForgeEvent(raw, sessionId, turnId);
    expect(normalized).not.toBeNull();
    expect(normalized?.type).toBe("APPROVAL_WAITING");
    expect(normalized?.payload.threadId).toBe("thread_1");
    expect(normalized?.payload.toolCallId).toBe("call_abc");
    expect(normalized?.payload.decisionRequired).toBe(true);
  });

  it("normalizes tool.call into TOOL_CALL_STARTED", () => {
    const raw = {
      type: "tool.call",
      tool_name: "get_runtime_status",
      tool_call_id: "call_status_1",
      arguments: {},
    };

    const normalized = normalizeTrueForgeEvent(raw, sessionId, turnId);
    expect(normalized).not.toBeNull();
    expect(normalized?.type).toBe("TOOL_CALL_STARTED");
    expect(normalized?.payload.toolName).toBe("get_runtime_status");
  });

  it("normalizes model.message into MODEL_ACTIVITY", () => {
    const raw = {
      type: "model.message",
      content: "Inspecting application logs...",
      model: "gpt-5.4-mini",
    };

    const normalized = normalizeTrueForgeEvent(raw, sessionId, turnId);
    expect(normalized).not.toBeNull();
    expect(normalized?.type).toBe("MODEL_ACTIVITY");
    expect(normalized?.payload.content).toBe("Inspecting application logs...");
  });

  it("returns null for unknown/unhandled events", () => {
    const raw = { type: "random.unsupported.event" };
    const normalized = normalizeTrueForgeEvent(raw, sessionId, turnId);
    expect(normalized).toBeNull();
  });
});

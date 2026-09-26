import type { RunSafeEventEnvelope, RunSafeEventType } from "@runsafe/shared";

/**
 * Normalizes raw TrueForge events into domain-level RunSafe events.
 * Keeps TrueForge internals isolated from RunSafe UI and control plane.
 */
export function normalizeTrueForgeEvent(
  rawEvent: any,
  sessionId: string,
  turnId?: string
): RunSafeEventEnvelope | null {
  if (!rawEvent || typeof rawEvent !== "object") return null;

  const eventType = rawEvent.type || rawEvent.event;
  const now = new Date().toISOString();
  const eventId = rawEvent.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  let normalizedType: RunSafeEventType;
  let payload: Record<string, unknown> = {};

  switch (eventType) {
    case "turn.started":
    case "session.started":
      normalizedType = "AGENT_RUN_STARTED";
      payload = { turnId: rawEvent.turn_id ?? turnId, agent: rawEvent.agent };
      break;

    case "model.activity":
    case "model.message":
    case "message.delta":
      normalizedType = "MODEL_ACTIVITY";
      payload = {
        content: rawEvent.content || rawEvent.delta || "",
        model: rawEvent.model,
      };
      break;

    case "tool.call":
    case "tool.started":
      normalizedType = "TOOL_CALL_STARTED";
      payload = {
        toolName: rawEvent.tool_name || rawEvent.name,
        toolCallId: rawEvent.tool_call_id || rawEvent.id,
        args: rawEvent.arguments || rawEvent.input,
      };
      break;

    case "tool.result":
    case "tool.completed":
    case "tool.response":
      normalizedType = "TOOL_CALL_COMPLETED";
      payload = {
        toolName: rawEvent.tool_name || rawEvent.name,
        toolCallId: rawEvent.tool_call_id || rawEvent.id,
        result: rawEvent.result || rawEvent.output || rawEvent.content,
        status: rawEvent.status || "success",
      };
      break;

    case "tool.approval_required":
    case "approval.requested":
      normalizedType = "APPROVAL_WAITING";
      payload = {
        threadId: rawEvent.thread_id,
        toolCallId: rawEvent.tool_call_id,
        toolName: rawEvent.tool_name,
        arguments: rawEvent.arguments,
        decisionRequired: true,
      };
      break;

    case "tool.approval_resolved":
    case "approval.resolved":
      normalizedType = "APPROVAL_RESOLVED";
      payload = {
        toolCallId: rawEvent.tool_call_id,
        decision: rawEvent.status || rawEvent.decision,
      };
      break;

    case "sandbox.started":
      normalizedType = "SANDBOX_STARTED";
      payload = { executionId: rawEvent.execution_id, codeSnippet: rawEvent.code };
      break;

    case "sandbox.completed":
      normalizedType = "SANDBOX_COMPLETED";
      payload = {
        executionId: rawEvent.execution_id,
        exitCode: rawEvent.exit_code,
        output: rawEvent.output,
      };
      break;

    case "turn.done":
    case "turn.completed":
      normalizedType = "AGENT_RUN_COMPLETED";
      payload = {
        turnId: rawEvent.turn_id ?? turnId,
        output: rawEvent.output,
      };
      break;

    case "turn.failed":
    case "turn.error":
      normalizedType = "AGENT_RUN_FAILED";
      payload = {
        turnId: rawEvent.turn_id ?? turnId,
        error: rawEvent.error || "Unknown execution error",
      };
      break;

    default:
      return null;
  }

  return {
    id: eventId,
    type: normalizedType,
    sessionId,
    turnId,
    timestamp: now,
    payload,
  };
}

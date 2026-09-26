import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { TrueForgeClient } from "@runsafe/trueforge-client";
import { getConfig } from "../config.js";

const SmokeRunInputSchema = z.object({
  prompt: z
    .string()
    .default(
      "Use the available tool to check the RunSafe runtime status. Return the tool result and do not guess."
    ),
});

const ApprovalRunInputSchema = z.object({
  actionId: z.string().default(`action_${Date.now()}`),
  allow: z.boolean().default(true),
  reason: z.string().optional(),
});

export const devTrueForgeRoutes: FastifyPluginAsync = async (fastify) => {
  const config = getConfig();
  const tfClient = new TrueForgeClient({ baseUrl: config.TRUEFORGE_URL });

  /**
   * Programmatic smoke test executing the full chain:
   * Fastify -> TrueForge API -> saved RunSafe Agent -> Model -> MCP Server -> get_runtime_status -> Result -> Fastify
   */
  fastify.post("/api/dev/trueforge/smoke-run", async (request, reply) => {
    const parsed = SmokeRunInputSchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    try {
      // 1. Create a session targeting the saved RunSafe agent
      const session = await tfClient.createSession(config.RUNSAFE_AGENT_NAME);

      // 2. Start a turn
      const initialTurn = await tfClient.runTurn(session.id, parsed.data.prompt);

      // 3. Wait for completion and observe normalized events
      const { turn, normalizedEvents } = await tfClient.waitForTurn(session.id, initialTurn.id, 45000);

      const hasToolCall = normalizedEvents.some(
        (e) => e.type === "TOOL_CALL_STARTED" || e.type === "TOOL_CALL_COMPLETED"
      );
      const hasToolResult = normalizedEvents.some((e) => e.type === "TOOL_CALL_COMPLETED");

      return reply.status(200).send({
        success: turn.state.status === "done",
        sessionId: session.id,
        turnId: turn.id,
        status: turn.state.status,
        output: turn.state.output,
        hasToolCall,
        hasToolResult,
        normalizedEvents,
      });
    } catch (err: any) {
      fastify.log.error({ err }, "Smoke run failed");
      return reply.status(500).send({
        success: false,
        error: err.message,
      });
    }
  });

  /**
   * Programmatic approval checkpoint verification:
   * Fastify -> TrueForge -> stage1_guarded_noop -> pause at approval -> allow/deny resume
   */
  fastify.post("/api/dev/trueforge/approval-run", async (request, reply) => {
    const parsed = ApprovalRunInputSchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { actionId, allow, reason } = parsed.data;

    try {
      const session = await tfClient.createSession(config.RUNSAFE_AGENT_NAME);
      const prompt = `Please execute the guarded verification tool stage1_guarded_noop with actionId "${actionId}". Do not guess or fabricate.`;

      const initialTurn = await tfClient.runTurn(session.id, prompt);
      const { turn, approvalRequired, normalizedEvents } = await tfClient.waitForTurn(
        session.id,
        initialTurn.id,
        30000
      );

      if (!approvalRequired) {
        return reply.status(200).send({
          success: false,
          message: "Agent did not pause for approval. Ensure tool approval is configured in TrueForge.",
          status: turn.state.status,
          normalizedEvents,
        });
      }

      // Resume with human approval decision
      const resumeTurn = await tfClient.resumeApproval(
        session.id,
        approvalRequired.threadId,
        approvalRequired.toolCallId,
        allow,
        reason
      );

      const finalResult = await tfClient.waitForTurn(session.id, resumeTurn.id, 30000);

      return reply.status(200).send({
        success: true,
        checkpointEncountered: true,
        decision: allow ? "APPROVED" : "REJECTED",
        sessionId: session.id,
        finalTurnId: finalResult.turn.id,
        finalStatus: finalResult.turn.state.status,
        normalizedEvents: [...normalizedEvents, ...finalResult.normalizedEvents],
      });
    } catch (err: any) {
      fastify.log.error({ err }, "Approval run failed");
      return reply.status(500).send({
        success: false,
        error: err.message,
      });
    }
  });
};

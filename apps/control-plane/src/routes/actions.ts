import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  ActionProposalInputSchema,
  ActionRepository,
  buildProofCarryingAction,
} from "@runsafe/actions";
import {
  SafetyKernel,
  ApprovalService,
  ExecutionAuthorizer,
} from "@runsafe/safety-kernel";
import { RunbookRepository } from "@runsafe/runbooks";
import { getInfrastructureAdapter } from "@runsafe/infrastructure-adapter";
import type { TargetEnvironment } from "@runsafe/shared";

export const actionRoutes: FastifyPluginAsync = async (app) => {
  const actionRepo = new ActionRepository();
  const safetyKernel = new SafetyKernel();
  const approvalService = new ApprovalService();
  const executionAuthorizer = new ExecutionAuthorizer();
  const runbookRepo = new RunbookRepository();

  // 1. Propose a new Proof-Carrying Action
  app.post("/api/v1/actions/propose", async (request, reply) => {
    const parsed = ActionProposalInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { message: "Invalid action proposal payload", details: parsed.error.issues },
      });
    }

    const input = parsed.data;

    // Optional contract step lookup for enrichment
    let step;
    const contractRecord = runbookRepo.getContract(input.contractId);
    if (contractRecord) {
      try {
        const contract = JSON.parse(contractRecord.contract_payload);
        step = contract.steps?.find((s: any) => s.id === input.stepId);
      } catch {}
    }

    const pca = buildProofCarryingAction(input, step);
    actionRepo.saveAction(pca);

    return reply.status(201).send({ data: pca });
  });

  // 2. Evaluate a Proof-Carrying Action against Safety Kernel policies
  app.post("/api/v1/actions/:id/evaluate", async (request, reply) => {
    const { id } = request.params as { id: string };
    const pca = actionRepo.getActionById(id);
    if (!pca) {
      return reply.status(404).send({ error: { message: `Action '${id}' not found` } });
    }

    const decision = safetyKernel.evaluateAction(pca);
    const approvalRequest = approvalService.getApprovalRequest(id);
    const updatedAction = actionRepo.getActionById(id);

    return {
      data: {
        action: updatedAction,
        decision,
        approvalRequest,
      },
    };
  });

  // 3. Get Action details, decision, approval status, and executions
  app.get("/api/v1/actions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const pca = actionRepo.getActionById(id);
    if (!pca) {
      return reply.status(404).send({ error: { message: `Action '${id}' not found` } });
    }

    const decision = safetyKernel.getDecisionForAction(id);
    const approvalRequest = approvalService.getApprovalRequest(id);
    const executions = executionAuthorizer.getExecutionsForAction(id);

    return {
      data: {
        action: pca,
        decision,
        approvalRequest,
        executions,
      },
    };
  });

  // 4. Operator Approval Checkpoint (Approve or Reject with cryptographic fingerprint)
  app.post("/api/v1/actions/:id/approval", async (request, reply) => {
    const { id } = request.params as { id: string };
    const bodySchema = z.object({
      decision: z.enum(["APPROVE", "REJECT"]),
      operatorId: z.string().min(1),
      payloadHash: z.string().min(1),
      operatorNote: z.string().optional(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { message: "Invalid approval payload", details: parsed.error.issues },
      });
    }

    const { decision, operatorId, payloadHash, operatorNote } = parsed.data;

    if (decision === "APPROVE") {
      const result = approvalService.approveAction({
        actionId: id,
        operatorId,
        payloadHash,
        operatorNote,
      });

      if (!result.success) {
        return reply.status(422).send({
          error: { message: result.error || "Approval failed" },
        });
      }
    } else {
      const result = approvalService.rejectAction({
        actionId: id,
        operatorId,
        operatorNote,
      });

      if (!result.success) {
        return reply.status(422).send({
          error: { message: result.error || "Rejection failed" },
        });
      }
    }

    const updatedAction = actionRepo.getActionById(id);
    const updatedApproval = approvalService.getApprovalRequest(id);

    return {
      data: {
        action: updatedAction,
        approval: updatedApproval,
      },
    };
  });

  // 5. Execute Action (Atomically claims execution and dispatches tool)
  app.post("/api/v1/actions/:id/execute", async (request, reply) => {
    const { id } = request.params as { id: string };
    const pca = actionRepo.getActionById(id);
    if (!pca) {
      return reply.status(404).send({ error: { message: `Action '${id}' not found` } });
    }

    // 1. Atomically claim execution (prevents double execution, requires approval for high-risk)
    const claim = executionAuthorizer.claimExecution(id);
    if (!claim.claimed || !claim.executionToken) {
      return reply.status(409).send({
        error: {
          message: claim.reason || "Action cannot be executed in its current state.",
          status: pca.status,
        },
      });
    }

    const startTime = Date.now();
    const env: TargetEnvironment = ((pca.toolArguments.environment as TargetEnvironment) || "LOCAL");
    const adapter = getInfrastructureAdapter(env);

    try {
      let output: Record<string, unknown> = {};

      if (pca.toolName === "restart_service") {
        const target = (pca.toolArguments.target as string) || "checkout-api-1";
        output = await adapter.restartService(target);
      } else if (pca.toolName === "rollback_canary") {
        const serviceId = (pca.toolArguments.serviceId as string) || "checkout-service";
        const replicaId = (pca.toolArguments.replicaId as string) || "checkout-api-2";
        const targetVersion = (pca.toolArguments.targetVersion as string) || "v1.0.0";
        output = await adapter.rollbackCanary(serviceId, replicaId, targetVersion);
      } else if (pca.toolName === "rollback_full") {
        const serviceId = (pca.toolArguments.serviceId as string) || "checkout-service";
        const targetVersion = (pca.toolArguments.targetVersion as string) || "v1.0.0";
        output = await adapter.rollbackFull(serviceId, targetVersion);
      } else if (pca.toolName === "run_synthetic_checkout") {
        output = await adapter.runSyntheticCheckout();
      } else {
        throw new Error(`Unsupported action execution tool: '${pca.toolName}'`);
      }

      const durationMs = Date.now() - startTime;

      // Record successful technical execution
      executionAuthorizer.recordExecutionResult(id, claim.executionToken, {
        exitCode: 0,
        durationMs,
        rawOutputExcerpt: JSON.stringify(output),
      });

      const executedAction = actionRepo.getActionById(id);

      return {
        data: {
          executed: true,
          action: executedAction,
          executionToken: claim.executionToken,
          durationMs,
          output,
          note: "Technical tool execution succeeded. Verification probe required to verify recovery.",
        },
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      executionAuthorizer.recordExecutionResult(id, claim.executionToken, {
        exitCode: 1,
        durationMs,
        errorMessage: err.message || String(err),
      });

      const failedAction = actionRepo.getActionById(id);

      return reply.status(500).send({
        error: {
          message: `Tool execution failed: ${err.message}`,
          action: failedAction,
          durationMs,
        },
      });
    }
  });
};

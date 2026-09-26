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
import { type TargetEnvironment, getControlPlaneDb } from "@runsafe/shared";

export const actionRoutes: FastifyPluginAsync = async (app) => {
  const actionRepo = new ActionRepository();
  const safetyKernel = new SafetyKernel();
  const approvalService = new ApprovalService();
  const executionAuthorizer = new ExecutionAuthorizer();
  const runbookRepo = new RunbookRepository();

  // List all pending approval requests with associated Proof-Carrying Action
  app.get("/api/v1/approvals/pending", async (_request, reply) => {
    const db = getControlPlaneDb();
    const rows = db.prepare(`
      SELECT 
        ar.id as approval_id,
        ar.action_id,
        ar.payload_hash,
        ar.status as approval_status,
        ar.created_at as approval_created_at,
        ar.expires_at,
        pca.incident_id,
        pca.contract_id,
        pca.step_id,
        pca.tool_name,
        pca.tool_arguments,
        pca.justification_summary,
        pca.confidence_score,
        pca.risk_tier,
        pca.blast_radius,
        pca.is_reversible,
        pca.status as action_status,
        pca.created_at as action_created_at
      FROM approval_requests ar
      JOIN proof_carrying_actions pca ON ar.action_id = pca.id
      WHERE ar.status = 'PENDING'
      ORDER BY ar.created_at DESC
      LIMIT 100
    `).all() as any[];

    const approvals = rows.map((r) => {
      let blastRadius = { targetEnvironment: "LOCAL", affectedServices: ["checkout-service"] };
      try {
        blastRadius = typeof r.blast_radius === "string" ? JSON.parse(r.blast_radius) : r.blast_radius;
      } catch {}

      let toolArguments = {};
      try {
        toolArguments = typeof r.tool_arguments === "string" ? JSON.parse(r.tool_arguments) : r.tool_arguments;
      } catch {}

      return {
        id: r.action_id,
        actionId: r.action_id,
        approvalId: r.approval_id,
        incidentId: r.incident_id,
        contractId: r.contract_id,
        stepId: r.step_id,
        toolName: r.tool_name,
        toolArguments,
        justificationSummary: r.justification_summary,
        confidenceScore: r.confidence_score,
        riskTier: r.risk_tier,
        isReversible: Boolean(r.is_reversible),
        blastRadius,
        payloadHash: r.payload_hash,
        status: r.approval_status,
        actionStatus: r.action_status,
        expiresAt: r.expires_at,
        createdAt: r.approval_created_at,
      };
    });

    return reply.status(200).send({
      count: approvals.length,
      approvals,
    });
  });

  // List actions with optional filters
  app.get("/api/v1/actions", async (request) => {
    const query = request.query as any;
    const db = getControlPlaneDb();
    let sql = "SELECT * FROM proof_carrying_actions WHERE 1=1";
    const params: any[] = [];
    if (query?.status) {
      sql += " AND status = ?";
      params.push(query.status);
    }
    if (query?.incidentId) {
      sql += " AND incident_id = ?";
      params.push(query.incidentId);
    }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(query?.limit ? parseInt(query.limit, 10) : 50);

    const rows = db.prepare(sql).all(...params) as any[];
    return {
      count: rows.length,
      actions: rows.map((r) => ({
        id: r.id,
        incidentId: r.incident_id,
        contractId: r.contract_id,
        stepId: r.step_id,
        toolName: r.tool_name,
        riskTier: r.risk_tier,
        payloadHash: r.payload_hash,
        status: r.status,
        createdAt: r.created_at,
      })),
    };
  });

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

    return reply.status(201).send({ data: pca, action: pca });
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
      action: pca,
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
      decision: z.enum(["APPROVE", "REJECT", "APPROVED", "REJECTED"]),
      operatorId: z.string().optional(),
      approvedBy: z.string().optional(),
      payloadHash: z.string().min(1),
      operatorNote: z.string().optional(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { message: "Invalid approval payload", details: parsed.error.issues },
      });
    }

    const { decision: rawDecision, payloadHash, operatorNote } = parsed.data;
    const operatorId = parsed.data.operatorId || parsed.data.approvedBy || "operator-ui";
    const decision = (rawDecision === "APPROVED" || rawDecision === "APPROVE") ? "APPROVE" : "REJECT";

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
      success: true,
      action: updatedAction,
      approval: updatedApproval,
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

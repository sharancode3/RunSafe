import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  incidentRepository,
  recoveryOrchestrator,
  IncidentStatusSchema,
} from "@runsafe/recovery-engine";
import { verificationRepository, independentVerifier } from "@runsafe/verifier";
import { runbookRepository, type RecoveryContract } from "@runsafe/runbooks";
import { getInfrastructureAdapter } from "@runsafe/infrastructure-adapter";
import { TargetEnvironment, TargetEnvironmentSchema } from "@runsafe/shared";

const CreateIncidentBody = z.object({
  title: z.string().min(1),
  targetService: z.string().min(1),
  environment: TargetEnvironmentSchema.default("LOCAL"),
  activeContractId: z.string().optional(),
});

const ApprovalResumeBody = z.object({
  actionId: z.string().min(1),
  payloadHash: z.string().min(1),
  operatorId: z.string().min(1),
  operatorNote: z.string().optional(),
});

const VerifyStepBody = z.object({
  contractStepId: z.string().optional(),
});

export async function incidentRoutes(app: FastifyInstance) {
  // 1. Create Incident
  app.post("/api/v1/incidents", async (req: FastifyRequest, reply: FastifyReply) => {
    const parseResult = CreateIncidentBody.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "INVALID_REQUEST",
        details: parseResult.error.errors,
      });
    }

    const { title, targetService, environment, activeContractId } = parseResult.data;

    // If activeContractId not explicitly provided, look up active contract for service
    let contractId = activeContractId;
    if (!contractId) {
      const active = runbookRepository.getActiveContract(targetService);
      if (active) {
        contractId = active.id;
      }
    }

    const incident = incidentRepository.createIncident({
      title,
      targetService,
      environment,
      activeContractId: contractId,
    });

    return reply.status(201).send({ incident });
  });

  // 2. List Incidents
  app.get("/api/v1/incidents", async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { status?: string; targetService?: string };
    const incidents = incidentRepository.listIncidents({
      status: query.status as any,
      targetService: query.targetService,
    });
    return reply.send({ incidents });
  });

  // 3. Get Incident Details
  app.get("/api/v1/incidents/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const incident = incidentRepository.getIncident(req.params.id);
    if (!incident) {
      return reply.status(404).send({ error: "INCIDENT_NOT_FOUND", message: `Incident '${req.params.id}' not found` });
    }

    let contract: RecoveryContract | null = null;
    if (incident.active_contract_id) {
      const contractRec = runbookRepository.getContract(incident.active_contract_id);
      if (contractRec) {
        contract = JSON.parse(contractRec.contract_payload);
      }
    }

    return reply.send({
      incident,
      contractSummary: contract
        ? {
            id: contract.id,
            title: contract.title,
            stepsCount: contract.steps.length,
            entryStepId: contract.entryStepId,
          }
        : null,
    });
  });

  // 4. Get Incident Chronological Event Trail
  app.get("/api/v1/incidents/:id/events", async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const incident = incidentRepository.getIncident(req.params.id);
    if (!incident) {
      return reply.status(404).send({ error: "INCIDENT_NOT_FOUND" });
    }

    const events = incidentRepository.getEvents(req.params.id);
    return reply.send({ incidentId: req.params.id, events });
  });

  // 5. Execute Next Step in Recovery Orchestrator
  app.post("/api/v1/incidents/:id/step", async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const incident = incidentRepository.getIncident(req.params.id);
    if (!incident) {
      return reply.status(404).send({ error: "INCIDENT_NOT_FOUND" });
    }

    try {
      const result = await recoveryOrchestrator.executeNextStep(req.params.id);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({
        error: "STEP_EXECUTION_FAILED",
        message: err.message,
      });
    }
  });

  // 6. Submit Approval and Resume Execution
  app.post("/api/v1/incidents/:id/approval", async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const parseResult = ApprovalResumeBody.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "INVALID_REQUEST",
        details: parseResult.error.errors,
      });
    }

    const { actionId, payloadHash, operatorId, operatorNote } = parseResult.data;

    try {
      const result = await recoveryOrchestrator.resumeWithApproval(req.params.id, actionId, {
        approvedBy: operatorId,
        payloadHash,
        operatorNote,
      });
      return reply.send(result);
    } catch (err: any) {
      const statusCode = err.message.includes("FINGERPRINT_MISMATCH") ? 422 : 500;
      return reply.status(statusCode).send({
        error: "APPROVAL_RESUME_FAILED",
        message: err.message,
      });
    }
  });

  // 7. On-Demand Independent Verification Probe Run
  app.post("/api/v1/incidents/:id/verify", async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const incident = incidentRepository.getIncident(req.params.id);
    if (!incident) {
      return reply.status(404).send({ error: "INCIDENT_NOT_FOUND" });
    }

    if (!incident.active_contract_id) {
      return reply.status(400).send({ error: "NO_ACTIVE_CONTRACT" });
    }

    const contractRec = runbookRepository.getContract(incident.active_contract_id);
    if (!contractRec) {
      return reply.status(404).send({ error: "CONTRACT_NOT_FOUND" });
    }

    const contract: RecoveryContract = JSON.parse(contractRec.contract_payload);
    const body = VerifyStepBody.parse(req.body || {});
    const stepId = body.contractStepId || incident.current_step_id || contract.entryStepId;

    const step = contract.steps.find((s) => s.id === stepId);
    if (!step) {
      return reply.status(404).send({ error: "STEP_NOT_FOUND", message: `Step '${stepId}' not found` });
    }

    const adapter = getInfrastructureAdapter(incident.environment as TargetEnvironment);
    const result = await independentVerifier.verifyStep({
      incidentId: incident.id,
      contractStepId: step.id,
      successCriteria: step.successCriteria,
      adapter,
    });

    return reply.send({ verificationResult: result });
  });

  // 8. List Verification Runs for Incident
  app.get("/api/v1/incidents/:id/verifications", async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const runs = verificationRepository.getRunsForIncident(req.params.id);
    return reply.send({ incidentId: req.params.id, verificationRuns: runs });
  });

  // 9. Real-Time SSE Stream of Incident Events
  app.get("/api/v1/incidents/:id/stream", async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const incidentId = req.params.id;
    const incident = incidentRepository.getIncident(incidentId);
    if (!incident) {
      return reply.status(404).send({ error: "INCIDENT_NOT_FOUND" });
    }

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.flushHeaders();

    // Send initial events
    const initialEvents = incidentRepository.getEvents(incidentId);
    for (const ev of initialEvents) {
      reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);
    }

    let lastCount = initialEvents.length;
    const interval = setInterval(() => {
      try {
        const currentEvents = incidentRepository.getEvents(incidentId);
        if (currentEvents.length > lastCount) {
          const newEvents = currentEvents.slice(lastCount);
          for (const ev of newEvents) {
            reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);
          }
          lastCount = currentEvents.length;
        }

        // Close stream if incident is in terminal state
        const inc = incidentRepository.getIncident(incidentId);
        if (
          inc &&
          (inc.status === "VERIFIED_RECOVERY" || inc.status === "ESCALATED" || inc.status === "ABSTAINED")
        ) {
          reply.raw.write(`event: done\ndata: ${JSON.stringify({ status: inc.status })}\n\n`);
          clearInterval(interval);
          reply.raw.end();
        }
      } catch {
        clearInterval(interval);
      }
    }, 500);

    req.raw.on("close", () => {
      clearInterval(interval);
    });
  });
}

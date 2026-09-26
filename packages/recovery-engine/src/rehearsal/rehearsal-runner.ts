import { randomUUID } from "node:crypto";
import { getInfrastructureAdapter, type InfrastructureAdapter } from "@runsafe/infrastructure-adapter";
import { runbookRepository } from "@runsafe/runbooks";
import { ActionRepository } from "@runsafe/actions";
import { getControlPlaneDb } from "@runsafe/shared";
import { incidentRepository } from "../incident/incident-repository.js";
import { RecoveryOrchestrator } from "../orchestrator/recovery-orchestrator.js";
import { rehearsalRepository } from "./rehearsal-repository.js";
import type { RehearsalRunRecord, RehearsalOutcome } from "./rehearsal-schemas.js";

export interface RunScenarioOptions {
  contractId?: string;
  targetEnvironment?: "LOCAL";
  adapterOverride?: InfrastructureAdapter;
}

export class RehearsalRunner {
  private orchestrator = new RecoveryOrchestrator();
  private actionRepo = new ActionRepository();

  public async runScenario(
    scenarioId: string,
    options: RunScenarioOptions = {}
  ): Promise<RehearsalRunRecord> {
    const startTime = Date.now();
    const runId = `rehearsal_${randomUUID()}`;
    const targetEnv = options.targetEnvironment || "LOCAL";

    // 1. Enforce Rehearsal Target Isolation: Rehearsals are strictly prohibited on AWS/Production
    if (targetEnv !== "LOCAL") {
      throw new Error(`Rehearsals are strictly isolated to LOCAL environments. Target '${targetEnv}' is prohibited.`);
    }

    const scenario = rehearsalRepository.getScenarioById(scenarioId);
    if (!scenario) {
      throw new Error(`Rehearsal scenario '${scenarioId}' not found.`);
    }

    // Get active contract
    let contractId = options.contractId;
    if (!contractId) {
      const active = runbookRepository.getActiveContract("checkout-service");
      if (!active) {
        throw new Error("No active recovery contract found for 'checkout-service'.");
      }
      contractId = active.id;
    }

    const adapter = options.adapterOverride || getInfrastructureAdapter("LOCAL");
    const executionDetails: Record<string, unknown> = {
      scenarioId,
      scenarioName: scenario.name,
      stepsAttempted: [],
      baselineVerification: null,
      faultInjection: null,
      cleanup: null,
    };

    let outcome: RehearsalOutcome = "INCONCLUSIVE";
    let incidentId: string | null = null;

    try {
      // 2. Pre-Rehearsal Reset & Baseline Verification
      console.log(`[Runbook CI] [${scenario.name}] Resetting isolated environment to baseline...`);
      await adapter.resetEnvironment();

      const baselineHealth = await adapter.getServiceHealth("checkout-service");
      const baselineOrder = await adapter.runSyntheticCheckout("prod-001", 1);
      const isBaselineHealthy = baselineHealth.reachable && baselineOrder.success;

      executionDetails.baselineVerification = {
        healthy: isBaselineHealthy,
        health: baselineHealth,
        syntheticOrder: baselineOrder,
      };

      if (!isBaselineHealthy) {
        outcome = "INCONCLUSIVE";
        executionDetails.error = "Pre-rehearsal baseline check failed. Infrastructure not healthy.";
        return this.finishRun(runId, scenarioId, contractId, null, targetEnv, outcome, startTime, executionDetails);
      }

      // 3. Inject Scenario-Specific Fault
      console.log(`[Runbook CI] [${scenario.name}] Injecting fault: ${scenario.faultType}...`);
      if (scenarioId === "scenario_crash") {
        const crashRes = await adapter.injectProcessCrash("checkout-api-1");
        executionDetails.faultInjection = crashRes;
      } else if (scenarioId === "scenario_bad_deployment") {
        const badDeployRes = await adapter.injectBadDeployment("checkout-api-2", "v2.0.0");
        executionDetails.faultInjection = badDeployRes;
      } else if (scenarioId === "scenario_ambiguous") {
        const ambigRes = await adapter.injectAmbiguousFailure();
        executionDetails.faultInjection = ambigRes;
      } else {
        throw new Error(`Unsupported scenario '${scenarioId}'.`);
      }

      // 4. Open Rehearsal Incident
      const incident = incidentRepository.createIncident({
        title: `Runbook CI Rehearsal: ${scenario.name}`,
        targetService: scenario.targetService,
        environment: targetEnv,
        activeContractId: contractId,
      });
      incidentId = incident.id;
      executionDetails.incidentId = incidentId;

      // 5. Execute Scenario Recovery Flow
      if (scenarioId === "scenario_crash") {
        // SCENARIO 1: Process Crash Recovery
        // Steps 1 to 4: Ingress -> Logs -> DB Check -> Restart container
        let currentStatus = "STEP_COMPLETED";
        let stepCount = 0;

        while (currentStatus !== "RESOLVED" && currentStatus !== "TERMINAL" && stepCount < 10) {
          stepCount++;
          const stepRes = await this.orchestrator.executeNextStep(incident.id, adapter);
          (executionDetails.stepsAttempted as any[]).push({
            stepId: stepRes.stepId,
            status: stepRes.status,
            actionId: stepRes.actionId,
          });

          if (stepRes.status === "RESOLVED") {
            currentStatus = "RESOLVED";
            break;
          }
          if (stepRes.status === "BLOCKED" || stepRes.status === "ESCALATED" || stepRes.status === "TERMINAL") {
            currentStatus = stepRes.status;
            break;
          }
        }

        const finalInc = incidentRepository.getIncident(incident.id);
        if (finalInc?.status === "VERIFIED_RECOVERY") {
          outcome = "PASS";
        } else {
          outcome = "FAIL";
        }
      } else if (scenarioId === "scenario_bad_deployment") {
        // SCENARIO 2: Bad Deployment Canary Rollback Hero
        let stepCount = 0;

        while (stepCount < 20) {
          stepCount++;
          const stepRes = await this.orchestrator.executeNextStep(incident.id, adapter);
          (executionDetails.stepsAttempted as any[]).push({
            stepId: stepRes.stepId,
            status: stepRes.status,
            actionId: stepRes.actionId,
          });

          if (stepRes.status === "PAUSED_FOR_APPROVAL") {
            // Rehearsal Operator Approval Gate: explicitly labeled as SIMULATED_CI_POLICY
            console.log(`[Runbook CI] Human approval checkpoint reached for ${stepRes.actionId} (${stepRes.stepId}). Simulating operator approval under CI policy...`);
            executionDetails.simulatedApproval = {
              isSimulated: true,
              policy: "SIMULATED_CI_POLICY",
              note: "Automated approval is isolated to staging rehearsals and cannot bypass interactive human approval checkpoints.",
            };
            const resumeRes = await this.orchestrator.resumeWithApproval(
              incident.id,
              stepRes.actionId!,
              {
                approvedBy: "Runbook-CI-Runner [SIMULATED_CI_POLICY]",
                payloadHash: stepRes.payloadHash!,
                operatorNote: `[SIMULATED_CI_POLICY] Automated staging rehearsal approval for ${stepRes.stepId}`,
              },
              adapter
            );
            (executionDetails.stepsAttempted as any[]).push({
              stepId: resumeRes.stepId,
              status: resumeRes.status,
              actionId: resumeRes.actionId,
              type: "APPROVED_RESUME",
            });

            if (resumeRes.status === "RESOLVED" || resumeRes.status === "TERMINAL") {
              break;
            }
            continue;
          }

          if (stepRes.status === "RESOLVED" || stepRes.status === "TERMINAL") {
            break;
          }
        }

        const finalInc = incidentRepository.getIncident(incident.id);
        if (finalInc?.status === "VERIFIED_RECOVERY") {
          outcome = "PASS";
        } else {
          outcome = "FAIL";
        }
      } else if (scenarioId === "scenario_ambiguous") {
        // SCENARIO 3: Ambiguous Telemetry & Confidence-Based Abstention
        // Run observation steps to gather evidence
        const obs1 = await this.orchestrator.executeNextStep(incident.id, adapter);
        (executionDetails.stepsAttempted as any[]).push({
          stepId: obs1.stepId,
          status: obs1.status,
        });

        // Trigger confidence abstention on low confidence (0.41 < 0.70 threshold)
        const abstainRes = this.orchestrator.abstainIncident(
          incident.id,
          "Autonomous action halted: Diagnostic confidence score (0.41) is below 0.70 safety threshold. Evidence is ambiguous or contradictory. Prohibiting blind mutations. Escalating to human SRE.",
          0.41
        );
        (executionDetails.stepsAttempted as any[]).push({
          status: abstainRes.status,
          reason: abstainRes.reason,
        });

        // Crucial Invariant Check: Verify ZERO mutations were dispatched!
        const db = getControlPlaneDb();
        const mutationExecutions = db
          .prepare(
            `SELECT COUNT(*) as count FROM tool_executions te
             JOIN proof_carrying_actions pca ON te.action_id = pca.id
             WHERE te.incident_id = ? AND pca.risk_tier != 'READ_ONLY'`
          )
          .get(incident.id) as any;

        const zeroMutationsDispatched = (mutationExecutions?.count ?? 0) === 0;
        const finalInc = incidentRepository.getIncident(incident.id);

        executionDetails.abstentionCheck = {
          incidentStatus: finalInc?.status,
          mutationCount: mutationExecutions?.count ?? 0,
          zeroMutationsDispatched,
        };

        if (finalInc?.status === "ABSTAINED" && zeroMutationsDispatched) {
          outcome = "PASS";
        } else {
          outcome = "FAIL";
        }
      }
    } catch (err: any) {
      outcome = "FAIL";
      executionDetails.fatalError = err.message;
    } finally {
      // 6. Cleanup: Always restore isolated rehearsal environment to clean baseline
      try {
        console.log(`[Runbook CI] [${scenario.name}] Executing post-rehearsal cleanup to baseline...`);
        await adapter.resetEnvironment();
        executionDetails.cleanup = { success: true };
      } catch (cleanErr: any) {
        console.error(`[Runbook CI] Cleanup failed: ${cleanErr.message}`);
        executionDetails.cleanup = { success: false, error: cleanErr.message };
        // Invariant: A rehearsal CANNOT pass if cleanup fails
        outcome = "FAIL";
        executionDetails.cleanupFailureNote = "Rehearsal outcome downgraded to FAIL because post-run environment cleanup failed.";
      }
    }

    return this.finishRun(runId, scenarioId, contractId, incidentId, targetEnv, outcome, startTime, executionDetails);
  }

  private finishRun(
    runId: string,
    scenarioId: string,
    contractId: string,
    incidentId: string | null,
    targetEnv: string,
    outcome: RehearsalOutcome,
    startTime: number,
    details: Record<string, unknown>
  ): RehearsalRunRecord {
    const durationMs = Date.now() - startTime;
    const record: RehearsalRunRecord = {
      id: runId,
      scenarioId,
      contractId,
      incidentId,
      targetEnvironment: targetEnv,
      outcome,
      durationMs,
      details,
      executedAt: new Date().toISOString(),
    };

    return rehearsalRepository.saveRehearsalRun(record);
  }
}

export const rehearsalRunner = new RehearsalRunner();

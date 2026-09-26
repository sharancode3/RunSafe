import { describe, it, expect, beforeAll } from "vitest";
import { SafetyKernel } from "@runsafe/safety-kernel";
import { buildProofCarryingAction, ActionRepository } from "@runsafe/actions";
import { runbookRepository, compileRunbook } from "@runsafe/runbooks";
import {
  RecoveryOrchestrator,
  incidentRepository,
} from "@runsafe/recovery-engine";
import { getControlPlaneDb } from "@runsafe/shared";
import fs from "fs";
import path from "path";

describe("Confidence-Based Abstention & Safety Gate (FR-033, TR-011)", () => {
  let contractId: string;
  const safetyKernel = new SafetyKernel();
  const orchestrator = new RecoveryOrchestrator();

  beforeAll(async () => {
    const runbookPath = path.join(process.cwd(), "runbooks", "checkout_recovery_runbook.md");
    const markdown = fs.readFileSync(runbookPath, "utf-8");
    const compiled = await compileRunbook(markdown, {
      runbookId: "rb_abstention_test",
      version: "v1.0.0",
      targetService: "checkout-service",
    });
    if (!compiled.contract) {
      throw new Error("Failed to compile contract");
    }
    runbookRepository.activateContract(compiled.contract.id);
    contractId = compiled.contract.id;
  });

  it("should BLOCK actions when confidence score is below 0.70 threshold", () => {
    const contract = JSON.parse(runbookRepository.getContract(contractId)!.contract_payload);
    const step = contract.steps.find((s: any) => s.id === "STEP_4_RESTART_REPLICA")!;

    // Action with confidence 0.45 (< 0.70)
    const lowConfAction = buildProofCarryingAction(
      {
        incidentId: "inc_low_conf_test",
        contractId,
        stepId: step.id,
        toolName: step.toolName,
        toolArguments: step.defaultArguments,
        justificationSummary: "Low confidence test action",
        confidenceScore: 0.45,
        supportingEvidenceIds: ["ev_dummy"],
      },
      step
    );

    const decision = safetyKernel.evaluateAction(lowConfAction);
    expect(decision.policyDecision).toBe("BLOCKED");
    expect(decision.reasonCode).toBe("CONFIDENCE_BELOW_THRESHOLD");
    expect(decision.matchedRule).toBe("RULE_CONFIDENCE_THRESHOLD_GATE");
  });

  it("should trigger incident abstention and dispatch ZERO mutations on ambiguous signals", async () => {
    const inc = incidentRepository.createIncident({
      title: "Ambiguous Outage Test",
      targetService: "checkout-service",
      environment: "LOCAL",
      activeContractId: contractId,
    });

    const result = orchestrator.abstainIncident(
      inc.id,
      "Confidence 0.41 is below 0.70 threshold. Root cause is ambiguous. Prohibiting blind mutations. Escalating to human SRE.",
      0.41
    );

    expect(result.status).toBe("ABSTAINED");

    const updated = incidentRepository.getIncident(inc.id);
    expect(updated?.status).toBe("ABSTAINED");

    // Verify events recorded INCIDENT_ABSTAINED
    const events = incidentRepository.getEvents(inc.id);
    const abstainEvent = events.find((e) => e.event_type === "INCIDENT_ABSTAINED");
    expect(abstainEvent).toBeDefined();
    expect(abstainEvent?.payload).toHaveProperty("confidenceScore", 0.41);
    expect(abstainEvent?.payload).toHaveProperty("threshold", 0.70);

    // Verify ZERO mutations were dispatched
    const db = getControlPlaneDb();
    const count = (
      db.prepare(
        `SELECT COUNT(*) as cnt FROM tool_executions te
         JOIN proof_carrying_actions pca ON te.action_id = pca.id
         WHERE te.incident_id = ? AND pca.risk_tier != 'READ_ONLY'`
      ).get(inc.id) as any
    )?.cnt;

    expect(count).toBe(0);
  });
});

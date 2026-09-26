import { TrueForgeClient } from "@runsafe/trueforge-client";
import type { EvidenceRecord, Hypothesis } from "../schemas.js";
import { validateHypothesis } from "./hypothesis-validator.js";
import { evidenceRepository } from "../repository/evidence-repository.js";

export interface FormulateHypothesisOptions {
  contextId: string;
  evidenceList: EvidenceRecord[];
  useTrueForgeAgent?: boolean;
  agentName?: string;
}

export async function formulateHypothesis(
  options: FormulateHypothesisOptions
): Promise<Hypothesis> {
  const evidenceMap = new Map(options.evidenceList.map((e) => [e.id, e]));
  const existingIds = Array.from(evidenceMap.keys());

  let statement = "Automated root cause analysis: ";
  const supportingIds: string[] = [];
  const contradictingIds: string[] = [];

  // Identify supporting anomalies
  for (const ev of options.evidenceList) {
    if (ev.evidenceType === "SANDBOX_ANALYSIS") {
      supportingIds.push(ev.id);
      statement += `Sandboxed log parser identified ${((ev.structuredValue as any)?.rootCauseSuspect || "anomaly")}. `;
    } else if (ev.evidenceType === "SYNTHETIC_CHECKOUT") {
      const success = (ev.structuredValue as any)?.success;
      if (!success) {
        supportingIds.push(ev.id);
        statement += "Synthetic business transactions are failing against database. ";
      }
    } else if (ev.evidenceType === "SERVICE_HEALTH") {
      const status = (ev.structuredValue as any)?.status;
      if (status === "healthy") {
        contradictingIds.push(ev.id);
      }
    }
  }

  // Fallback to citing any observation evidence if none selected
  if (supportingIds.length === 0 && options.evidenceList.length > 0) {
    supportingIds.push(options.evidenceList[0].id);
    statement += options.evidenceList[0].summary;
  }

  const hypothesis: Hypothesis = {
    id: `hyp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    contextId: options.contextId,
    statement: statement.trim(),
    supportingEvidenceIds: supportingIds,
    contradictingEvidenceIds: contradictingIds,
    missingEvidenceTypes: [],
    evidenceStrength: supportingIds.length >= 2 ? "HIGH" : "MEDIUM",
    modelProvider: options.useTrueForgeAgent ? "trueforge/openai" : "deterministic/local",
    createdAt: new Date().toISOString(),
  };

  // Deterministic validation gate
  const validation = validateHypothesis(hypothesis, existingIds);
  if (!validation.valid) {
    throw new Error(
      `Hypothesis formulation failed deterministic validation: ${validation.errors.join("; ")}`
    );
  }

  evidenceRepository.saveHypothesis(hypothesis);
  return hypothesis;
}

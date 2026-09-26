import { z } from "zod";

export const RehearsalOutcomeSchema = z.enum(["PASS", "FAIL", "INCONCLUSIVE"]);
export type RehearsalOutcome = z.infer<typeof RehearsalOutcomeSchema>;

export const RehearsalScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  targetService: z.string().min(1),
  faultType: z.string().min(1),
  expectedRecoveryTool: z.string().min(1),
  expectedOutcome: RehearsalOutcomeSchema.default("PASS"),
});
export type RehearsalScenario = z.infer<typeof RehearsalScenarioSchema>;

export const RehearsalRunRecordSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  contractId: z.string().min(1),
  incidentId: z.string().nullable().optional(),
  targetEnvironment: z.string().default("LOCAL"),
  outcome: RehearsalOutcomeSchema,
  durationMs: z.number().int().nonnegative().default(0),
  details: z.record(z.unknown()).default({}),
  executedAt: z.string().default(() => new Date().toISOString()),
});
export type RehearsalRunRecord = z.infer<typeof RehearsalRunRecordSchema>;

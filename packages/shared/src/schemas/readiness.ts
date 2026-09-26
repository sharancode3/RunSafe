import { z } from "zod";

export const ComponentStateSchema = z.enum(["READY", "NOT_READY", "BLOCKED", "UNKNOWN"]);
export type ComponentState = z.infer<typeof ComponentStateSchema>;

export const ComponentReportSchema = z.object({
  state: ComponentStateSchema,
  message: z.string(),
  lastChecked: z.string().datetime(),
  details: z.record(z.unknown()).optional(),
});
export type ComponentReport = z.infer<typeof ComponentReportSchema>;

export const ReadinessReportSchema = z.object({
  overall: ComponentStateSchema,
  timestamp: z.string().datetime(),
  components: z.object({
    controlPlane: ComponentReportSchema,
    trueForge: ComponentReportSchema,
    primaryModel: ComponentReportSchema,
    runSafeAgent: ComponentReportSchema,
    mcpServer: ComponentReportSchema,
    toolExecution: ComponentReportSchema,
    sandbox: ComponentReportSchema,
    approvalCheckpoint: ComponentReportSchema,
    programmaticIntegration: ComponentReportSchema,
  }),
});
export type ReadinessReport = z.infer<typeof ReadinessReportSchema>;

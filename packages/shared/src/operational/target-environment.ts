import { z } from "zod";

export const TargetEnvironmentSchema = z.enum(["LOCAL", "AWS"]);
export type TargetEnvironment = z.infer<typeof TargetEnvironmentSchema>;

export const CapabilityModeSchema = z.enum(["RECOVERY", "REHEARSAL", "TEST"]);
export type CapabilityMode = z.infer<typeof CapabilityModeSchema>;

import { z } from "zod";

/**
 * Validated schema for input to the harmless development-only gated tool.
 * Gated by TrueForge human approval checkpoint in Stage 1.
 */
export const GuardedNoopInputSchema = z.object({
  actionId: z.string().min(1, "Action ID is required"),
  reason: z.string().optional(),
});

export type GuardedNoopInput = z.infer<typeof GuardedNoopInputSchema>;

/**
 * Validated schema for output from the harmless development-only gated tool.
 */
export const GuardedNoopOutputSchema = z.object({
  executed: z.literal(true),
  actionId: z.string(),
  executionCount: z.number().int().positive(),
  timestamp: z.string().datetime(),
  note: z.string(),
});

export type GuardedNoopOutput = z.infer<typeof GuardedNoopOutputSchema>;

import { HypothesisSchema, type Hypothesis } from "../schemas.js";

export interface HypothesisValidationResult {
  valid: boolean;
  errors: string[];
  hypothesis?: Hypothesis;
}

export function validateHypothesis(
  input: unknown,
  existingEvidenceIds: string[] | Set<string>
): HypothesisValidationResult {
  const parseResult = HypothesisSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      valid: false,
      errors: parseResult.error.issues.map((i) => `Schema error at '${i.path.join(".")}': ${i.message}`),
    };
  }

  const hypothesis = parseResult.data;
  const evidenceSet = existingEvidenceIds instanceof Set ? existingEvidenceIds : new Set(existingEvidenceIds);
  const errors: string[] = [];

  // Check that all supporting evidence IDs exist
  for (const id of hypothesis.supportingEvidenceIds) {
    if (!evidenceSet.has(id)) {
      errors.push(
        `Unverified evidence citation: supportingEvidenceId '${id}' does not exist in the Evidence Engine store. Hypotheses cannot cite phantom or hallucinated evidence.`
      );
    }
  }

  // Check that all contradicting evidence IDs exist
  for (const id of hypothesis.contradictingEvidenceIds) {
    if (!evidenceSet.has(id)) {
      errors.push(
        `Unverified evidence citation: contradictingEvidenceId '${id}' does not exist in the Evidence Engine store. Hypotheses cannot cite phantom or hallucinated evidence.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    hypothesis,
  };
}

import type { RecoveryContract } from "../schemas.js";

const DEFAULT_TERMINAL_STATES = new Set([
  "RESOLVED",
  "ESCALATED",
  "ABSTAINED",
  "COMPLETE",
  "FAILED",
]);

export function validateBranchGraph(contract: RecoveryContract): string[] {
  const errors: string[] = [];
  const stepMap = new Map(contract.steps.map((s) => [s.id, s]));
  const terminalSet = new Set([
    ...DEFAULT_TERMINAL_STATES,
    ...(contract.terminalStates || []),
  ]);

  // 1. Verify entry step exists
  if (!stepMap.has(contract.entryStepId)) {
    errors.push(
      `Branch graph violation: entryStepId '${contract.entryStepId}' does not match any step in the contract.`
    );
  }

  // 2. Verify all step transitions point to valid steps or terminal states
  for (const step of contract.steps) {
    if (!stepMap.has(step.onSuccess) && !terminalSet.has(step.onSuccess)) {
      errors.push(
        `Branch graph violation in step '${step.id}': onSuccess target '${step.onSuccess}' is neither an existing step ID nor a recognized terminal state (${Array.from(terminalSet).join(", ")}).`
      );
    }

    if (!stepMap.has(step.onFailure) && !terminalSet.has(step.onFailure)) {
      errors.push(
        `Branch graph violation in step '${step.id}': onFailure target '${step.onFailure}' is neither an existing step ID nor a recognized terminal state (${Array.from(terminalSet).join(", ")}).`
      );
    }
  }

  // 3. Reachability analysis from entryStepId
  if (stepMap.has(contract.entryStepId)) {
    const reachable = new Set<string>();
    const queue = [contract.entryStepId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (reachable.has(currentId)) continue;
      reachable.add(currentId);

      const step = stepMap.get(currentId);
      if (step) {
        if (stepMap.has(step.onSuccess) && !reachable.has(step.onSuccess)) {
          queue.push(step.onSuccess);
        }
        if (stepMap.has(step.onFailure) && !reachable.has(step.onFailure)) {
          queue.push(step.onFailure);
        }
      }
    }

    for (const step of contract.steps) {
      if (!reachable.has(step.id)) {
        errors.push(
          `Branch graph violation: step '${step.id}' is unreachable from entryStepId '${contract.entryStepId}'. Unreachable dead steps violate contract determinism.`
        );
      }
    }

    // 4. Verify terminal reachability (every step must have a path to a terminal state, avoiding infinite loops)
    for (const step of contract.steps) {
      const visited = new Set<string>();
      let canReachTerminal = false;
      const pathQueue = [step.id];

      while (pathQueue.length > 0) {
        const curr = pathQueue.shift()!;
        if (terminalSet.has(curr)) {
          canReachTerminal = true;
          break;
        }
        if (visited.has(curr)) continue;
        visited.add(curr);

        const st = stepMap.get(curr);
        if (st) {
          pathQueue.push(st.onSuccess);
          pathQueue.push(st.onFailure);
        }
      }

      if (!canReachTerminal) {
        errors.push(
          `Branch graph violation: step '${step.id}' is trapped in a cyclic subgraph with no path to a terminal outcome (${Array.from(terminalSet).join(", ")}).`
        );
      }
    }
  }

  return errors;
}

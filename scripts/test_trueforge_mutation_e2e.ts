import { TrueForgeClient } from "../packages/trueforge-client/src/index.js";
import { getInfrastructureAdapter } from "../packages/infrastructure-adapter/src/index.js";

async function main() {
  console.log("================================================================================");
  console.log(" TRUEFORGE AGENT E2E CONTROLLED MUTATION TEST (RESTART SERVICE)");
  console.log("================================================================================\n");

  const adapter = getInfrastructureAdapter("LOCAL");
  const tf = new TrueForgeClient({ timeoutMs: 60000 });

  // 1. Crash checkout-api-1
  console.log("[1/5] Injecting process crash into 'checkout-api-1'...");
  await adapter.injectProcessCrash("checkout-api-1");
  const preState = await adapter.getServiceHealth("checkout-api-1");
  console.log("      Pre-state reachability:", preState.reachable ? "ALIVE" : "STOPPED/CRASHED");

  // 2. Create TrueForge session
  console.log("[2/5] Creating TrueForge session with 'runsafe-agent'...");
  const session = await tf.createSession("runsafe-agent");
  console.log("      Session ID:", session.id);

  // 3. Dispatch prompt asking agent to restart checkout-api-1
  const prompt =
    "Target replica 'checkout-api-1' has crashed. Call restart_service with environment 'LOCAL', target 'checkout-api-1', and authorizationContext 'test-ctx-stage3'. Report the execution status.";
  console.log(`[3/5] Running agent turn with prompt:\n      \"${prompt}\"...`);

  const turn = await tf.runTurn(session.id, prompt);
  console.log("      Turn ID:", turn.id);

  // 4. Wait for turn completion or approval pause
  console.log("[4/5] Waiting for turn to execute or pause for approval...");
  let result = await tf.waitForTurn(session.id, turn.id, 90000, 2000);

  if (result.approvalRequired) {
    console.log(`\n>>> [HUMAN CHECKPOINT TRIGGERED] TrueForge paused on destructive tool: '${result.approvalRequired.toolName || "restart_service"}'`);
    console.log(`    Thread ID: ${result.approvalRequired.threadId}, Tool Call ID: ${result.approvalRequired.toolCallId}`);
    console.log(">>> [OPERATOR ACTION] Submitting APPROVED decision to TrueForge...");

    const resumedTurn = await tf.resumeApproval(
      session.id,
      result.approvalRequired.threadId,
      result.approvalRequired.toolCallId,
      true
    );

    console.log("    Approval token accepted. Waiting for technical execution...");
    result = await tf.waitForTurn(session.id, resumedTurn.id, 90000, 2000);
  }

  console.log("\n================================================================================");
  console.log(" MUTATION TURN RESULT");
  console.log("================================================================================");
  console.log("Turn Status:", result.turn.state?.status);
  console.log("Output Content:\n", result.turn.state?.output?.content || "(no text output)");

  // 5. Verify actual container state on local Docker
  console.log("\n[5/5] Verifying actual container health on Docker...");
  const postState = await adapter.getServiceHealth("checkout-api-1");
  console.log("      Post-state reachability:", postState.reachable ? "HEALTHY/RESTORED" : "STILL DOWN");
  console.log("      Post-state HTTP status:", postState.httpStatus);

  if (postState.reachable && postState.httpStatus === 200) {
    console.log("\n[SUCCESS] TrueForge agent executed real technical restart via Stage 3 MCP and restored container!");
  } else {
    throw new Error("Container was not restored by restart_service");
  }
}

main().catch((err) => {
  console.error("Mutation E2E test failed:", err);
  process.exit(1);
});

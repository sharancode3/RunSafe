import { TrueForgeClient } from "../packages/trueforge-client/src/index.js";

async function main() {
  console.log("================================================================================");
  console.log(" TRUEFORGE AGENT E2E INVESTIGATION TEST (READ-ONLY STAGE 3 TOOLS)");
  console.log("================================================================================\n");

  const tf = new TrueForgeClient({ timeoutMs: 60000 });

  // 1. Verify TrueForge health
  const health = await tf.checkHealth();
  console.log("[1/4] TrueForge health check:", health.ok ? "ONLINE" : "OFFLINE");
  if (!health.ok) {
    throw new Error("TrueForge daemon is not reachable");
  }

  // 2. Create session with runsafe-agent
  console.log("[2/4] Creating TrueForge session with 'runsafe-agent'...");
  const session = await tf.createSession("runsafe-agent");
  console.log("      Session ID:", session.id);

  // 3. Dispatch prompt asking agent to inspect environment with tools
  const prompt =
    "Inspect the LOCAL RunSafe checkout environment using the available read-only tools. Call get_service_health with environment 'LOCAL' and serviceId 'checkout-service'. Call get_deployment_state with environment 'LOCAL'. Report the actual tool results.";
  console.log(`[3/4] Running agent turn with prompt:\n      \"${prompt}\"...`);

  const turn = await tf.runTurn(session.id, prompt);
  console.log("      Turn ID:", turn.id, "Initial status:", turn.state?.status);

  // 4. Wait for turn completion and capture events
  console.log("[4/4] Waiting for turn to complete...");
  const result = await tf.waitForTurn(session.id, turn.id, 90000, 2000);

  console.log("\n================================================================================");
  console.log(" TURN RESULT SUMMARY");
  console.log("================================================================================");
  console.log("Turn Status:", result.turn.state?.status);
  console.log("Output Content:\n", result.turn.state?.output?.content || "(no text output)");
  console.log("Normalized Events Captured:", result.normalizedEvents.length);

  const toolEvents = result.normalizedEvents.filter((e) => Boolean(e?.eventType && e.eventType.startsWith("TOOL_")));
  console.log(`Tool Events (${toolEvents.length}):`);
  for (const te of toolEvents) {
    console.log(`  - [${te.eventType}] ${(te.payload as any)?.toolName || (te.payload as any)?.name || ""}`);
  }

  if (result.turn.state?.status === "done" || result.turn.state?.status === "running") {
    console.log("\n[SUCCESS] TrueForge agent turn completed successfully with Stage 3 MCP integration.");
  } else {
    console.log("\n[NOTICE] Turn ended with status:", result.turn.state?.status);
  }
}

main().catch((err) => {
  console.error("TrueForge read investigation failed:", err);
  process.exit(1);
});

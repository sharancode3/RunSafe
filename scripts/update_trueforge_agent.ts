import { TrueForgeClient } from "../packages/trueforge-client/src/index.js";

async function main() {
  const tf = new TrueForgeClient();
  const agents = await tf.getAgents();
  console.log("Agents in TrueForge:", agents.map((a) => ({ id: a.id, name: a.name })));

  const runsafeAgent = agents.find((a) => a.name === "runsafe-agent");
  if (!runsafeAgent) {
    throw new Error("runsafe-agent not found in TrueForge list");
  }

  const updatedManifest = {
    ...runsafeAgent.manifest,
    mcp_servers: [
      {
        name: "runsafe-mcp",
        enable_tools: ["@all"],
        disable_tools: [],
        require_approval_for_tools: [
          "stage1_guarded_noop",
          "restart_service",
          "rollback_canary",
          "rollback_full",
          "reset_environment",
        ],
        preload: true,
      },
    ],
  };

  // TrueForge expects PUT /api/v1/agents/{id}
  const res = await (tf as any).request(`/api/v1/agents/${runsafeAgent.id}`, {
    method: "PUT",
    body: JSON.stringify({ manifest: updatedManifest }),
  });

  console.log("[TrueForge] runsafe-agent manifest updated successfully with approval policy on destructive tools.");
}

main().catch((err) => {
  console.error("Failed to update TrueForge agent:", err);
  process.exit(1);
});

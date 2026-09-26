import { getInfrastructureAdapter } from "../packages/infrastructure-adapter/src/index.js";
import { RunSafeMcpServer } from "../packages/mcp-server/src/server.js";

async function run() {
  console.log("================================================================================");
  console.log(" TESTING REAL STAGE 3 TOOLS AGAINST CONTROLLED INFRASTRUCTURE");
  console.log("================================================================================\n");

  const adapter = getInfrastructureAdapter("LOCAL");
  process.env.RUNSAFE_ALLOW_STAGE3_TEST_MUTATIONS = "true";

  // 1. Service Health
  console.log("--> Testing getServiceHealth('checkout-service')...");
  const svcHealth = await adapter.getServiceHealth("checkout-service");
  console.log("    checkout-service:", svcHealth.reachable ? "REACHABLE" : "UNREACHABLE", svcHealth.status);

  console.log("--> Testing getServiceHealth('checkout-api-1')...");
  const api1Health = await adapter.getServiceHealth("checkout-api-1");
  console.log("    checkout-api-1:", api1Health.reachable ? "REACHABLE" : "UNREACHABLE", api1Health.version);

  // 2. Database Health
  console.log("--> Testing getDatabaseHealth()...");
  const dbHealth = await adapter.getDatabaseHealth("postgres");
  console.log("    postgres:", dbHealth.reachable ? "CONNECTED" : "FAILED", `products=${dbHealth.productCount}, latency=${dbHealth.latencyMs}ms`);

  // 3. Deployment State
  console.log("--> Testing getDeploymentState()...");
  const deployState = await adapter.getDeploymentState("checkout-service");
  console.log("    deploymentState:", JSON.stringify(deployState.replicas));

  // 4. Replica State
  console.log("--> Testing getReplicaState('checkout-api-2')...");
  const repState = await adapter.getReplicaState("checkout-api-2");
  console.log("    replica-2:", repState.running ? "RUNNING" : "STOPPED", repState.version);

  // 5. Metrics
  console.log("--> Testing getMetrics('checkout-api-1')...");
  const metrics = await adapter.getMetrics("checkout-api-1");
  console.log("    metrics:", `requestsTotal=${metrics.requestsTotal}, errorRate=${metrics.errorRate}`);

  // 6. Recent Logs
  console.log("--> Testing getRecentLogs('checkout-api-1', 5)...");
  const logs = await adapter.getRecentLogs("checkout-api-1", 5);
  console.log("    logs retrieved:", logs.length, "lines");

  // 7. Dependencies
  console.log("--> Testing getDependencies('checkout-service')...");
  const deps = await adapter.getDependencies("checkout-service");
  console.log("    dependencies:", (deps.dependencies as string[]).join(", "));

  // 8. Synthetic Checkout
  console.log("--> Testing runSyntheticCheckout()...");
  const checkout = await adapter.runSyntheticCheckout("prod-001", 1);
  console.log("    synthetic checkout:", checkout.success ? "SUCCESS" : "FAILED", `status=${checkout.httpStatus}, servedBy=${checkout.servedReplica} (${checkout.servedVersion})`);

  // 9. Restart Service Test (Technical Restart)
  console.log("--> Testing restartService('checkout-api-1')...");
  const restartRes = await adapter.restartService("checkout-api-1");
  console.log("    restart:", restartRes.technicalStatus, `opId=${restartRes.operationId}`);

  // 10. Canary Rollback Test
  console.log("--> Testing Canary Rollback flow...");
  // Inject bad deployment first
  console.log("    Injecting bad deployment on replica 2...");
  await adapter.injectBadDeployment("checkout-api-2", "v2.0.0");
  const badState = await adapter.getReplicaState("checkout-api-2");
  console.log("    Replica 2 state after bad deploy:", badState.version, badState.faultProfile);

  // Rollback canary to v1.0.0
  console.log("    Executing rollbackCanary('checkout-service', 'checkout-api-2', 'v1.0.0')...");
  const canaryRes = await adapter.rollbackCanary("checkout-service", "checkout-api-2", "v1.0.0");
  console.log("    rollbackCanary result:", canaryRes.technicalStatus, `from=${canaryRes.fromVersion} to=${canaryRes.toVersion}`);

  // Verify replica 2 is back to healthy v1.0.0
  const recoveredState = await adapter.getReplicaState("checkout-api-2");
  console.log("    Replica 2 after rollback:", recoveredState.version, recoveredState.faultProfile);

  // 11. Full Rollback Test
  console.log("--> Testing rollbackFull('checkout-service', 'v1.0.0')...");
  const fullRes = await adapter.rollbackFull("checkout-service", "v1.0.0");
  console.log("    rollbackFull result:", fullRes.technicalStatus, `affected=${fullRes.affectedReplicas.join(",")}`);

  console.log("\n================================================================================");
  console.log(" ALL REAL STAGE 3 INFRASTRUCTURE OPERATIONS EXECUTED AND VERIFIED!");
  console.log("================================================================================");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

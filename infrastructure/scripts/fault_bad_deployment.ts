import { execDocker } from "./docker_runner.js";

export async function injectBadDeployment(): Promise<{
  success: boolean;
  version: string;
  replica: string;
  healthStatus: number;
  healthBody: any;
  checkoutStatus: number;
  checkoutBody: any;
}> {
  console.log("[Fault Injection: Bad Deployment] Upgrading checkout-api-2 to v2.0.0 (bad deployment)...");

  try {
    execDocker(
      "docker compose -f infrastructure/workload/docker-compose.yml up -d --no-deps checkout-api-2",
      {
        CHECKOUT_API_2_VERSION: "v2.0.0",
        CHECKOUT_API_2_FAULT: "bad_deployment",
      }
    );

    // Wait for container to be ready
    console.log("[Fault Injection: Bad Deployment] Waiting for container initialization...");
    let ready = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res = await fetch("http://127.0.0.1:8082/health");
        if (res.ok) {
          ready = true;
          break;
        }
      } catch (e) {}
    }

    if (!ready) {
      throw new Error("checkout-api-2 did not become healthy within 20 seconds after upgrade");
    }

    // 1. Verify health endpoint is 200 OK (DB connected, process alive)
    const healthRes = await fetch("http://127.0.0.1:8082/health");
    const healthBody: any = await healthRes.json();

    // 2. Verify version endpoint is v2.0.0
    const verRes = await fetch("http://127.0.0.1:8082/version");
    const verBody: any = await verRes.json();

    // 3. Verify business checkout returns 500
    const checkoutRes = await fetch("http://127.0.0.1:8082/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: "prod-001", quantity: 1 }),
    });
    const checkoutBody: any = await checkoutRes.json();

    const isExpectedFailure =
      checkoutRes.status === 500 &&
      checkoutBody?.success === false &&
      verBody?.version === "v2.0.0" &&
      healthRes.status === 200;

    console.log(
      `[Fault Injection: Bad Deployment] Verified state:\n` +
      `  - Health: HTTP ${healthRes.status} (Status: ${healthBody?.status}, DB: ${healthBody?.db})\n` +
      `  - Version: ${verBody?.version}\n` +
      `  - Checkout: HTTP ${checkoutRes.status} (Error: ${checkoutBody?.error})\n` +
      `  - Hero condition satisfied: ${isExpectedFailure}`
    );

    return {
      success: isExpectedFailure,
      version: verBody?.version || "unknown",
      replica: "checkout-api-2",
      healthStatus: healthRes.status,
      healthBody,
      checkoutStatus: checkoutRes.status,
      checkoutBody,
    };
  } catch (err: any) {
    console.error("[Fault Injection: Bad Deployment] Failed:", err.message);
    throw err;
  }
}

if (process.argv[1]?.endsWith("fault_bad_deployment.ts") || process.argv[1]?.endsWith("fault_bad_deployment.js")) {
  injectBadDeployment()
    .then((res) => {
      console.log(JSON.stringify(res, null, 2));
      process.exitCode = res.success ? 0 : 1;
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

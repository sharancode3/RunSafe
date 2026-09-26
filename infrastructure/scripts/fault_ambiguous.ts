import { execDocker } from "./docker_runner.js";

export async function injectAmbiguousFault(): Promise<{
  success: boolean;
  message: string;
}> {
  console.log("[Fault Injection: Ambiguous Fault] Enabling ambiguous downstream timeout profile on both replicas...");

  try {
    execDocker(
      "docker compose -f infrastructure/workload/docker-compose.yml up -d --no-deps checkout-api-1 checkout-api-2",
      {
        CHECKOUT_API_1_FAULT: "ambiguous",
        CHECKOUT_API_2_FAULT: "ambiguous",
      }
    );

    // Give containers 3 seconds to settle
    await new Promise((r) => setTimeout(r, 3000));

    console.log("[Fault Injection: Ambiguous Fault] Ambiguous fault enabled successfully.");
    return {
      success: true,
      message: "Ambiguous downstream timeouts enabled across all replicas",
    };
  } catch (err: any) {
    console.error("[Fault Injection: Ambiguous Fault] Failed:", err.message);
    return {
      success: false,
      message: err.message || "Failed to inject ambiguous fault",
    };
  }
}

if (process.argv[1]?.endsWith("fault_ambiguous.ts") || process.argv[1]?.endsWith("fault_ambiguous.js")) {
  injectAmbiguousFault()
    .then((res) => {
      console.log(JSON.stringify(res, null, 2));
      process.exitCode = res.success ? 0 : 1;
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

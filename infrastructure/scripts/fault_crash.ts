import { execDocker } from "./docker_runner.js";

export async function injectProcessCrash(
  targetReplica: "checkout-api-1" | "checkout-api-2" = "checkout-api-1"
): Promise<{ success: boolean; target: string; container: string; message: string }> {
  const containerName = `runsafe-${targetReplica}`;
  console.log(`[Fault Injection: Process Crash] Stopping container: ${containerName}...`);

  try {
    execDocker(`docker stop ${containerName}`);

    // Verify it is stopped
    const status = execDocker(`docker inspect --format='{{.State.Status}}' ${containerName}`);
    const isStopped = status === "exited";
    console.log(`[Fault Injection: Process Crash] Container ${containerName} status: ${status} (Stopped: ${isStopped})`);

    return {
      success: isStopped,
      target: targetReplica,
      container: containerName,
      message: `Container ${containerName} stopped successfully. Status: ${status}`,
    };
  } catch (err: any) {
    const message = err.message || "Failed to stop container";
    console.error(`[Fault Injection: Process Crash] Error: ${message}`);
    return {
      success: false,
      target: targetReplica,
      container: containerName,
      message,
    };
  }
}

if (process.argv[1]?.endsWith("fault_crash.ts") || process.argv[1]?.endsWith("fault_crash.js")) {
  const target = (process.argv[2] as any) || "checkout-api-1";
  injectProcessCrash(target)
    .then((res) => {
      console.log(JSON.stringify(res, null, 2));
      process.exitCode = res.success ? 0 : 1;
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

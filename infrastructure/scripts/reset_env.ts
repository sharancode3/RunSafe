import fs from "fs";
import path from "path";
import pg from "pg";
import { execDocker } from "./docker_runner.js";

const { Client } = pg;

export async function resetEnvironment(): Promise<{
  success: boolean;
  message: string;
}> {
  console.log("================================================================================");
  console.log(" [RunSafe Environment Reset] Restoring controlled infrastructure to baseline...");
  console.log("================================================================================");

  const resetSqlPath = path.resolve(process.cwd(), "infrastructure", "workload", "postgres", "reset.sql");
  const trafficLogPath = path.resolve(process.cwd(), "artifacts", "traffic_log.jsonl");

  try {
    // 1. Bring all services up in baseline v1 state
    console.log("[1/5] Ensuring all containers are running at v1.0.0 baseline...");
    execDocker(
      "docker compose -f infrastructure/workload/docker-compose.yml up -d",
      {
        CHECKOUT_API_1_VERSION: "v1.0.0",
        CHECKOUT_API_1_FAULT: "none",
        CHECKOUT_API_2_VERSION: "v1.0.0",
        CHECKOUT_API_2_FAULT: "none",
      }
    );

    // 2. Wait for PostgreSQL readiness
    console.log("[2/5] Waiting for PostgreSQL readiness...");
    let dbReady = false;
    for (let i = 0; i < 20; i++) {
      try {
        const client = new Client({
          connectionString: "postgresql://runsafe:runsafe_secret@127.0.0.1:5432/checkout_db",
          connectionTimeoutMillis: 2000,
        });
        await client.connect();
        await client.query("SELECT 1");
        await client.end();
        dbReady = true;
        break;
      } catch (e) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (!dbReady) {
      throw new Error("PostgreSQL did not become reachable at 127.0.0.1:5432");
    }

    // 3. Execute reset.sql to re-seed deterministic products & truncate test orders
    console.log("[3/5] Executing database reset and reseeding products...");
    const resetSql = fs.readFileSync(resetSqlPath, "utf-8");
    const dbClient = new Client({
      connectionString: "postgresql://runsafe:runsafe_secret@127.0.0.1:5432/checkout_db",
    });
    await dbClient.connect();
    await dbClient.query(resetSql);
    await dbClient.end();
    console.log("      PostgreSQL state reset successfully.");

    // 4. Reset traffic log
    console.log("[4/5] Truncating traffic generator log...");
    if (fs.existsSync(trafficLogPath)) {
      fs.writeFileSync(trafficLogPath, "");
    }

    // 5. Verify all endpoints are responding healthy at v1.0.0
    console.log("[5/5] Polling endpoints for healthy v1.0.0 baseline...");
    let api1Healthy = false;
    let api2Healthy = false;
    let nginxHealthy = false;

    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const nRes = await fetch("http://127.0.0.1:8080/nginx-health").catch(() => null);
        if (nRes && nRes.ok) nginxHealthy = true;

        const a1Res = await fetch("http://127.0.0.1:8081/health").catch(() => null);
        const a1Ver = await fetch("http://127.0.0.1:8081/version").catch(() => null);
        if (a1Res?.ok && a1Ver?.ok) {
          const v: any = await a1Ver.json();
          if (v.version === "v1.0.0") api1Healthy = true;
        }

        const a2Res = await fetch("http://127.0.0.1:8082/health").catch(() => null);
        const a2Ver = await fetch("http://127.0.0.1:8082/version").catch(() => null);
        if (a2Res?.ok && a2Ver?.ok) {
          const v: any = await a2Ver.json();
          if (v.version === "v1.0.0") api2Healthy = true;
        }

        if (nginxHealthy && api1Healthy && api2Healthy) break;
      } catch (e) {}
    }

    if (!nginxHealthy || !api1Healthy || !api2Healthy) {
      throw new Error(
        `Failed to reach healthy baseline: nginx=${nginxHealthy}, api1=${api1Healthy}, api2=${api2Healthy}`
      );
    }

    console.log("================================================================================");
    console.log(" [SUCCESS] RunSafe environment successfully restored to healthy v1.0.0 baseline.");
    console.log("================================================================================");

    return {
      success: true,
      message: "Environment successfully reset to healthy v1.0.0 baseline",
    };
  } catch (err: any) {
    console.error("[RunSafe Environment Reset] FAILED:", err.message);
    throw err;
  }
}

if (process.argv[1]?.endsWith("reset_env.ts") || process.argv[1]?.endsWith("reset_env.js")) {
  resetEnvironment()
    .then((res) => {
      process.exitCode = res.success ? 0 : 1;
    })
    .catch(() => {
      process.exitCode = 1;
    });
}

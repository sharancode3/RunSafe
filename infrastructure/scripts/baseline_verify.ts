import pg from "pg";
import { execDocker } from "./docker_runner.js";

const { Client } = pg;

interface CheckResult {
  category: string;
  item: string;
  status: "PASS" | "FAIL";
  evidence: string;
}

export async function verifyBaseline(): Promise<{
  allPass: boolean;
  results: CheckResult[];
}> {
  console.log("================================================================================");
  console.log(" [RunSafe Baseline Verification] Validating Controlled Infrastructure...");
  console.log("================================================================================");

  const results: CheckResult[] = [];

  function record(category: string, item: string, pass: boolean, evidence: string) {
    const status: "PASS" | "FAIL" = pass ? "PASS" : "FAIL";
    results.push({ category, item, status, evidence });
    const mark = pass ? "✓ PASS" : "✗ FAIL";
    console.log(`[${mark}] ${category.padEnd(18)} :: ${item.padEnd(28)} -> ${evidence}`);
  }

  // 1. Local Docker
  try {
    const psOut = execDocker("docker ps --format '{{.Names}}'");
    const hasPostgres = psOut.includes("runsafe-postgres");
    const hasApi1 = psOut.includes("runsafe-checkout-api-1");
    const hasApi2 = psOut.includes("runsafe-checkout-api-2");
    const hasNginx = psOut.includes("runsafe-nginx");
    const allContainers = hasPostgres && hasApi1 && hasApi2 && hasNginx;
    record(
      "Docker Compose",
      "Container Status",
      allContainers,
      allContainers
        ? "All 4 containers running (postgres, api-1, api-2, nginx)"
        : `Missing containers: ${psOut.trim()}`
    );
  } catch (err: any) {
    record("Docker Compose", "Container Status", false, err.message);
  }

  // 2. Nginx Ingress
  try {
    const res = await fetch("http://127.0.0.1:8080/nginx-health");
    const data: any = await res.json().catch(() => null);
    const pass = res.status === 200 && data?.status === "healthy";
    record("Nginx Ingress", "Ingress Health", pass, `HTTP ${res.status}, status=${data?.status}`);
  } catch (err: any) {
    record("Nginx Ingress", "Ingress Health", false, err.message);
  }

  // 3. PostgreSQL Database
  let dbClient: pg.Client | null = null;
  try {
    dbClient = new Client({
      connectionString: "postgresql://runsafe:runsafe_secret@127.0.0.1:5432/checkout_db",
      connectionTimeoutMillis: 3000,
    });
    await dbClient.connect();

    // Verify products table & seed count
    const prodRes = await dbClient.query("SELECT COUNT(*) AS count FROM products WHERE active = true");
    const count = parseInt(prodRes.rows[0].count, 10);
    const pass = count >= 4;
    record(
      "PostgreSQL",
      "Seed Data & Tables",
      pass,
      `Connected to checkout_db, active products count: ${count}`
    );
  } catch (err: any) {
    record("PostgreSQL", "Seed Data & Tables", false, err.message);
  }

  // 4. API Replica 1
  try {
    const healthRes = await fetch("http://127.0.0.1:8081/health");
    const health: any = await healthRes.json();
    const verRes = await fetch("http://127.0.0.1:8081/version");
    const ver: any = await verRes.json();

    const pass =
      healthRes.status === 200 &&
      health.status === "healthy" &&
      health.db === "connected" &&
      ver.version === "v1.0.0" &&
      ver.replica === "checkout-api-1";

    record(
      "API Replica 1",
      "Health & Version",
      pass,
      `status=${health.status}, db=${health.db}, version=${ver.version}, replica=${ver.replica}`
    );
  } catch (err: any) {
    record("API Replica 1", "Health & Version", false, err.message);
  }

  // 5. API Replica 2
  try {
    const healthRes = await fetch("http://127.0.0.1:8082/health");
    const health: any = await healthRes.json();
    const verRes = await fetch("http://127.0.0.1:8082/version");
    const ver: any = await verRes.json();

    const pass =
      healthRes.status === 200 &&
      health.status === "healthy" &&
      health.db === "connected" &&
      ver.version === "v1.0.0" &&
      ver.replica === "checkout-api-2";

    record(
      "API Replica 2",
      "Health & Version",
      pass,
      `status=${health.status}, db=${health.db}, version=${ver.version}, replica=${ver.replica}`
    );
  } catch (err: any) {
    record("API Replica 2", "Health & Version", false, err.message);
  }

  // 6. Synthetic Checkout via Nginx Ingress
  let createdOrderId: string | undefined;
  try {
    const res = await fetch("http://127.0.0.1:8080/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: "prod-001",
        quantity: 1,
        syntheticRequestId: `verify_req_${Date.now()}`,
      }),
    });
    const data: any = await res.json().catch(() => null);
    const pass = res.status === 200 && data?.success === true && !!data?.orderId;
    if (pass) createdOrderId = data.orderId;
    record(
      "Workload API",
      "Synthetic Checkout (Ingress)",
      pass,
      `HTTP ${res.status}, success=${data?.success}, orderId=${data?.orderId}`
    );
  } catch (err: any) {
    record("Workload API", "Synthetic Checkout (Ingress)", false, err.message);
  }

  // 7. DB Persistence Check
  if (dbClient && createdOrderId) {
    try {
      const orderRes = await dbClient.query("SELECT * FROM orders WHERE id = $1", [createdOrderId]);
      const itemRes = await dbClient.query("SELECT * FROM order_items WHERE order_id = $1", [createdOrderId]);
      const pass = orderRes.rows.length === 1 && itemRes.rows.length === 1 && orderRes.rows[0].status === "COMPLETED";
      record(
        "PostgreSQL",
        "Transaction Persistence",
        pass,
        `Verified order ${createdOrderId} in PostgreSQL with status ${orderRes.rows[0]?.status}`
      );
    } catch (err: any) {
      record("PostgreSQL", "Transaction Persistence", false, err.message);
    }
  }

  if (dbClient) {
    await dbClient.end().catch(() => {});
  }

  // 8. Metrics Endpoint
  try {
    const res = await fetch("http://127.0.0.1:8080/metrics");
    const data: any = await res.json().catch(() => null);
    const pass = res.status === 200 && typeof data?.requestsTotal === "number" && data?.requestsTotal >= 1;
    record(
      "Workload API",
      "Real In-Memory Metrics",
      pass,
      `requestsTotal=${data?.requestsTotal}, checkoutSuccess=${data?.checkoutSuccess}, errorRate=${data?.errorRate}`
    );
  } catch (err: any) {
    record("Workload API", "Real In-Memory Metrics", false, err.message);
  }

  console.log("================================================================================");
  const allPass = results.every((r) => r.status === "PASS");
  console.log(` [RunSafe Baseline Verification] Overall Result: ${allPass ? "PASS" : "FAIL"}`);
  console.log("================================================================================");

  return { allPass, results };
}

if (process.argv[1]?.endsWith("baseline_verify.ts") || process.argv[1]?.endsWith("baseline_verify.js")) {
  verifyBaseline()
    .then(({ allPass }) => {
      process.exitCode = allPass ? 0 : 1;
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

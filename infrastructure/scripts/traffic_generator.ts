import fs from "fs";
import path from "path";
import { TrafficRecordSchema, type TrafficRecord } from "@runsafe/shared";

interface TrafficStats {
  total: number;
  success: number;
  failed: number;
  errorRate: number;
  avgDurationMs: number;
  byVersion: Record<string, { total: number; success: number; failed: number }>;
  byReplica: Record<string, { total: number; success: number; failed: number }>;
}

const PRODUCTS = ["prod-001", "prod-002", "prod-003", "prod-fail"];

export async function runTrafficGenerator(options?: {
  target?: string;
  count?: number;
  delayMs?: number;
  logFile?: string;
  quiet?: boolean;
}): Promise<TrafficStats> {
  const target = options?.target || process.env.WORKLOAD_URL || "http://127.0.0.1:8080";
  const count = options?.count !== undefined ? options.count : 20;
  const delayMs = options?.delayMs !== undefined ? options.delayMs : 150;
  const logFile =
    options?.logFile || path.resolve(process.cwd(), "artifacts", "traffic_log.jsonl");
  const quiet = options?.quiet ?? false;

  const logDir = path.dirname(logFile);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const stats: TrafficStats = {
    total: 0,
    success: 0,
    failed: 0,
    errorRate: 0,
    avgDurationMs: 0,
    byVersion: {},
    byReplica: {},
  };

  let totalDuration = 0;

  if (!quiet) {
    console.log(`[Traffic Generator] Target: ${target}, Count: ${count}, Interval: ${delayMs}ms`);
  }

  for (let i = 0; i < count; i++) {
    const productId = PRODUCTS[i % PRODUCTS.length];
    const reqId = `synth_${Date.now()}_${i + 1}`;
    const startTime = Date.now();

    let status = 0;
    let success = false;
    let version = "unknown";
    let replica = "unknown";
    let errorMessage: string | undefined;

    try {
      const response = await fetch(`${target}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          quantity: 1,
          syntheticRequestId: reqId,
        }),
      });

      status = response.status;
      version = response.headers.get("x-runsafe-version") || "unknown";
      replica = response.headers.get("x-runsafe-replica") || "unknown";

      const data: any = await response.json().catch(() => null);
      success = status >= 200 && status < 300 && data?.success === true;
      if (!success) {
        errorMessage = data?.error || `HTTP ${status}`;
      }
      if (data?.version) version = data.version;
      if (data?.replica) replica = data.replica;
    } catch (err: any) {
      status = 0;
      success = false;
      errorMessage = err.message || "Network request failed";
    }

    const durationMs = Date.now() - startTime;
    totalDuration += durationMs;
    stats.total += 1;
    if (success) {
      stats.success += 1;
    } else {
      stats.failed += 1;
    }

    // Accumulate by version & replica
    stats.byVersion[version] = stats.byVersion[version] || { total: 0, success: 0, failed: 0 };
    stats.byVersion[version].total += 1;
    if (success) stats.byVersion[version].success += 1;
    else stats.byVersion[version].failed += 1;

    stats.byReplica[replica] = stats.byReplica[replica] || { total: 0, success: 0, failed: 0 };
    stats.byReplica[replica].total += 1;
    if (success) stats.byReplica[replica].success += 1;
    else stats.byReplica[replica].failed += 1;

    const record: TrafficRecord = {
      timestamp: new Date().toISOString(),
      requestId: reqId,
      status,
      success,
      version,
      replica,
      durationMs,
      environment: "controlled",
      error: errorMessage,
    };

    // Validate and write to log file
    const validated = TrafficRecordSchema.parse(record);
    fs.appendFileSync(logFile, JSON.stringify(validated) + "\n");

    if (!quiet) {
      const outcome = success ? "OK" : "ERR";
      console.log(
        `[#${i + 1}/${count}] ${outcome} | HTTP ${status} | ${durationMs}ms | ver=${version} | rep=${replica} | prod=${productId}${errorMessage ? ` | ${errorMessage}` : ""}`
      );
    }

    if (i < count - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  stats.errorRate = stats.total > 0 ? parseFloat((stats.failed / stats.total).toFixed(4)) : 0;
  stats.avgDurationMs = stats.total > 0 ? parseFloat((totalDuration / stats.total).toFixed(2)) : 0;

  if (!quiet) {
    console.log(
      `[Traffic Generator Finished] Total: ${stats.total}, Success: ${stats.success}, Failed: ${stats.failed}, Error Rate: ${(stats.errorRate * 100).toFixed(1)}%, Avg Latency: ${stats.avgDurationMs}ms`
    );
  }

  return stats;
}

// Run directly from CLI if invoked
if (process.argv[1]?.endsWith("traffic_generator.ts") || process.argv[1]?.endsWith("traffic_generator.js")) {
  const args = process.argv.slice(2);
  let count = 20;
  let target = "http://127.0.0.1:8080";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--count" && args[i + 1]) count = parseInt(args[i + 1], 10);
    if (args[i] === "--target" && args[i + 1]) target = args[i + 1];
  }

  runTrafficGenerator({ count, target }).catch((err) => {
    console.error("Traffic generator error:", err);
    process.exit(1);
  });
}

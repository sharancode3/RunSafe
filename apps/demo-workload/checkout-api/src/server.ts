import { buildApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db.js";
import { log } from "./logger.js";

const app = buildApp();

async function start() {
  try {
    await app.listen({ port: config.port, host: config.host });
    log({
      level: "INFO",
      message: `Checkout API service running on http://${config.host}:${config.port} (version: ${config.appVersion}, replica: ${config.replicaId}, profile: ${config.faultProfile})`,
    });
  } catch (err: any) {
    log({
      level: "ERROR",
      message: `Failed to start Checkout API service: ${err.message}`,
      error: err.stack,
    });
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  log({
    level: "INFO",
    message: `Received ${signal}. Gracefully shutting down Checkout API service...`,
  });

  try {
    await app.close();
    await pool.end();
    process.exit(0);
  } catch (err: any) {
    log({
      level: "ERROR",
      message: `Error during shutdown: ${err.message}`,
      error: err.stack,
    });
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();

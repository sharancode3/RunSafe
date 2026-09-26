import { buildApp } from "./app.js";
import { getConfig } from "./config.js";

async function main() {
  const config = getConfig();
  const app = buildApp();

  try {
    const address = await app.listen({
      port: config.PORT,
      host: config.HOST,
    });
    app.log.info(`[RunSafe Control Plane] Listening on ${address}`);
    app.log.info(`[RunSafe Control Plane] TrueForge Target: ${config.TRUEFORGE_URL}`);
  } catch (err) {
    app.log.error(err, "Failed to start server");
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, closing server...`);
    try {
      await app.close();
      app.log.info("Server closed successfully");
      process.exit(0);
    } catch (err) {
      app.log.error(err, "Error closing server");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();

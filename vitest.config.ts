import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    environment: "node",
  },
  resolve: {
    alias: {
      "@runsafe/shared": path.resolve(__dirname, "packages/shared/src"),
      "@runsafe/trueforge-client": path.resolve(__dirname, "packages/trueforge-client/src"),
      "@runsafe/mcp-server": path.resolve(__dirname, "packages/mcp-server/src"),
      "@runsafe/infrastructure-adapter": path.resolve(__dirname, "packages/infrastructure-adapter/src"),
      "@runsafe/runbooks": path.resolve(__dirname, "packages/runbooks/src"),
      "@runsafe/evidence": path.resolve(__dirname, "packages/evidence/src"),
      "@runsafe/actions": path.resolve(__dirname, "packages/actions/src"),
      "@runsafe/safety-kernel": path.resolve(__dirname, "packages/safety-kernel/src"),
      "@runsafe/verifier": path.resolve(__dirname, "packages/verifier/src"),
      "@runsafe/recovery-engine": path.resolve(__dirname, "packages/recovery-engine/src"),
    },
  },
});

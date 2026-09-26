import dotenv from "dotenv";

dotenv.config();

export interface WorkloadConfig {
  port: number;
  host: string;
  databaseUrl: string;
  appVersion: string;
  replicaId: string;
  environment: string;
  faultProfile: string;
  buildId: string;
}

export function loadConfig(): WorkloadConfig {
  return {
    port: parseInt(process.env.PORT || "3000", 10),
    host: process.env.HOST || "0.0.0.0",
    databaseUrl:
      process.env.DATABASE_URL ||
      "postgresql://runsafe:runsafe_secret@postgres:5432/checkout_db",
    appVersion: process.env.APP_VERSION || "v1.0.0",
    replicaId: process.env.REPLICA_ID || "checkout-api-1",
    environment: process.env.ENVIRONMENT || "local",
    faultProfile: process.env.FAULT_PROFILE || "none",
    buildId: process.env.BUILD_ID || "build-local-1",
  };
}

export const config = loadConfig();

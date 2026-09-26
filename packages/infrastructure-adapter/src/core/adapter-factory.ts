import { TargetEnvironment, RunSafeOperationalError } from "@runsafe/shared";
import { InfrastructureAdapter } from "./infrastructure-adapter.js";
import { LocalDockerAdapter } from "../local/local-docker-adapter.js";
import { LocalSimulatorAdapter } from "../local/local-simulator-adapter.js";
import { AwsInfrastructureAdapter } from "../aws/aws-infrastructure-adapter.js";

const localSimulatorInstance = new LocalSimulatorAdapter();
const localDockerInstance = new LocalDockerAdapter();
const awsAdapterInstance = new AwsInfrastructureAdapter();

export function getInfrastructureAdapter(environment: TargetEnvironment): InfrastructureAdapter {
  if (environment === "LOCAL") {
    // If explicitly configured for Docker, use Docker; otherwise default to local simulator
    if (process.env.RUNSAFE_WORKLOAD_MODE === "DOCKER") {
      return localDockerInstance;
    }
    return localSimulatorInstance;
  }
  if (environment === "AWS") {
    return awsAdapterInstance;
  }
  throw new RunSafeOperationalError(
    "UNKNOWN_ENVIRONMENT",
    `Unsupported target environment '${environment}'. Valid environments are 'LOCAL' and 'AWS'.`
  );
}

export { LocalSimulatorAdapter, LocalDockerAdapter, AwsInfrastructureAdapter };

import { TargetEnvironment, RunSafeOperationalError } from "@runsafe/shared";
import { InfrastructureAdapter } from "./infrastructure-adapter.js";
import { LocalDockerAdapter } from "../local/local-docker-adapter.js";
import { AwsInfrastructureAdapter } from "../aws/aws-infrastructure-adapter.js";

const localAdapterInstance = new LocalDockerAdapter();
const awsAdapterInstance = new AwsInfrastructureAdapter();

export function getInfrastructureAdapter(environment: TargetEnvironment): InfrastructureAdapter {
  if (environment === "LOCAL") {
    return localAdapterInstance;
  }
  if (environment === "AWS") {
    return awsAdapterInstance;
  }
  throw new RunSafeOperationalError(
    "UNKNOWN_ENVIRONMENT",
    `Unsupported target environment '${environment}'. Valid environments are 'LOCAL' and 'AWS'.`
  );
}

import { config } from "./config.js";
import { type WorkloadMetrics } from "@runsafe/shared";

class MetricsCollector {
  private startTime = Date.now();
  private requestsTotal = 0;
  private requestsSuccess = 0;
  private requestsFailed = 0;
  private checkoutTotal = 0;
  private checkoutSuccess = 0;
  private checkoutFailed = 0;
  private latencySumMs = 0;

  public recordRequest(status: number, durationMs: number): void {
    this.requestsTotal += 1;
    this.latencySumMs += durationMs;
    if (status >= 200 && status < 400) {
      this.requestsSuccess += 1;
    } else {
      this.requestsFailed += 1;
    }
  }

  public recordCheckout(success: boolean): void {
    this.checkoutTotal += 1;
    if (success) {
      this.checkoutSuccess += 1;
    } else {
      this.checkoutFailed += 1;
    }
  }

  public getSnapshot(): WorkloadMetrics {
    const uptimeSeconds = Math.max(0, Math.floor((Date.now() - this.startTime) / 1000));
    const errorRate =
      this.requestsTotal > 0
        ? Math.min(1, Math.max(0, parseFloat((this.requestsFailed / this.requestsTotal).toFixed(4))))
        : 0;
    const avgLatencyMs =
      this.requestsTotal > 0
        ? parseFloat((this.latencySumMs / this.requestsTotal).toFixed(2))
        : 0;

    return {
      service: "checkout-api",
      version: config.appVersion,
      replica: config.replicaId,
      environment: config.environment,
      uptimeSeconds,
      requestsTotal: this.requestsTotal,
      requestsSuccess: this.requestsSuccess,
      requestsFailed: this.requestsFailed,
      errorRate,
      checkoutTotal: this.checkoutTotal,
      checkoutSuccess: this.checkoutSuccess,
      checkoutFailed: this.checkoutFailed,
      avgLatencyMs,
      timestamp: new Date().toISOString(),
    };
  }

  public reset(): void {
    this.startTime = Date.now();
    this.requestsTotal = 0;
    this.requestsSuccess = 0;
    this.requestsFailed = 0;
    this.checkoutTotal = 0;
    this.checkoutSuccess = 0;
    this.checkoutFailed = 0;
    this.latencySumMs = 0;
  }
}

export const metricsCollector = new MetricsCollector();

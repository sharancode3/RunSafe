import { describe, it, expect, beforeEach } from "vitest";
import {
  CheckoutRequestSchema,
  CheckoutResponseSchema,
  WorkloadHealthSchema,
  WorkloadVersionSchema,
  WorkloadMetricsSchema,
  TrafficRecordSchema,
} from "@runsafe/shared";

describe("Workload Schemas", () => {
  it("validates valid CheckoutRequest", () => {
    const valid = {
      productId: "prod-001",
      quantity: 2,
      syntheticRequestId: "test-req-1",
    };
    const parsed = CheckoutRequestSchema.parse(valid);
    expect(parsed.productId).toBe("prod-001");
    expect(parsed.quantity).toBe(2);
  });

  it("applies default quantity to CheckoutRequest", () => {
    const valid = { productId: "prod-002" };
    const parsed = CheckoutRequestSchema.parse(valid);
    expect(parsed.quantity).toBe(1);
  });

  it("rejects CheckoutRequest with empty productId", () => {
    expect(() => CheckoutRequestSchema.parse({ productId: "" })).toThrow();
  });

  it("validates WorkloadHealth schema", () => {
    const health = {
      status: "healthy",
      service: "checkout-api",
      version: "v1.0.0",
      replica: "checkout-api-1",
      environment: "local",
      db: "connected",
      uptimeSeconds: 120,
      timestamp: new Date().toISOString(),
    };
    const parsed = WorkloadHealthSchema.parse(health);
    expect(parsed.status).toBe("healthy");
    expect(parsed.db).toBe("connected");
  });

  it("validates WorkloadVersion schema", () => {
    const version = {
      service: "checkout-api",
      version: "v2.0.0",
      replica: "checkout-api-2",
      environment: "local",
      faultProfile: "bad_deployment",
      buildId: "build-123",
    };
    const parsed = WorkloadVersionSchema.parse(version);
    expect(parsed.version).toBe("v2.0.0");
    expect(parsed.faultProfile).toBe("bad_deployment");
  });

  it("validates WorkloadMetrics schema", () => {
    const metrics = {
      service: "checkout-api",
      version: "v1.0.0",
      replica: "checkout-api-1",
      environment: "local",
      uptimeSeconds: 300,
      requestsTotal: 50,
      requestsSuccess: 45,
      requestsFailed: 5,
      errorRate: 0.1,
      checkoutTotal: 40,
      checkoutSuccess: 35,
      checkoutFailed: 5,
      avgLatencyMs: 42.5,
      timestamp: new Date().toISOString(),
    };
    const parsed = WorkloadMetricsSchema.parse(metrics);
    expect(parsed.requestsTotal).toBe(50);
    expect(parsed.errorRate).toBe(0.1);
  });

  it("validates TrafficRecord schema", () => {
    const record = {
      timestamp: new Date().toISOString(),
      requestId: "req-123",
      status: 200,
      success: true,
      version: "v1.0.0",
      replica: "checkout-api-1",
      durationMs: 25.4,
      environment: "local",
    };
    const parsed = TrafficRecordSchema.parse(record);
    expect(parsed.success).toBe(true);
    expect(parsed.version).toBe("v1.0.0");
  });
});

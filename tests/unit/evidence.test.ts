import { describe, it, expect } from "vitest";
import {
  normalizeToolOutputToEvidence,
  evaluateFreshness,
  evaluateSufficiency,
  detectEvidenceConflicts,
  executeSandboxDiagnostic,
  validateHypothesis,
  formulateHypothesis,
  evidenceRepository,
  type EvidenceRecord,
} from "@runsafe/evidence";

describe("Evidence Engine Subsystem", () => {
  it("should normalize raw tool outputs into typed, bounded EvidenceRecords", () => {
    const rawHealth = {
      status: "degraded",
      httpStatus: 500,
      replicas: [
        { name: "checkout-api-1", status: "healthy", port: 8081 },
        { name: "checkout-api-2", status: "unhealthy", port: 8082, error: "schema lock" },
      ],
    };

    const ev = normalizeToolOutputToEvidence("get_service_health", rawHealth, {
      environment: "LOCAL",
      targetResource: "checkout-service",
    });

    expect(ev.evidenceType).toBe("SERVICE_HEALTH");
    expect(ev.targetResource).toBe("checkout-service");
    expect(ev.freshnessStatus).toBe("FRESH");
    expect(ev.summary).toContain("HTTP 500");
    expect(ev.structuredValue).toBeDefined();
    expect(ev.derived).toBe(false);
  });

  it("should sanitize credentials and secrets during evidence normalization", () => {
    const rawWithSecrets = {
      dbUrl: "postgres://runsafe:super_secret_password_123@postgres:5432/checkout_db",
      apiKey: "sk-proj-1234567890abcdefghijklmnop",
      awsKey: "AKIAIOSFODNN7EXAMPLE",
      authHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secretpayload",
      message: "Connected to database",
    };

    const ev = normalizeToolOutputToEvidence("get_database_health", rawWithSecrets, {
      environment: "LOCAL",
      targetResource: "postgres",
    });

    const excerpt = ev.boundedRawExcerpt || "";
    expect(excerpt).not.toContain("super_secret_password_123");
    expect(excerpt).not.toContain("sk-proj-1234567890abcdefghijklmnop");
    expect(excerpt).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(excerpt).toContain("[REDACTED]");
  });

  it("should accurately evaluate evidence freshness against TTL", () => {
    const now = Date.now();
    const freshEvidence: EvidenceRecord = {
      id: "ev_fresh",
      environment: "LOCAL",
      targetResource: "checkout-service",
      evidenceType: "SERVICE_HEALTH",
      sourceType: "OBSERVATION_TOOL",
      sourceTool: "get_service_health",
      observedAt: new Date(now - 30 * 1000).toISOString(), // 30 seconds ago
      collectedAt: new Date().toISOString(),
      summary: "Fresh probe",
      structuredValue: { status: "ok" },
      freshnessStatus: "FRESH",
      derived: false,
      sourceEvidenceIds: [],
      createdAt: new Date().toISOString(),
    };

    const staleEvidence: EvidenceRecord = {
      ...freshEvidence,
      id: "ev_stale",
      observedAt: new Date(now - 300 * 1000).toISOString(), // 5 minutes ago
    };

    expect(evaluateFreshness(freshEvidence, 120, now)).toBe("FRESH");
    expect(evaluateFreshness(staleEvidence, 120, now)).toBe("STALE");
  });

  it("should detect shallow health probe fallacy conflicts", () => {
    const healthEv = normalizeToolOutputToEvidence(
      "get_service_health",
      { status: "healthy", httpStatus: 200 },
      { environment: "LOCAL", targetResource: "checkout-service" }
    );

    const syntheticEv = normalizeToolOutputToEvidence(
      "run_synthetic_checkout",
      { success: false, httpStatus: 500, error: "Database transaction aborted: schema lock" },
      { environment: "LOCAL", targetResource: "checkout-service" }
    );

    const report = detectEvidenceConflicts([healthEv, syntheticEv]);
    expect(report.hasConflict).toBe(true);
    expect(report.conflicts[0]).toContain("Shallow health probe fallacy detected");
  });

  it("should evaluate evidence sufficiency and detect missing telemetry", () => {
    const healthEv = normalizeToolOutputToEvidence(
      "get_service_health",
      { status: "healthy", httpStatus: 200 },
      { environment: "LOCAL", targetResource: "checkout-service" }
    );

    const suff = evaluateSufficiency(
      ["SERVICE_HEALTH", "RECENT_LOGS", "DATABASE_HEALTH"],
      [healthEv]
    );

    expect(suff.status).toBe("MISSING");
    expect(suff.satisfiedTypes).toContain("SERVICE_HEALTH");
    expect(suff.missingTypes).toContain("RECENT_LOGS");
    expect(suff.missingTypes).toContain("DATABASE_HEALTH");
  });

  it("should execute sandboxed Python log analysis and produce derived evidence", async () => {
    const rawLogs = [
      "2026-09-26T12:00:01Z [INFO] GET /health HTTP 200 OK",
      "2026-09-26T12:00:03Z [ERROR] [checkout-api-2] Database transaction aborted: inventory ledger reconciliation anomaly (v2.0.0 schema lock constraint)",
      "2026-09-26T12:00:05Z [ERROR] [checkout-api-2] 500 Internal Server Error POST /checkout",
    ];

    const sourceEv = normalizeToolOutputToEvidence(
      "get_recent_logs",
      { lines: rawLogs },
      { environment: "LOCAL", targetResource: "checkout-api-2" }
    );

    const result = await executeSandboxDiagnostic({
      rawInput: rawLogs,
      sourceEvidenceIds: [sourceEv.id],
      targetResource: "checkout-api-2",
      environment: "LOCAL",
    });

    expect(result.success).toBe(true);
    expect(result.diagnosticResult).toBeDefined();
    expect(result.diagnosticResult?.errorType).toBe("V2_SCHEMA_LOCK_CONSTRAINT_VIOLATION");
    expect(result.diagnosticResult?.affectedComponents).toContain("checkout-api-2");
    expect(result.diagnosticResult?.confidence).toBeGreaterThanOrEqual(0.9);

    expect(result.derivedEvidence).toBeDefined();
    expect(result.derivedEvidence?.derived).toBe(true);
    expect(result.derivedEvidence?.sourceEvidenceIds).toEqual([sourceEv.id]);
    expect(result.derivedEvidence?.evidenceType).toBe("SANDBOX_ANALYSIS");
  });

  it("should validate hypotheses and reject unverified evidence citations", () => {
    const existingIds = ["ev_1", "ev_2", "ev_3"];

    const validHyp = {
      id: "hyp_valid",
      contextId: "inc_001",
      statement: "Bad v2 deployment causes schema deadlock",
      supportingEvidenceIds: ["ev_1", "ev_2"],
      contradictingEvidenceIds: ["ev_3"],
      missingEvidenceTypes: [],
      evidenceStrength: "HIGH",
      modelProvider: "openai/gpt-4o",
      createdAt: new Date().toISOString(),
    };

    const validRes = validateHypothesis(validHyp, existingIds);
    expect(validRes.valid).toBe(true);

    const hallucinatedHyp = {
      ...validHyp,
      id: "hyp_hallucinated",
      supportingEvidenceIds: ["ev_1", "ev_phantom_999"], // Does not exist!
    };

    const invalidRes = validateHypothesis(hallucinatedHyp, existingIds);
    expect(invalidRes.valid).toBe(false);
    expect(invalidRes.errors.some((e) => e.includes("Unverified evidence citation"))).toBe(true);
  });

  it("should formulate hypothesis linking validated evidence and persist in SQLite", async () => {
    const ev1 = normalizeToolOutputToEvidence(
      "get_service_health",
      { status: "healthy", httpStatus: 200 },
      { environment: "LOCAL", targetResource: "checkout-service" }
    );
    const ev2 = normalizeToolOutputToEvidence(
      "run_synthetic_checkout",
      { success: false, httpStatus: 500 },
      { environment: "LOCAL", targetResource: "checkout-service" }
    );

    evidenceRepository.saveEvidence(ev1);
    evidenceRepository.saveEvidence(ev2);

    const hyp = await formulateHypothesis({
      contextId: "inc_test_001",
      evidenceList: [ev1, ev2],
    });

    expect(hyp).toBeDefined();
    expect(hyp.supportingEvidenceIds).toContain(ev2.id);
    expect(hyp.contradictingEvidenceIds).toContain(ev1.id);

    const retrieved = evidenceRepository.getHypothesis(hyp.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.statement).toBe(hyp.statement);
  });
});

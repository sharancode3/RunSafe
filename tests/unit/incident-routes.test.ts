import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../../apps/control-plane/src/app.js";
import { runbookRepository, compileRunbook } from "@runsafe/runbooks";
import fs from "fs";
import path from "path";

describe("Control Plane Incident Endpoints", () => {
  const app = buildApp();
  let contractId: string;

  beforeEach(async () => {
    const runbookPath = path.join(process.cwd(), "runbooks", "checkout_recovery_runbook.md");
    const markdown = fs.readFileSync(runbookPath, "utf-8");
    const compiled = await compileRunbook(markdown, {
      runbookId: "rb_checkout_recovery",
      version: "v1.0.0",
      targetService: "checkout-service",
    });
    runbookRepository.activateContract(compiled.contract!.id);
    contractId = compiled.contract!.id;
  });

  it("should create a new incident via POST /api/v1/incidents", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/incidents",
      payload: {
        title: "Test Ingress Outage",
        targetService: "checkout-service",
        environment: "LOCAL",
        activeContractId: contractId,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.incident).toBeDefined();
    expect(body.incident.id).toBeDefined();
    expect(body.incident.status).toBe("DETECTED");
    expect(body.incident.active_contract_id).toBe(contractId);
  });

  it("should list incidents and fetch incident detail via GET /api/v1/incidents/:id", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/incidents",
      payload: {
        title: "Latency degradation",
        targetService: "checkout-service",
        activeContractId: contractId,
      },
    });
    const incidentId = JSON.parse(createRes.body).incident.id;

    // List
    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/incidents",
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body);
    expect(listBody.incidents.some((i: any) => i.id === incidentId)).toBe(true);

    // Get detail
    const detailRes = await app.inject({
      method: "GET",
      url: `/api/v1/incidents/${incidentId}`,
    });
    expect(detailRes.statusCode).toBe(200);
    const detailBody = JSON.parse(detailRes.body);
    expect(detailBody.incident.id).toBe(incidentId);
    expect(detailBody.contractSummary).toBeDefined();
  });

  it("should fetch incident event trail via GET /api/v1/incidents/:id/events", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/incidents",
      payload: {
        title: "Event trail test",
        targetService: "checkout-service",
      },
    });
    const incidentId = JSON.parse(createRes.body).incident.id;

    const eventsRes = await app.inject({
      method: "GET",
      url: `/api/v1/incidents/${incidentId}/events`,
    });
    expect(eventsRes.statusCode).toBe(200);
    const eventsBody = JSON.parse(eventsRes.body);
    expect(eventsBody.events.length).toBeGreaterThanOrEqual(1);
    expect(eventsBody.events[0].event_type).toBe("INCIDENT_DETECTED");
  });
});

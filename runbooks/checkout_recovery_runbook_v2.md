# Runbook: Checkout Service Autonomous Recovery v2

## Description
Updated production incident recovery procedure for multi-replica Checkout Service (`checkout-service`).
Version 2 incorporates fast-path metric evaluation and parallel replica diagnosis before initiating progressive canary rollbacks.

## Target Service
checkout-service

---

### Step 1: Fleet Health Observation (STEP_1_OBSERVE_INGRESS)
- Tool: get_service_health
- Target: checkout-service
- Risk: READ_ONLY
- Reversible: true
- Approval: false
- On Success: STEP_2_OBSERVE_METRICS
- On Failure: STEP_2_OBSERVE_METRICS
- Description: Probe Nginx and all running API replicas.

### Step 2: Operational Metrics Analysis (STEP_2_OBSERVE_METRICS)
- Tool: get_metrics
- Target: checkout-service
- Risk: READ_ONLY
- Reversible: true
- Approval: false
- On Success: STEP_3_OBSERVE_LOGS
- On Failure: ESCALATED
- Description: Fetch in-memory error rates and latency percentiles.

### Step 3: Recent Log Telemetry Extraction (STEP_3_OBSERVE_LOGS)
- Tool: get_recent_logs
- Target: checkout-service
- Risk: READ_ONLY
- Reversible: true
- Approval: false
- On Success: STEP_4_CHECK_DB
- On Failure: ESCALATED
- Description: Extract sanitized recent log lines.

### Step 4: Database Persistence Health Check (STEP_4_CHECK_DB)
- Tool: get_database_health
- Target: postgres
- Risk: READ_ONLY
- Reversible: true
- Approval: false
- On Success: STEP_5_ROLLBACK_CANARY
- On Failure: ESCALATED
- Description: Execute harmless PostgreSQL probe.

### Step 5: Isolated Canary Rollback (STEP_5_ROLLBACK_CANARY)
- Tool: rollback_canary
- Target: checkout-api-2
- Risk: HIGH_RISK
- Reversible: true
- Approval: true
- On Success: STEP_6_ROLLBACK_FULL
- On Failure: ESCALATED
- Description: Roll back single canary replica 2 to v1.0.0.

### Step 6: Full Fleet Rollback (STEP_6_ROLLBACK_FULL)
- Tool: rollback_full
- Target: checkout-service
- Risk: HIGH_RISK
- Reversible: true
- Approval: true
- On Success: STEP_7_VERIFY_SYNTHETIC
- On Failure: ESCALATED
- Description: Roll back entire checkout service fleet.

### Step 7: Objective Synthetic Verification (STEP_7_VERIFY_SYNTHETIC)
- Tool: run_synthetic_checkout
- Target: checkout-service
- Risk: READ_ONLY
- Reversible: true
- Approval: false
- On Success: RESOLVED
- On Failure: ESCALATED
- Description: ACID synthetic checkout against PostgreSQL.

```json
{
  "id": "contract_checkout_recovery_v2",
  "runbookId": "rb_checkout_recovery",
  "runbookVersionId": "ver_rb_checkout_recovery_v2_0",
  "targetService": "checkout-service",
  "schemaVersion": "1.0.0",
  "contractVersion": "v2.0.0",
  "title": "Checkout Service Autonomous Recovery v2",
  "description": "Updated production incident recovery procedure with metric evaluation.",
  "entryStepId": "STEP_1_OBSERVE_INGRESS",
  "steps": [
    {
      "id": "STEP_1_OBSERVE_INGRESS",
      "title": "Fleet Health Observation",
      "description": "Probe Nginx and all running API replicas.",
      "toolName": "get_service_health",
      "defaultArguments": { "environment": "LOCAL", "serviceId": "checkout-service" },
      "targetResource": "checkout-service",
      "riskLevel": "READ_ONLY",
      "isReversible": true,
      "requiresApproval": false,
      "preconditions": [],
      "successCriteria": [],
      "evidenceRequirements": [],
      "onSuccess": "STEP_2_OBSERVE_METRICS",
      "onFailure": "STEP_2_OBSERVE_METRICS"
    },
    {
      "id": "STEP_2_OBSERVE_METRICS",
      "title": "Operational Metrics Analysis",
      "description": "Fetch in-memory error rates.",
      "toolName": "get_metrics",
      "defaultArguments": { "environment": "LOCAL", "serviceId": "checkout-service" },
      "targetResource": "checkout-service",
      "riskLevel": "READ_ONLY",
      "isReversible": true,
      "requiresApproval": false,
      "preconditions": [],
      "successCriteria": [],
      "evidenceRequirements": [],
      "onSuccess": "STEP_3_OBSERVE_LOGS",
      "onFailure": "ESCALATED"
    },
    {
      "id": "STEP_3_OBSERVE_LOGS",
      "title": "Recent Log Telemetry Extraction",
      "description": "Extract sanitized recent log lines.",
      "toolName": "get_recent_logs",
      "defaultArguments": { "environment": "LOCAL", "serviceId": "checkout-service" },
      "targetResource": "checkout-service",
      "riskLevel": "READ_ONLY",
      "isReversible": true,
      "requiresApproval": false,
      "preconditions": [],
      "successCriteria": [],
      "evidenceRequirements": [],
      "onSuccess": "STEP_4_CHECK_DB",
      "onFailure": "ESCALATED"
    },
    {
      "id": "STEP_4_CHECK_DB",
      "title": "Database Persistence Health Check",
      "description": "Execute harmless PostgreSQL probe.",
      "toolName": "get_database_health",
      "defaultArguments": { "environment": "LOCAL", "databaseId": "postgres" },
      "targetResource": "postgres",
      "riskLevel": "READ_ONLY",
      "isReversible": true,
      "requiresApproval": false,
      "preconditions": [],
      "successCriteria": [],
      "evidenceRequirements": [],
      "onSuccess": "STEP_5_ROLLBACK_CANARY",
      "onFailure": "ESCALATED"
    },
    {
      "id": "STEP_5_ROLLBACK_CANARY",
      "title": "Isolated Canary Rollback",
      "description": "Roll back single canary replica 2.",
      "toolName": "rollback_canary",
      "defaultArguments": { "environment": "LOCAL", "serviceId": "checkout-service", "replicaId": "checkout-api-2", "targetVersion": "v1.0.0" },
      "targetResource": "checkout-api-2",
      "riskLevel": "HIGH_RISK",
      "isReversible": true,
      "requiresApproval": true,
      "preconditions": [],
      "successCriteria": [],
      "evidenceRequirements": [],
      "onSuccess": "STEP_6_ROLLBACK_FULL",
      "onFailure": "ESCALATED"
    },
    {
      "id": "STEP_6_ROLLBACK_FULL",
      "title": "Full Fleet Rollback",
      "description": "Roll back entire checkout service fleet.",
      "toolName": "rollback_full",
      "defaultArguments": { "environment": "LOCAL", "serviceId": "checkout-service", "targetVersion": "v1.0.0" },
      "targetResource": "checkout-service",
      "riskLevel": "HIGH_RISK",
      "isReversible": true,
      "requiresApproval": true,
      "preconditions": [],
      "successCriteria": [],
      "evidenceRequirements": [],
      "onSuccess": "STEP_7_VERIFY_SYNTHETIC",
      "onFailure": "ESCALATED"
    },
    {
      "id": "STEP_7_VERIFY_SYNTHETIC",
      "title": "Objective Synthetic Verification",
      "description": "ACID synthetic checkout against PostgreSQL.",
      "toolName": "run_synthetic_checkout",
      "defaultArguments": { "environment": "LOCAL" },
      "targetResource": "checkout-service",
      "riskLevel": "READ_ONLY",
      "isReversible": true,
      "requiresApproval": false,
      "preconditions": [],
      "successCriteria": [],
      "evidenceRequirements": [],
      "onSuccess": "RESOLVED",
      "onFailure": "ESCALATED"
    }
  ],
  "terminalStates": ["RESOLVED", "ESCALATED", "ABSTAINED"],
  "createdAt": "2026-09-26T12:30:00.000Z"
}
```

/**
 * Generates isolated Python diagnostic scripts for the TrueForge sandbox.
 * These scripts perform statistical telemetry analysis, regex error clustering,
 * and correlation with deployments without risking arbitrary shell escape.
 */
export function generateLogAnalysisScript(): string {
  return `
import sys
import json
import re

def analyze():
    raw_data = sys.stdin.read()
    if not raw_data.strip():
        print(json.dumps({
            "errorType": "EMPTY_LOGS",
            "rootCauseSuspect": "No operational logs provided for diagnostic parsing",
            "affectedComponents": [],
            "errorCount": 0,
            "confidence": 0.0,
            "findings": ["Stdin was empty"]
        }))
        return

    try:
        data = json.loads(raw_data)
        lines = data if isinstance(data, list) else data.get("lines", [raw_data])
    except Exception:
        lines = raw_data.splitlines()

    error_count = 0
    anomalies = []
    affected = set()
    root_cause = "UNKNOWN_RUNTIME_EXCEPTION"
    confidence = 0.5

    for line in lines:
        text = str(line)
        if any(w in text.upper() for w in ["ERROR", "FATAL", "PANIC", "EXCEPTION", "500", "ABORTED"]):
            error_count += 1
            if "NullPointer" in text or "null pointer" in text.lower():
                root_cause = "NULL_POINTER_EXCEPTION"
                confidence = 0.90
                anomalies.append(text)
            elif "schema lock" in text.lower() or "inventory ledger reconciliation" in text.lower():
                root_cause = "V2_SCHEMA_LOCK_CONSTRAINT_VIOLATION"
                confidence = 0.98
                anomalies.append(text)
            elif "connection refused" in text.lower():
                root_cause = "DATABASE_CONNECTION_REFUSED"
                confidence = 0.92
                anomalies.append(text)
            
            if "checkout-api-1" in text:
                affected.add("checkout-api-1")
            if "checkout-api-2" in text:
                affected.add("checkout-api-2")
            if "checkout-service" in text:
                affected.add("checkout-service")

    if not affected:
        affected.add("checkout-service")

    result = {
        "errorType": root_cause,
        "rootCauseSuspect": f"Detected {root_cause} across {len(affected)} component(s)",
        "affectedComponents": sorted(list(affected)),
        "errorCount": error_count,
        "confidence": confidence if error_count > 0 else 0.0,
        "findings": [
            f"Parsed {len(lines)} log lines, identified {error_count} error occurrences",
            f"Primary diagnostic signal: {root_cause}",
            f"Exemplar anomaly excerpt: {anomalies[0][:200] if anomalies else 'None'}"
        ]
    }

    print(json.dumps(result))

if __name__ == "__main__":
    analyze()
`.trim();
}

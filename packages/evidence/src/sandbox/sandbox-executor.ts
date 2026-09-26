import { spawn } from "child_process";
import {
  DiagnosticResultSchema,
  type DiagnosticResult,
  type EvidenceRecord,
} from "../schemas.js";
import type { TargetEnvironment } from "@runsafe/shared";
import { generateLogAnalysisScript } from "./diagnostic-script-generator.js";

export interface SandboxExecutionOptions {
  scriptContent?: string;
  rawInput: string | Record<string, unknown> | Array<unknown>;
  sourceEvidenceIds: string[];
  incidentId?: string | null;
  targetResource?: string;
  environment?: TargetEnvironment;
  timeoutMs?: number;
}

export interface SandboxExecutionResult {
  success: boolean;
  diagnosticResult?: DiagnosticResult;
  derivedEvidence?: EvidenceRecord;
  executionId: string;
  durationMs: number;
  error?: string;
}

export async function executeSandboxDiagnostic(
  options: SandboxExecutionOptions
): Promise<SandboxExecutionResult> {
  const start = Date.now();
  const executionId = `sbx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const script = options.scriptContent || generateLogAnalysisScript();
  const inputStr =
    typeof options.rawInput === "string"
      ? options.rawInput
      : JSON.stringify(options.rawInput);
  const timeoutMs = options.timeoutMs || 8000;

  return new Promise((resolve) => {
    const child = spawn("python", ["-c", script], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - start;

      if (timedOut) {
        return resolve({
          success: false,
          executionId,
          durationMs,
          error: `Sandbox execution timed out after ${timeoutMs}ms (SIGKILL enforced)`,
        });
      }

      if (code !== 0) {
        return resolve({
          success: false,
          executionId,
          durationMs,
          error: `Sandbox process exited with code ${code}: ${stderr || stdout}`,
        });
      }

      try {
        const rawJson = JSON.parse(stdout.trim());
        const parseResult = DiagnosticResultSchema.safeParse(rawJson);

        if (!parseResult.success) {
          return resolve({
            success: false,
            executionId,
            durationMs,
            error: `Sandbox output failed DiagnosticResultSchema validation: ${parseResult.error.message}`,
          });
        }

        const diag = parseResult.data;
        const now = new Date().toISOString();
        const derivedEvidence: EvidenceRecord = {
          id: `ev_sbx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          incidentId: options.incidentId || null,
          environment: options.environment || "LOCAL",
          targetResource: options.targetResource || diag.affectedComponents[0] || "checkout-service",
          evidenceType: "SANDBOX_ANALYSIS",
          sourceType: "SANDBOX_DIAGNOSTIC",
          sourceTool: "analyze_logs.py",
          sourceExecutionId: null,
          observedAt: now,
          collectedAt: now,
          summary: `Sandbox diagnostic: ${diag.rootCauseSuspect} (confidence: ${(diag.confidence * 100).toFixed(0)}%).`,
          structuredValue: diag as unknown as Record<string, unknown>,
          boundedRawExcerpt: stdout.trim().substring(0, 2000),
          freshnessStatus: "FRESH",
          derived: true,
          sourceEvidenceIds: options.sourceEvidenceIds,
          sandboxExecutionId: executionId,
          createdAt: now,
        };

        return resolve({
          success: true,
          diagnosticResult: diag,
          derivedEvidence,
          executionId,
          durationMs,
        });
      } catch (err: any) {
        return resolve({
          success: false,
          executionId,
          durationMs,
          error: `Failed to parse sandbox JSON output: ${err.message}. Raw output: ${stdout}`,
        });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        executionId,
        durationMs: Date.now() - start,
        error: `Sandbox execution spawn error: ${err.message}`,
      });
    });

    // Write input to stdin and close
    child.stdin.write(inputStr);
    child.stdin.end();
  });
}

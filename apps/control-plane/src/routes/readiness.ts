import type { FastifyPluginAsync } from "fastify";
import { TrueForgeClient } from "@runsafe/trueforge-client";
import { getConfig } from "../config.js";
import type { ReadinessReport, ComponentReport } from "@runsafe/shared";

export const readinessRoutes: FastifyPluginAsync = async (fastify) => {
  const config = getConfig();
  const tfClient = new TrueForgeClient({ baseUrl: config.TRUEFORGE_URL });

  fastify.get("/api/system/readiness", async (_request, reply) => {
    const now = new Date().toISOString();

    // 1. Control Plane check
    const controlPlane: ComponentReport = {
      state: "READY",
      message: "Fastify control plane operational",
      lastChecked: now,
      details: {
        uptime: Math.floor(process.uptime()),
        nodeVersion: process.version,
      },
    };

    // 2. TrueForge Runtime check
    let trueForge: ComponentReport;
    const tfHealth = await tfClient.checkHealth();
    if (tfHealth.ok) {
      trueForge = {
        state: "READY",
        message: `TrueForge runtime reachable on ${config.TRUEFORGE_URL}`,
        lastChecked: now,
        details: { version: tfHealth.version },
      };
    } else {
      trueForge = {
        state: "NOT_READY",
        message: `TrueForge runtime unreachable: ${tfHealth.error}`,
        lastChecked: now,
      };
    }

    // 3. Primary Model check
    let primaryModel: ComponentReport;
    let modelProviders: any[] = [];
    try {
      modelProviders = await tfClient.getModelProviders();
      const hasOpenAI = modelProviders.some((p) => p.name === "openai" || p.manifest?.type === "openai");
      const hasCustom = modelProviders.some((p) => p.manifest?.type === "custom");

      if (hasOpenAI) {
        primaryModel = {
          state: "READY",
          message: "Organizer OpenAI model provider configured in TrueForge",
          lastChecked: now,
          details: { provider: "openai" },
        };
      } else if (hasCustom) {
        primaryModel = {
          state: "BLOCKED",
          message: "Awaiting organizer OpenAI API credentials; local fallback model active in TrueForge",
          lastChecked: now,
          details: { activeFallback: modelProviders[0]?.name },
        };
      } else {
        primaryModel = {
          state: "NOT_READY",
          message: "No model provider configured in TrueForge",
          lastChecked: now,
        };
      }
    } catch (err: any) {
      primaryModel = {
        state: "NOT_READY",
        message: `Failed to inspect model providers: ${err.message}`,
        lastChecked: now,
      };
    }

    // 4. Saved RunSafe Agent check
    let runSafeAgent: ComponentReport;
    let agentRecord: any = null;
    try {
      const agents = await tfClient.getAgents();
      agentRecord = agents.find((a) => a.name === config.RUNSAFE_AGENT_NAME);
      if (agentRecord) {
        runSafeAgent = {
          state: "READY",
          message: `Saved agent '${config.RUNSAFE_AGENT_NAME}' verified in TrueForge`,
          lastChecked: now,
          details: { id: agentRecord.id, model: agentRecord.manifest?.model?.name },
        };
      } else {
        runSafeAgent = {
          state: "NOT_READY",
          message: `Saved agent '${config.RUNSAFE_AGENT_NAME}' not found in TrueForge`,
          lastChecked: now,
        };
      }
    } catch (err: any) {
      runSafeAgent = {
        state: "NOT_READY",
        message: `Failed to inspect TrueForge agents: ${err.message}`,
        lastChecked: now,
      };
    }

    // 5. MCP Server check
    let mcpServer: ComponentReport;
    try {
      const mcpRes = await fetch(config.MCP_HEALTH_URL);
      if (mcpRes.ok) {
        const mcpData = (await mcpRes.json()) as any;
        mcpServer = {
          state: "READY",
          message: `RunSafe MCP server operational on ${config.MCP_SERVER_URL}`,
          lastChecked: now,
          details: mcpData,
        };
      } else {
        mcpServer = {
          state: "NOT_READY",
          message: `MCP server returned HTTP ${mcpRes.status}`,
          lastChecked: now,
        };
      }
    } catch (err: any) {
      mcpServer = {
        state: "NOT_READY",
        message: `Cannot reach MCP server: ${err.message}`,
        lastChecked: now,
      };
    }

    // 6. MCP Tool Invocation readiness
    let toolExecution: ComponentReport;
    const mcpAttached = agentRecord?.manifest?.mcp_servers?.some(
      (m: any) => m.name === "runsafe-mcp"
    );
    if (mcpAttached) {
      toolExecution = {
        state: "READY",
        message: "RunSafe MCP server attached to saved TrueForge agent",
        lastChecked: now,
      };
    } else {
      toolExecution = {
        state: "NOT_READY",
        message: "MCP server not attached to saved TrueForge agent",
        lastChecked: now,
      };
    }

    // 7. TrueForge Sandbox Execution check
    let sandbox: ComponentReport;
    if (process.platform === "win32") {
      // TrueForge explicitly requires Daytona on Windows
      sandbox = {
        state: "BLOCKED",
        message:
          "TrueForge on Windows requires Daytona provider ('LocalSandboxProvider supports macOS and Linux only'). Awaiting organizer Daytona credentials.",
        lastChecked: now,
      };
    } else {
      sandbox = {
        state: "READY",
        message: "Local sandbox provider available on POSIX host",
        lastChecked: now,
      };
    }

    // 8. Human Checkpoint / Tool Approval check
    const approvalsConfigured = agentRecord?.manifest?.mcp_servers?.some((m: any) =>
      m.require_approval_for_tools?.includes("stage1_guarded_noop")
    );
    const approvalCheckpoint: ComponentReport = {
      state: approvalsConfigured ? "READY" : "NOT_READY",
      message: approvalsConfigured
        ? "Tool approval checkpoint configured for 'stage1_guarded_noop' in TrueForge"
        : "Approval checkpoint not yet attached to agent manifest",
      lastChecked: now,
    };

    // 9. Programmatic Integration check
    const programmaticIntegration: ComponentReport = {
      state: tfHealth.ok && agentRecord ? "READY" : "NOT_READY",
      message:
        tfHealth.ok && agentRecord
          ? "Programmatic Fastify -> TrueForge bridge verified"
          : "Prerequisites missing for programmatic bridge",
      lastChecked: now,
    };

    // Determine overall state:
    // If any component is NOT_READY -> NOT_READY
    // Else if any is BLOCKED -> BLOCKED
    // Else -> READY
    const states = [
      controlPlane.state,
      trueForge.state,
      primaryModel.state,
      runSafeAgent.state,
      mcpServer.state,
      toolExecution.state,
      sandbox.state,
      approvalCheckpoint.state,
      programmaticIntegration.state,
    ];

    let overall: ReadinessReport["overall"] = "READY";
    if (states.includes("NOT_READY")) {
      overall = "NOT_READY";
    } else if (states.includes("BLOCKED")) {
      overall = "BLOCKED";
    }

    const report: ReadinessReport = {
      overall,
      timestamp: now,
      components: {
        controlPlane,
        trueForge,
        primaryModel,
        runSafeAgent,
        mcpServer,
        toolExecution,
        sandbox,
        approvalCheckpoint,
        programmaticIntegration,
      },
    };

    return reply.status(200).send(report);
  });
};

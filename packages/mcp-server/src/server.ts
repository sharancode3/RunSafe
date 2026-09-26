import http from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  RuntimeStatusSchema,
  type RuntimeStatus,
  GuardedNoopInputSchema,
  GuardedNoopOutputSchema,
  type GuardedNoopOutput,
  CapabilityMode,
  filterToolsByMode,
  TOOL_REGISTRY,
  RunSafeOperationalError,
  wrapToolResult,
  wrapToolError,
  GetServiceHealthInputSchema,
  GetRecentLogsInputSchema,
  GetMetricsInputSchema,
  GetDatabaseHealthInputSchema,
  GetDeploymentStateInputSchema,
  GetReplicaStateInputSchema,
  GetDependenciesInputSchema,
  RunSyntheticCheckoutInputSchema,
  RestartServiceInputSchema,
  RollbackCanaryInputSchema,
  RollbackFullInputSchema,
  InjectProcessCrashInputSchema,
  InjectBadDeploymentInputSchema,
  InjectAmbiguousFailureInputSchema,
  ResetEnvironmentInputSchema,
} from "@runsafe/shared";
import { getInfrastructureAdapter } from "@runsafe/infrastructure-adapter";

export class RunSafeMcpServer {
  private httpServer: http.Server | null = null;
  private activeSessions: Map<string, { server: Server; transport: SSEServerTransport }> = new Map();
  private guardedExecutionCount = 0;
  private executedActionIds: Set<string> = new Set();
  private startTime = Date.now();
  private mode: CapabilityMode = (process.env.RUNSAFE_CAPABILITY_MODE as CapabilityMode) || "RECOVERY";

  constructor(mode?: CapabilityMode) {
    if (mode) {
      this.mode = mode;
    }
  }

  public setCapabilityMode(mode: CapabilityMode) {
    this.mode = mode;
  }

  public getCapabilityMode(): CapabilityMode {
    return this.mode;
  }

  private isMutationAuthorized(authContext?: string): boolean {
    if (process.env.RUNSAFE_ALLOW_STAGE3_TEST_MUTATIONS === "true") {
      return true;
    }
    if (authContext && authContext.startsWith("test-ctx-") || authContext?.startsWith("auth-")) {
      return true;
    }
    return false;
  }

  private createServerInstance(): Server {
    const server = new Server(
      {
        name: "runsafe-mcp",
        version: "0.2.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // 1. List tools handler - filtered by active CapabilityMode
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const activeTools = filterToolsByMode(this.mode);

      const mcpTools = activeTools.map((t) => {
        let inputSchema: Record<string, unknown> = {
          type: "object",
          properties: {},
          additionalProperties: false,
        };

        if (t.toolId === "get_service_health") {
          inputSchema = {
            type: "object",
            properties: {
              environment: { type: "string", enum: ["LOCAL", "AWS"], default: "LOCAL" },
              serviceId: { type: "string", description: "Logical service or replica identifier" },
            },
            required: ["serviceId"],
          };
        } else if (t.toolId === "get_recent_logs") {
          inputSchema = {
            type: "object",
            properties: {
              environment: { type: "string", enum: ["LOCAL", "AWS"], default: "LOCAL" },
              serviceId: { type: "string", description: "Target service or replica identifier" },
              limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
            },
            required: ["serviceId"],
          };
        } else if (t.toolId === "get_metrics") {
          inputSchema = {
            type: "object",
            properties: {
              environment: { type: "string", enum: ["LOCAL", "AWS"], default: "LOCAL" },
              serviceId: { type: "string", description: "Target service or replica identifier" },
            },
            required: ["serviceId"],
          };
        } else if (t.toolId === "get_database_health") {
          inputSchema = {
            type: "object",
            properties: {
              environment: { type: "string", enum: ["LOCAL", "AWS"], default: "LOCAL" },
              databaseId: { type: "string", default: "postgres" },
            },
          };
        } else if (t.toolId === "get_deployment_state") {
          inputSchema = {
            type: "object",
            properties: {
              environment: { type: "string", enum: ["LOCAL", "AWS"], default: "LOCAL" },
              serviceId: { type: "string", default: "checkout-service" },
            },
          };
        } else if (t.toolId === "get_replica_state") {
          inputSchema = {
            type: "object",
            properties: {
              environment: { type: "string", enum: ["LOCAL", "AWS"], default: "LOCAL" },
              replicaId: { type: "string", enum: ["checkout-api-1", "checkout-api-2"] },
            },
            required: ["replicaId"],
          };
        } else if (t.toolId === "get_dependencies") {
          inputSchema = {
            type: "object",
            properties: {
              environment: { type: "string", enum: ["LOCAL", "AWS"], default: "LOCAL" },
              resourceId: { type: "string", description: "Target resource identifier" },
            },
            required: ["resourceId"],
          };
        } else if (t.toolId === "run_synthetic_checkout") {
          inputSchema = {
            type: "object",
            properties: {
              environment: { type: "string", enum: ["LOCAL", "AWS"], default: "LOCAL" },
              productId: { type: "string", default: "prod-001" },
              quantity: { type: "integer", minimum: 1, default: 1 },
            },
          };
        } else if (t.toolId === "restart_service") {
          inputSchema = {
            type: "object",
            properties: {
              environment: { type: "string", enum: ["LOCAL", "AWS"], default: "LOCAL" },
              target: { type: "string", description: "Target service or replica identifier" },
              authorizationContext: { type: "string", description: "Authorization token or Stage 3 test context" },
            },
            required: ["target"],
          };
        } else if (t.toolId === "rollback_canary") {
          inputSchema = {
            type: "object",
            properties: {
              environment: { type: "string", enum: ["LOCAL", "AWS"], default: "LOCAL" },
              serviceId: { type: "string", default: "checkout-service" },
              replicaId: { type: "string", description: "Replica to roll back (e.g. checkout-api-2)" },
              targetVersion: { type: "string", enum: ["v1.0.0", "v2.0.0"], default: "v1.0.0" },
              authorizationContext: { type: "string" },
            },
            required: ["replicaId"],
          };
        } else if (t.toolId === "rollback_full") {
          inputSchema = {
            type: "object",
            properties: {
              environment: { type: "string", enum: ["LOCAL", "AWS"], default: "LOCAL" },
              serviceId: { type: "string", default: "checkout-service" },
              targetVersion: { type: "string", enum: ["v1.0.0", "v2.0.0"], default: "v1.0.0" },
              authorizationContext: { type: "string" },
            },
          };
        } else if (t.toolId === "inject_process_crash") {
          inputSchema = {
            type: "object",
            properties: {
              environment: { type: "string", enum: ["LOCAL", "AWS"], default: "LOCAL" },
              targetReplica: { type: "string", enum: ["checkout-api-1", "checkout-api-2"], default: "checkout-api-1" },
            },
          };
        } else if (t.toolId === "inject_bad_deployment") {
          inputSchema = {
            type: "object",
            properties: {
              environment: { type: "string", enum: ["LOCAL", "AWS"], default: "LOCAL" },
              targetReplica: { type: "string", enum: ["checkout-api-1", "checkout-api-2"], default: "checkout-api-2" },
              badVersion: { type: "string", default: "v2.0.0" },
            },
          };
        } else if (t.toolId === "inject_ambiguous_failure") {
          inputSchema = {
            type: "object",
            properties: {
              environment: { type: "string", enum: ["LOCAL", "AWS"], default: "LOCAL" },
              probability: { type: "number", minimum: 0, maximum: 1, default: 0.35 },
            },
          };
        } else if (t.toolId === "reset_environment") {
          inputSchema = {
            type: "object",
            properties: {
              environment: { type: "string", enum: ["LOCAL", "AWS"], default: "LOCAL" },
            },
          };
        }

        return {
          name: t.toolId,
          description: t.description,
          inputSchema,
        };
      });

      // Maintain Stage 1 tools for backward compatibility
      mcpTools.push(
        {
          name: "get_runtime_status",
          description:
            "Returns real live runtime status, Node.js version, process uptime, and environment health for RunSafe services.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
        {
          name: "stage1_guarded_noop",
          description:
            "Harmless gated no-op tool used for verifying TrueForge human approval checkpoint, gating, and duplicate execution prevention.",
          inputSchema: {
            type: "object",
            properties: {
              actionId: {
                type: "string",
                description: "Unique identifier for this action verification request",
              },
              reason: {
                type: "string",
                description: "Optional explanation or audit reason for this gated action",
              },
            },
            required: ["actionId"],
            additionalProperties: false,
          },
        }
      );

      return { tools: mcpTools };
    });

    // 2. Call tool handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const startTime = Date.now();

      // Check capability mode for rehearsal tools
      const toolDef = TOOL_REGISTRY[name];
      if (toolDef?.rehearsalOnly && this.mode === "RECOVERY") {
        const envelope = wrapToolError({
          tool: name,
          environment: "LOCAL",
          resource: "system",
          provider: "RUNSAFE_MCP",
          error: new RunSafeOperationalError(
            "REHEARSAL_ONLY_OPERATION",
            `Tool '${name}' is isolated and permitted only in REHEARSAL capability mode. Normal recovery operation cannot execute rehearsal faults.`
          ),
          durationMs: Date.now() - startTime,
        });
        return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
      }

      // Check mutation guard
      if (toolDef?.mutation) {
        const authCtx = (args as any)?.authorizationContext;
        if (!this.isMutationAuthorized(authCtx)) {
          const envelope = wrapToolError({
            tool: name,
            environment: (args as any)?.environment || "LOCAL",
            resource: (args as any)?.target || (args as any)?.replicaId || "service",
            provider: "RUNSAFE_MCP",
            error: new RunSafeOperationalError(
              "AUTHORIZATION_CONTEXT_REQUIRED",
              `Mutation tool '${name}' requires an authorized execution context or development test mode (RUNSAFE_ALLOW_STAGE3_TEST_MUTATIONS=true).`
            ),
            durationMs: Date.now() - startTime,
          });
          return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
        }
      }

      try {
        // --- STAGE 1 BACKWARD COMPATIBLE TOOLS ---
        if (name === "get_runtime_status") {
          const statusPayload: RuntimeStatus = {
            service: "runsafe-mcp",
            status: "healthy",
            timestamp: new Date().toISOString(),
            runtime: `node ${process.version}`,
            environment: process.env.NODE_ENV ?? "development",
            version: "0.2.0",
            nodeVersion: process.version,
            uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
          };
          const validated = RuntimeStatusSchema.parse(statusPayload);
          return { content: [{ type: "text", text: JSON.stringify(validated, null, 2) }] };
        }

        if (name === "stage1_guarded_noop") {
          const parsed = GuardedNoopInputSchema.parse(args);
          this.guardedExecutionCount += 1;
          this.executedActionIds.add(parsed.actionId);
          const output: GuardedNoopOutput = {
            executed: true,
            actionId: parsed.actionId,
            executionCount: this.guardedExecutionCount,
            timestamp: new Date().toISOString(),
            note: "Harmless gated no-op executed successfully after approval checkpoint.",
          };
          const validated = GuardedNoopOutputSchema.parse(output);
          return { content: [{ type: "text", text: JSON.stringify(validated, null, 2) }] };
        }

        // --- OBSERVATION TOOLS ---
        if (name === "get_service_health") {
          const parsed = GetServiceHealthInputSchema.parse(args);
          const adapter = getInfrastructureAdapter(parsed.environment);
          const result = await adapter.getServiceHealth(parsed.serviceId);
          const envelope = wrapToolResult({
            tool: name,
            environment: parsed.environment,
            resource: parsed.serviceId,
            provider: adapter.provider,
            data: result,
            durationMs: Date.now() - startTime,
          });
          return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
        }

        if (name === "get_recent_logs") {
          const parsed = GetRecentLogsInputSchema.parse(args);
          const adapter = getInfrastructureAdapter(parsed.environment);
          const result = await adapter.getRecentLogs(parsed.serviceId, parsed.limit);
          const envelope = wrapToolResult({
            tool: name,
            environment: parsed.environment,
            resource: parsed.serviceId,
            provider: adapter.provider,
            data: result,
            durationMs: Date.now() - startTime,
          });
          return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
        }

        if (name === "get_metrics") {
          const parsed = GetMetricsInputSchema.parse(args);
          const adapter = getInfrastructureAdapter(parsed.environment);
          const result = await adapter.getMetrics(parsed.serviceId);
          const envelope = wrapToolResult({
            tool: name,
            environment: parsed.environment,
            resource: parsed.serviceId,
            provider: adapter.provider,
            data: result,
            durationMs: Date.now() - startTime,
          });
          return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
        }

        if (name === "get_database_health") {
          const parsed = GetDatabaseHealthInputSchema.parse(args);
          const adapter = getInfrastructureAdapter(parsed.environment);
          const result = await adapter.getDatabaseHealth(parsed.databaseId);
          const envelope = wrapToolResult({
            tool: name,
            environment: parsed.environment,
            resource: parsed.databaseId,
            provider: adapter.provider,
            data: result,
            durationMs: Date.now() - startTime,
          });
          return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
        }

        if (name === "get_deployment_state") {
          const parsed = GetDeploymentStateInputSchema.parse(args);
          const adapter = getInfrastructureAdapter(parsed.environment);
          const result = await adapter.getDeploymentState(parsed.serviceId);
          const envelope = wrapToolResult({
            tool: name,
            environment: parsed.environment,
            resource: parsed.serviceId,
            provider: adapter.provider,
            data: result,
            durationMs: Date.now() - startTime,
          });
          return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
        }

        if (name === "get_replica_state") {
          const parsed = GetReplicaStateInputSchema.parse(args);
          const adapter = getInfrastructureAdapter(parsed.environment);
          const result = await adapter.getReplicaState(parsed.replicaId);
          const envelope = wrapToolResult({
            tool: name,
            environment: parsed.environment,
            resource: parsed.replicaId,
            provider: adapter.provider,
            data: result,
            durationMs: Date.now() - startTime,
          });
          return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
        }

        if (name === "get_dependencies") {
          const parsed = GetDependenciesInputSchema.parse(args);
          const adapter = getInfrastructureAdapter(parsed.environment);
          const result = await adapter.getDependencies(parsed.resourceId);
          const envelope = wrapToolResult({
            tool: name,
            environment: parsed.environment,
            resource: parsed.resourceId,
            provider: adapter.provider,
            data: result,
            durationMs: Date.now() - startTime,
          });
          return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
        }

        if (name === "run_synthetic_checkout") {
          const parsed = RunSyntheticCheckoutInputSchema.parse(args);
          const adapter = getInfrastructureAdapter(parsed.environment);
          const result = await adapter.runSyntheticCheckout(parsed.productId, parsed.quantity);
          const envelope = wrapToolResult({
            tool: name,
            environment: parsed.environment,
            resource: "checkout-service",
            provider: adapter.provider,
            data: result,
            durationMs: Date.now() - startTime,
          });
          return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
        }

        // --- MUTATION TOOLS ---
        if (name === "restart_service") {
          const parsed = RestartServiceInputSchema.parse(args);
          const adapter = getInfrastructureAdapter(parsed.environment);
          const result = await adapter.restartService(parsed.target);
          const envelope = wrapToolResult({
            tool: name,
            environment: parsed.environment,
            resource: parsed.target,
            provider: adapter.provider,
            data: result,
            durationMs: Date.now() - startTime,
            technicalStatus: result.technicalStatus,
            operationId: result.operationId,
          });
          return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
        }

        if (name === "rollback_canary") {
          const parsed = RollbackCanaryInputSchema.parse(args);
          const adapter = getInfrastructureAdapter(parsed.environment);
          const result = await adapter.rollbackCanary(
            parsed.serviceId,
            parsed.replicaId,
            parsed.targetVersion
          );
          const envelope = wrapToolResult({
            tool: name,
            environment: parsed.environment,
            resource: parsed.replicaId,
            provider: adapter.provider,
            data: result,
            durationMs: Date.now() - startTime,
            technicalStatus: result.technicalStatus,
            operationId: result.operationId,
          });
          return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
        }

        if (name === "rollback_full") {
          const parsed = RollbackFullInputSchema.parse(args);
          const adapter = getInfrastructureAdapter(parsed.environment);
          const result = await adapter.rollbackFull(parsed.serviceId, parsed.targetVersion);
          const envelope = wrapToolResult({
            tool: name,
            environment: parsed.environment,
            resource: parsed.serviceId,
            provider: adapter.provider,
            data: result,
            durationMs: Date.now() - startTime,
            technicalStatus: result.technicalStatus,
            operationId: result.operationId,
          });
          return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
        }

        // --- REHEARSAL TOOLS ---
        if (name === "inject_process_crash") {
          const parsed = InjectProcessCrashInputSchema.parse(args);
          const adapter = getInfrastructureAdapter(parsed.environment);
          const result = await adapter.injectProcessCrash(parsed.targetReplica);
          const envelope = wrapToolResult({
            tool: name,
            environment: parsed.environment,
            resource: parsed.targetReplica,
            provider: adapter.provider,
            data: result,
            durationMs: Date.now() - startTime,
          });
          return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
        }

        if (name === "inject_bad_deployment") {
          const parsed = InjectBadDeploymentInputSchema.parse(args);
          const adapter = getInfrastructureAdapter(parsed.environment);
          const result = await adapter.injectBadDeployment(parsed.targetReplica, parsed.badVersion);
          const envelope = wrapToolResult({
            tool: name,
            environment: parsed.environment,
            resource: parsed.targetReplica,
            provider: adapter.provider,
            data: result,
            durationMs: Date.now() - startTime,
          });
          return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
        }

        if (name === "inject_ambiguous_failure") {
          const parsed = InjectAmbiguousFailureInputSchema.parse(args);
          const adapter = getInfrastructureAdapter(parsed.environment);
          const result = await adapter.injectAmbiguousFailure(parsed.probability);
          const envelope = wrapToolResult({
            tool: name,
            environment: parsed.environment,
            resource: "checkout-service",
            provider: adapter.provider,
            data: result,
            durationMs: Date.now() - startTime,
          });
          return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
        }

        if (name === "reset_environment") {
          const parsed = ResetEnvironmentInputSchema.parse(args);
          const adapter = getInfrastructureAdapter(parsed.environment);
          const result = await adapter.resetEnvironment();
          const envelope = wrapToolResult({
            tool: name,
            environment: parsed.environment,
            resource: "cluster",
            provider: adapter.provider,
            data: result,
            durationMs: Date.now() - startTime,
          });
          return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
        }

        throw new RunSafeOperationalError("UNSUPPORTED_OPERATION", `Unknown or unregistered tool: "${name}"`);
      } catch (err: unknown) {
        const envelope = wrapToolError({
          tool: name,
          environment: (args as any)?.environment || "LOCAL",
          resource: (args as any)?.serviceId || (args as any)?.target || (args as any)?.resourceId || "unknown",
          provider: "RUNSAFE_MCP",
          error: err,
          durationMs: Date.now() - startTime,
        });
        return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
      }
    });

    return server;
  }

  public getExecutionStats(): { executionCount: number; executedActionIds: string[] } {
    return {
      executionCount: this.guardedExecutionCount,
      executedActionIds: Array.from(this.executedActionIds),
    };
  }

  public createTestServer(): Server {
    return this.createServerInstance();
  }

  public async start(port = 4001, host = "127.0.0.1"): Promise<string> {
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer(async (req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }

        const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

        // Health check endpoint
        if (url.pathname === "/health" && req.method === "GET") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "ok",
              service: "runsafe-mcp",
              mode: this.mode,
              uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
            })
          );
          return;
        }

        // SSE Connection Endpoint
        if (url.pathname === "/sse" && req.method === "GET") {
          const server = this.createServerInstance();
          const transport = new SSEServerTransport("/message", res);
          const sessionId = transport.sessionId;
          this.activeSessions.set(sessionId, { server, transport });

          transport.onclose = () => {
            this.activeSessions.delete(sessionId);
          };

          await server.connect(transport);
          return;
        }

        // POST Message Endpoint
        if (url.pathname === "/message" && req.method === "POST") {
          const sessionId = url.searchParams.get("sessionId");
          if (!sessionId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Missing sessionId query parameter" }));
            return;
          }

          const session = this.activeSessions.get(sessionId);
          if (!session) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Session not found or expired" }));
            return;
          }

          await session.transport.handlePostMessage(req, res);
          return;
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }));
      });

      this.httpServer.on("error", reject);

      this.httpServer.listen(port, host, () => {
        const serverUrl = `http://${host}:${port}/sse`;
        resolve(serverUrl);
      });
    });
  }

  public async stop(): Promise<void> {
    for (const session of this.activeSessions.values()) {
      await session.transport.close().catch(() => {});
    }
    this.activeSessions.clear();

    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer?.close(() => resolve());
      });
      this.httpServer = null;
    }
  }
}

// Standalone runner if executed directly
if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  const port = Number(process.env.MCP_SERVER_PORT) || 4001;
  const host = process.env.MCP_SERVER_HOST || "127.0.0.1";
  const mcpServer = new RunSafeMcpServer();

  mcpServer
    .start(port, host)
    .then((url) => {
      console.log(`[RunSafe MCP] Server listening at ${url}`);
      console.log(`[RunSafe MCP] Active capability mode: ${mcpServer.getCapabilityMode()}`);
    })
    .catch((err) => {
      console.error("[RunSafe MCP] Failed to start:", err);
      process.exit(1);
    });

  const shutdown = async () => {
    console.log("[RunSafe MCP] Shutting down...");
    await mcpServer.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

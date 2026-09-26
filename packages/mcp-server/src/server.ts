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
} from "@runsafe/shared";

export class RunSafeMcpServer {
  private httpServer: http.Server | null = null;
  private activeSessions: Map<string, { server: Server; transport: SSEServerTransport }> = new Map();
  private guardedExecutionCount = 0;
  private executedActionIds: Set<string> = new Set();
  private startTime = Date.now();

  private createServerInstance(): Server {
    const server = new Server(
      {
        name: "runsafe-mcp",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // 1. List tools handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
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
          },
        ],
      };
    });

    // 2. Call tool handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === "get_runtime_status") {
        const statusPayload: RuntimeStatus = {
          service: "runsafe-mcp",
          status: "healthy",
          timestamp: new Date().toISOString(),
          runtime: `node ${process.version}`,
          environment: process.env.NODE_ENV ?? "development",
          version: "0.1.0",
          nodeVersion: process.version,
          uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
        };

        const validated = RuntimeStatusSchema.parse(statusPayload);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(validated, null, 2),
            },
          ],
        };
      }

      if (name === "stage1_guarded_noop") {
        const parsed = GuardedNoopInputSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(
            `Invalid input for stage1_guarded_noop: ${parsed.error.message}`
          );
        }

        const { actionId } = parsed.data;
        this.guardedExecutionCount += 1;
        this.executedActionIds.add(actionId);

        const output: GuardedNoopOutput = {
          executed: true,
          actionId,
          executionCount: this.guardedExecutionCount,
          timestamp: new Date().toISOString(),
          note: "Harmless gated no-op executed successfully after approval checkpoint.",
        };

        const validated = GuardedNoopOutputSchema.parse(output);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(validated, null, 2),
            },
          ],
        };
      }

      throw new Error(`Unknown or unregistered tool: "${name}"`);
    });

    return server;
  }

  public getExecutionStats(): { executionCount: number; executedActionIds: string[] } {
    return {
      executionCount: this.guardedExecutionCount,
      executedActionIds: Array.from(this.executedActionIds),
    };
  }

  // Exposed for unit testing direct tool calls
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
      console.log(`[RunSafe MCP] Tools registered: get_runtime_status, stage1_guarded_noop`);
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

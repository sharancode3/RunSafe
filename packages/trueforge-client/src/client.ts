import type { RunSafeEventEnvelope } from "@runsafe/shared";
import { normalizeTrueForgeEvent } from "./normalizer.js";

export interface TrueForgeClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

export interface ModelProviderManifest {
  type: string;
  name?: string;
  base_url?: string;
  auth: { api_key: string };
  models: Array<{
    model_id: string;
    name: string;
    properties?: {
      context_length?: number;
      max_output_tokens?: number;
      reasoning_efforts?: string[];
    };
  }>;
}

export interface MCPServerManifest {
  type: "remote";
  name: string;
  url: string;
  description: string;
}

export interface AgentSpec {
  model: { name: string };
  instructions?: string;
  mcp_servers?: Array<{
    name: string;
    enable_tools?: string[];
    disable_tools?: string[];
    require_approval_for_tools?: string[];
  }>;
  config?: Record<string, unknown>;
}

export interface CreateAgentParams {
  name: string;
  description: string;
  manifest: AgentSpec;
}

export interface TurnState {
  status: "running" | "done" | "failed" | "cancelled";
  output?: {
    type?: string;
    content?: string;
    [key: string]: unknown;
  };
  events?: any[];
  approval_required?: {
    thread_id: string;
    tool_call_id: string;
    tool_name?: string;
    arguments?: Record<string, unknown>;
  };
}

export interface TurnResponse {
  id: string;
  session_id: string;
  previous_turn_id: string | null;
  state: TurnState;
  events?: any[];
}

export class TrueForgeClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: TrueForgeClientConfig = {}) {
    this.baseUrl = (config.baseUrl || "http://localhost:8790").replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs || 30000;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...options.headers,
        },
      });

      const responseText = await response.text();
      let parsed: any;
      try {
        parsed = responseText ? JSON.parse(responseText) : {};
      } catch {
        parsed = { raw: responseText };
      }

      if (!response.ok) {
        const errorMsg =
          parsed?.error?.message ||
          parsed?.message ||
          `HTTP ${response.status} ${response.statusText}`;
        throw new Error(`TrueForge API error (${path}): ${errorMsg}`);
      }

      return parsed as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Health and catalog checks
  public async checkHealth(): Promise<{ ok: boolean; version?: string; error?: string }> {
    try {
      await this.request<any>("/api/v1/settings/model-providers");
      return { ok: true, version: "0.2.1" };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  // Model Provider APIs
  public async getModelProviders(): Promise<any[]> {
    const res = await this.request<{ data: any[] }>("/api/v1/settings/model-providers");
    return res.data || [];
  }

  public async registerModelProvider(manifest: ModelProviderManifest): Promise<any> {
    return this.request<any>("/api/v1/settings/model-providers", {
      method: "POST",
      body: JSON.stringify({ manifest }),
    });
  }

  // MCP Server APIs
  public async getMCPServers(): Promise<any[]> {
    const res = await this.request<{ data: any[] }>("/api/v1/settings/mcp-servers");
    return res.data || [];
  }

  public async registerMCPServer(manifest: MCPServerManifest): Promise<any> {
    return this.request<any>("/api/v1/settings/mcp-servers", {
      method: "POST",
      body: JSON.stringify({ manifest }),
    });
  }

  // Agent APIs
  public async getAgents(): Promise<any[]> {
    const res = await this.request<{ data: any[] }>("/api/v1/agents");
    return res.data || [];
  }

  public async getAgent(name: string): Promise<any | null> {
    try {
      const res = await this.request<{ data: any }>(`/api/v1/agents/${name}`);
      return res.data;
    } catch {
      return null;
    }
  }

  public async createAgent(params: CreateAgentParams): Promise<any> {
    return this.request<any>("/api/v1/agents", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  public async updateAgent(name: string, manifest: AgentSpec): Promise<any> {
    return this.request<any>(`/api/v1/agents/${name}`, {
      method: "PUT",
      body: JSON.stringify({ manifest }),
    });
  }

  // Session & Turn APIs
  public async createSession(agentName: string): Promise<{ id: string; agent: any }> {
    const res = await this.request<{ data: { id: string; agent: any } }>("/api/v1/sessions", {
      method: "POST",
      body: JSON.stringify({
        agent: { name: agentName },
      }),
    });
    return res.data;
  }

  public async runTurn(
    sessionId: string,
    prompt: string,
    previousTurnId?: string
  ): Promise<TurnResponse> {
    const payload: Record<string, unknown> = {
      input: [
        {
          type: "user.message",
          content: [{ type: "text", text: prompt }],
        },
      ],
      stream: false,
    };
    if (previousTurnId) {
      payload.previous_turn_id = previousTurnId;
    }

    const res = await this.request<{ data: TurnResponse }>(`/api/v1/sessions/${sessionId}/turns`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  public async getTurn(sessionId: string, turnId: string): Promise<TurnResponse> {
    const res = await this.request<{ data: TurnResponse }>(
      `/api/v1/sessions/${sessionId}/turns/${turnId}`
    );
    return res.data;
  }

  public async getTurnEvents(sessionId: string, turnId: string): Promise<any[]> {
    try {
      const res = await this.request<{ data: any[] }>(
        `/api/v1/sessions/${sessionId}/turns/${turnId}/events`
      );
      return res.data || [];
    } catch {
      return [];
    }
  }

  /**
   * Resume an agent turn blocked on human checkpoint / approval.
   */
  public async resumeApproval(
    sessionId: string,
    threadId: string,
    toolCallId: string,
    allow: boolean,
    reason?: string
  ): Promise<TurnResponse> {
    const approvalDecision = allow
      ? { status: "allow" }
      : { status: "deny", reason: reason || "User rejected execution" };

    const res = await this.request<{ data: TurnResponse }>(`/api/v1/sessions/${sessionId}/turns`, {
      method: "POST",
      body: JSON.stringify({
        input: [
          {
            type: "user.tool_approval",
            thread_id: threadId,
            tool_call_id: toolCallId,
            approval: approvalDecision,
          },
        ],
        stream: false,
      }),
    });
    return res.data;
  }

  /**
   * Poll until a turn reaches terminal state ('done' or 'failed') or pauses for approval.
   */
  public async waitForTurn(
    sessionId: string,
    turnId: string,
    timeoutMs = 60000,
    pollIntervalMs = 1000
  ): Promise<{
    turn: TurnResponse;
    approvalRequired?: { threadId: string; toolCallId: string; toolName?: string };
    normalizedEvents: RunSafeEventEnvelope[];
  }> {
    const start = Date.now();
    const seenEvents = new Set<string>();
    const normalizedEvents: RunSafeEventEnvelope[] = [];

    while (Date.now() - start < timeoutMs) {
      const turn = await this.getTurn(sessionId, turnId);
      const events = await this.getTurnEvents(sessionId, turnId);

      // 1. Check required_actions on turn state
      const reqActions = (turn.state as any)?.required_actions || [];
      for (const act of reqActions) {
        if (act.type === "tool.approval_required") {
          const threadId = act.thread_id || "main";
          const toolCallId = act.tool_calls?.[0]?.id || act.tool_call_id;
          if (toolCallId) {
            return {
              turn,
              approvalRequired: {
                threadId,
                toolCallId,
                toolName: act.tool_name,
              },
              normalizedEvents,
            };
          }
        }
      }

      // 2. Check turn events
      for (const ev of events) {
        const evKey = JSON.stringify(ev);
        if (!seenEvents.has(evKey)) {
          seenEvents.add(evKey);
          const normalized = normalizeTrueForgeEvent(ev, sessionId, turnId);
          if (normalized) normalizedEvents.push(normalized);

          if (ev.type === "tool.approval_required") {
            const threadId = ev.thread_id || "main";
            const toolCallId = ev.tool_calls?.[0]?.id || ev.tool_call_id;
            if (toolCallId) {
              return {
                turn,
                approvalRequired: {
                  threadId,
                  toolCallId,
                  toolName: ev.tool_name,
                },
                normalizedEvents,
              };
            }
          }
        }
      }

      if (turn.state?.status === "done" || turn.state?.status === "failed") {
        return { turn, normalizedEvents };
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    throw new Error(`Turn ${turnId} timed out after ${timeoutMs}ms`);
  }
}

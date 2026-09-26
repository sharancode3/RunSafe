import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("127.0.0.1"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  TRUEFORGE_URL: z.string().url().default("http://localhost:8790"),
  RUNSAFE_AGENT_NAME: z.string().default("runsafe-agent"),
  MCP_SERVER_URL: z.string().url().default("http://127.0.0.1:4001/sse"),
  MCP_HEALTH_URL: z.string().url().default("http://127.0.0.1:4001/health"),
  OPENAI_API_KEY: z.string().optional(),
  DAYTONA_API_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!_config) {
    _config = ConfigSchema.parse(process.env);
  }
  return _config;
}

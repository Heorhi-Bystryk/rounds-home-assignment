import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  LISTING_SOURCE_BASE_URL: z.string().url().default("http://localhost:4002"),
  LLM_BASE_URL: z.string().url().default("http://localhost:4001/v1"),
  LLM_API_KEY: z.string().default("mock"),
  LLM_MODEL: z.string().default("mock-llm"),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(900_000),
  SOURCE_RATE_PER_SECOND: z.coerce.number().positive().default(5),
  LLM_DAILY_CAP: z.coerce.number().int().nonnegative().default(2000),
  SOURCE_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  RETENTION_DAYS: z.coerce.number().int().positive().default(90),
});

export type AppConfig = {
  databaseUrl: string;
  port: number;
  listingSourceBaseUrl: string;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  pollIntervalMs: number;
  sourceRatePerSecond: number;
  llmDailyCap: number;
  sourceTimeoutMs: number;
  llmTimeoutMs: number;
  retentionDays: number;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.parse(env);
  return {
    databaseUrl: parsed.DATABASE_URL,
    port: parsed.PORT,
    listingSourceBaseUrl: parsed.LISTING_SOURCE_BASE_URL,
    llmBaseUrl: parsed.LLM_BASE_URL,
    llmApiKey: parsed.LLM_API_KEY,
    llmModel: parsed.LLM_MODEL,
    pollIntervalMs: parsed.POLL_INTERVAL_MS,
    sourceRatePerSecond: parsed.SOURCE_RATE_PER_SECOND,
    llmDailyCap: parsed.LLM_DAILY_CAP,
    sourceTimeoutMs: parsed.SOURCE_TIMEOUT_MS,
    llmTimeoutMs: parsed.LLM_TIMEOUT_MS,
    retentionDays: parsed.RETENTION_DAYS,
  };
}

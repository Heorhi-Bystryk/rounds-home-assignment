import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";

describe("loadConfig", () => {
  it("applies the production defaults", () => {
    const config = loadConfig({ DATABASE_URL: "postgresql://localhost:5432/pulse" });
    expect(config).toMatchObject({
      port: 3000,
      listingSourceBaseUrl: "http://localhost:4002",
      llmBaseUrl: "http://localhost:4001/v1",
      llmApiKey: "mock",
      pollIntervalMs: 900_000,
      sourceRatePerSecond: 5,
      llmDailyCap: 2000,
      sourceTimeoutMs: 10_000,
      llmTimeoutMs: 15_000,
      retentionDays: 90,
    });
  });

  it("rejects a missing database url", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });
});

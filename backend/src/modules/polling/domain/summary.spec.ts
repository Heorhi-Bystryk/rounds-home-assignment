import { describe, expect, it } from "vitest";
import { buildPrompt, resumePendingSummary, summarizePrompt } from "./summary";

const previous = {
  listingState: "listed" as const,
  title: "Acme",
  tagline: "Simple CRM",
  description: "Track deals.",
  priceDisplay: "$39/mo",
};
const next = {
  listingState: "listed" as const,
  title: "Acme",
  tagline: "The CRM small teams love",
  description: "Track deals. Now with AI follow-up.",
  priceDisplay: "$29/mo",
};

describe("buildPrompt", () => {
  it("includes previous and next listing fields", () => {
    const prompt = buildPrompt(previous, next);
    expect(prompt).toContain("$39/mo");
    expect(prompt).toContain("$29/mo");
    expect(prompt).toContain("Simple CRM");
    expect(prompt).toContain("The CRM small teams love");
    expect(prompt).toContain("Track deals.");
    expect(prompt).toContain("Now with AI follow-up.");
  });
});

describe("summarizePrompt", () => {
  it("does not call the model when the cap is spent", async () => {
    let calls = 0;
    const result = await summarizePrompt({
      prompt: buildPrompt(previous, next),
      reserve: async () => false,
      complete: async (prompt) => {
        calls += 1;
        return { status: "ready", summary: prompt };
      },
    });
    expect(result).toEqual({ summaryStatus: "llm_cap_reached", summary: null });
    expect(calls).toBe(0);
  });

  it("keeps a timeout, an unusable reply, and the daily cap distinct", async () => {
    await expect(
      summarizePrompt({
        prompt: "previous\nnext",
        reserve: async () => true,
        complete: async () => ({ status: "llm_timeout" }),
      }),
    ).resolves.toEqual({ summaryStatus: "llm_timeout", summary: null });
    await expect(
      summarizePrompt({
        prompt: "previous\nnext",
        reserve: async () => true,
        complete: async () => ({ status: "llm_unusable" }),
      }),
    ).resolves.toEqual({ summaryStatus: "llm_unusable", summary: null });
    let calls = 0;
    await expect(
      summarizePrompt({
        prompt: "previous\nnext",
        reserve: async () => false,
        complete: async () => {
          calls += 1;
          return { status: "ready", summary: "unused" };
        },
      }),
    ).resolves.toEqual({ summaryStatus: "llm_cap_reached", summary: null });
    expect(calls).toBe(0);
  });

  it("stores a failure without throwing", async () => {
    const result = await summarizePrompt({
      prompt: buildPrompt(previous, {
        listingState: "unlisted",
        title: null,
        tagline: null,
        description: null,
        priceDisplay: null,
      }),
      reserve: async () => true,
      complete: async () => ({ status: "llm_failed" }),
    });
    expect(result.summaryStatus).toBe("llm_failed");
  });
});

describe("resumePendingSummary", () => {
  it("passes a stored failure reason through", async () => {
    await expect(
      resumePendingSummary({
        prompt: "previous\nnext",
        reserve: async () => true,
        complete: async () => ({ status: "llm_timeout" }),
      }),
    ).resolves.toEqual({ summaryStatus: "llm_timeout", summary: null });
  });

  it("records llm_failed when the stored prompt is missing", async () => {
    let calls = 0;
    await expect(
      resumePendingSummary({
        prompt: null,
        reserve: async () => {
          calls += 1;
          return true;
        },
        complete: async () => {
          calls += 1;
          return { status: "ready", summary: "unused" };
        },
      }),
    ).resolves.toEqual({ summaryStatus: "llm_failed", summary: null });
    expect(calls).toBe(0);
  });
});

import type { LlmResult } from "../../../integrations/llm-client";

export type PromptState = {
  listingState: "unknown" | "listed" | "unlisted";
  title: string | null;
  tagline: string | null;
  description: string | null;
  priceDisplay: string | null;
};

export type SummaryWrite = {
  summaryStatus: "ready" | "llm_failed" | "llm_timeout" | "llm_unusable" | "llm_cap_reached";
  summary: string | null;
};

export function buildPrompt(previous: PromptState, next: PromptState): string {
  const line = (label: string, state: PromptState) =>
    [
      `${label}: state=${state.listingState}`,
      `title=${state.title ?? "none"}`,
      `tagline=${state.tagline ?? "none"}`,
      `price=${state.priceDisplay ?? "none"}`,
      `description=${state.description ?? "none"}`,
    ].join(", ");
  return [
    "Explain in plain English what changed for a product manager.",
    "Reply in 1-2 sentences.",
    "Compare title, tagline, price, and description.",
    line("Previous", previous),
    line("Next", next),
  ].join("\n");
}

export async function summarizePrompt(input: {
  prompt: string;
  reserve: () => Promise<boolean>;
  complete: (prompt: string) => Promise<LlmResult>;
}): Promise<SummaryWrite> {
  const allowed = await input.reserve();
  if (!allowed) {
    return { summaryStatus: "llm_cap_reached", summary: null };
  }
  const result = await input.complete(input.prompt);
  if (result.status === "ready") {
    return { summaryStatus: "ready", summary: result.summary };
  }
  return { summaryStatus: result.status, summary: null };
}

export async function resumePendingSummary(input: {
  prompt: string | null;
  reserve: () => Promise<boolean>;
  complete: (prompt: string) => Promise<LlmResult>;
}): Promise<SummaryWrite> {
  if (!input.prompt) {
    return { summaryStatus: "llm_failed", summary: null };
  }
  return summarizePrompt({
    prompt: input.prompt,
    reserve: input.reserve,
    complete: input.complete,
  });
}

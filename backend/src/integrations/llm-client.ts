export type LlmResult =
  | { status: "ready"; summary: string }
  | { status: "llm_timeout" | "llm_failed" | "llm_unusable" };

export type LlmClient = {
  summarize(prompt: string): Promise<LlmResult>;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function createLlmClient(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  fetch?: FetchLike;
}): LlmClient {
  const fetchImpl = options.fetch ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");

  return {
    async summarize(prompt: string): Promise<LlmResult> {
      try {
        const response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${options.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: options.model,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: AbortSignal.timeout(options.timeoutMs),
        });
        if (!response.ok) {
          return { status: "llm_failed" };
        }
        const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
        const content = payload.choices?.[0]?.message?.content;
        if (typeof content !== "string" || content.trim() === "") {
          return { status: "llm_unusable" };
        }
        return { status: "ready", summary: content.trim() };
      } catch (error) {
        const name = error instanceof Error ? error.name : "";
        return name === "TimeoutError" || name === "AbortError"
          ? { status: "llm_timeout" }
          : { status: "llm_failed" };
      }
    },
  };
}

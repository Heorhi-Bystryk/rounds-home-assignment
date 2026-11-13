import { describe, expect, it } from "vitest";
import { createLlmClient } from "./llm-client";

describe("createLlmClient", () => {
  it("posts an OpenAI chat completion and returns the text", async () => {
    let seen: unknown;
    const client = createLlmClient({
      baseUrl: "http://llm.test/v1",
      apiKey: "mock",
      model: "mock-llm",
      timeoutMs: 1000,
      fetch: async (_url, init) => {
        seen = JSON.parse(String(init?.body));
        return Response.json({ choices: [{ message: { content: "Price dropped." } }] });
      },
    });
    await expect(client.summarize("previous\nnext")).resolves.toEqual({ status: "ready", summary: "Price dropped." });
    expect(seen).toMatchObject({ model: "mock-llm", messages: [{ role: "user", content: "previous\nnext" }] });
  });

  it("reports timeout, failure, and an empty body separately", async () => {
    const timeout = createLlmClient({
      baseUrl: "http://llm.test/v1",
      apiKey: "mock",
      model: "mock-llm",
      timeoutMs: 1000,
      fetch: async () => {
        throw new DOMException("aborted", "TimeoutError");
      },
    });
    const failed = createLlmClient({
      baseUrl: "http://llm.test/v1",
      apiKey: "mock",
      model: "mock-llm",
      timeoutMs: 1000,
      fetch: async () => new Response("nope", { status: 500 }),
    });
    const empty = createLlmClient({
      baseUrl: "http://llm.test/v1",
      apiKey: "mock",
      model: "mock-llm",
      timeoutMs: 1000,
      fetch: async () => Response.json({ choices: [{ message: { content: "  " } }] }),
    });
    await expect(timeout.summarize("x")).resolves.toEqual({ status: "llm_timeout" });
    await expect(failed.summarize("x")).resolves.toEqual({ status: "llm_failed" });
    await expect(empty.summarize("x")).resolves.toEqual({ status: "llm_unusable" });
  });
});

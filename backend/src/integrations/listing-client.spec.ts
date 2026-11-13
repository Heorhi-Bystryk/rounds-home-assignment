import { describe, expect, it } from "vitest";
import { createListingClient } from "./listing-client";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

describe("createListingClient", () => {
  it("returns a rate limit and does not parse a listing", async () => {
    const client = createListingClient({
      baseUrl: "http://source.test",
      timeoutMs: 10_000,
      fetch: async () => jsonResponse(429, { error: "rate_limited" }, { "retry-after": "3" }),
    });
    await expect(client.fetchListing("acme-crm")).resolves.toEqual({ status: "rate_limited", retryAfterSeconds: 3 });
  });

  it("returns not_found on 404", async () => {
    const client = createListingClient({
      baseUrl: "http://source.test",
      timeoutMs: 10_000,
      fetch: async () => jsonResponse(404, { error: "not_found" }),
    });
    await expect(client.fetchListing("missing")).resolves.toEqual({ status: "not_found" });
  });

  it("returns error when a 502 body is HTML", async () => {
    const client = createListingClient({
      baseUrl: "http://source.test",
      timeoutMs: 10_000,
      fetch: async () => new Response("<html>502</html>", { status: 502 }),
    });
    await expect(client.fetchListing("acme-crm")).resolves.toEqual({ status: "error" });
  });

  it("returns timeout when the request aborts", async () => {
    const client = createListingClient({
      baseUrl: "http://source.test",
      timeoutMs: 10_000,
      fetch: async () => {
        throw new DOMException("The operation was aborted", "TimeoutError");
      },
    });
    await expect(client.fetchListing("acme-crm")).resolves.toEqual({ status: "timeout" });
  });

  it("returns the parsed body without interpreting it", async () => {
    const body = { title: "A", tagline: "B", price: "$1/mo", description: "C" };
    const client = createListingClient({
      baseUrl: "http://source.test",
      timeoutMs: 10_000,
      fetch: async () => jsonResponse(200, body),
    });
    await expect(client.fetchListing("acme-crm")).resolves.toEqual({ status: "ok", body });
  });

  it("returns error when a 200 body is not JSON", async () => {
    const client = createListingClient({
      baseUrl: "http://source.test",
      timeoutMs: 10_000,
      fetch: async () => new Response("<html>ok</html>", { status: 200 }),
    });
    await expect(client.fetchListing("acme-crm")).resolves.toEqual({ status: "error" });
  });

  it("encodes the id as one path segment", async () => {
    let seen = "";
    const client = createListingClient({
      baseUrl: "http://source.test",
      timeoutMs: 10_000,
      fetch: async (url) => {
        seen = String(url);
        return jsonResponse(200, { title: "A", tagline: "B", price: "$1/mo", description: "C" });
      },
    });
    await client.fetchListing("acme-crm");
    expect(seen).toBe("http://source.test/listings/acme-crm");
  });
});

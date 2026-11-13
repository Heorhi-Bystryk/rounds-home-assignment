export type ListingFetchResult =
  | { status: "ok"; body: unknown }
  | { status: "rate_limited"; retryAfterSeconds: number }
  | { status: "not_found" }
  | { status: "error" }
  | { status: "timeout" };

export type ListingClient = {
  fetchListing(id: string): Promise<ListingFetchResult>;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function createListingClient(options: {
  baseUrl: string;
  timeoutMs: number;
  fetch?: FetchLike;
}): ListingClient {
  const fetchImpl = options.fetch ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");

  return {
    async fetchListing(id: string): Promise<ListingFetchResult> {
      try {
        const response = await fetchImpl(`${baseUrl}/listings/${encodeURIComponent(id)}`, {
          signal: AbortSignal.timeout(options.timeoutMs),
        });
        if (response.status === 429) {
          const retryAfterHeader = Number(response.headers.get("retry-after"));
          return { 
            status: "rate_limited", 
            retryAfterSeconds: Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader : 1
          };
        }
        if (response.status === 404) {
          return { status: "not_found" };
        }
        if (!response.ok) {
          return { status: "error" };
        }
        const text = await response.text();
        try {
          return { status: "ok", body: JSON.parse(text) as unknown };
        } catch {
          return { status: "error" };
        }
      } catch {
        return { status: "timeout" };
      }
    },
  };
}

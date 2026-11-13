import type { PollStatus, SummaryStatus } from "./summary-reason";

const base = import.meta.env.VITE_API_BASE_URL ?? "";

export type CompetitorListItem = {
  id: string;
  changedLast24h: boolean;
};

export type Snapshot = {
  fetchedAt: string;
  title: string | null;
  tagline: string | null;
  price: string | null;
  description: string | null;
  changed: boolean;
  summary: string | null;
  pollStatus: PollStatus;
  summaryStatus: SummaryStatus;
};

export type ApiResult<T> = {
  status: number;
  body: T;
};

type ErrorBody = {
  error?: string;
};

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text };
  }
}

export async function listCompetitors(): Promise<ApiResult<CompetitorListItem[] | ErrorBody>> {
  const response = await fetch(`${base}/api/competitors`);
  const body = (await readJson(response)) as CompetitorListItem[] | ErrorBody;
  return { status: response.status, body };
}

export async function addCompetitor(
  id: string,
): Promise<ApiResult<{ id: string } | ErrorBody>> {
  const response = await fetch(`${base}/api/competitors`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const body = (await readJson(response)) as { id: string } | ErrorBody;
  return { status: response.status, body };
}

export async function removeCompetitor(id: string): Promise<ApiResult<ErrorBody | null>> {
  const response = await fetch(`${base}/api/competitors/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const body = (await readJson(response)) as ErrorBody | null;
  return { status: response.status, body };
}

export async function listSnapshots(
  id: string,
): Promise<ApiResult<Snapshot[] | ErrorBody>> {
  const response = await fetch(
    `${base}/api/competitors/${encodeURIComponent(id)}/snapshots`,
  );
  const body = (await readJson(response)) as Snapshot[] | ErrorBody;
  return { status: response.status, body };
}

export function errorText(body: unknown): string {
  if (body && typeof body === "object" && "error" in body) {
    const value = (body as ErrorBody).error;
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return "request_failed";
}

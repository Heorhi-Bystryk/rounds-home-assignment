# CompetitorPulse

Rounds home assignment — **Heorhi Bystryk**.

A small backend that tracks competitor listings, stores every poll, and asks an LLM to explain a change that would matter to a product manager. The React UI shows the competitor list (including who changed in the last 24 hours) and a newest-first timeline that says why a summary is missing.

## Run locally

Docker Compose starts Postgres, the listing source, the mock LLM, the API, and the UI. The API container runs Prisma migrations, then listens on port 3000. The UI is on port 8080 and proxies `/api` to the backend.

```bash
docker compose up --build
```

| Service | URL |
| --- | --- |
| UI | http://localhost:8080 |
| API | http://localhost:3000 |
| Listing source | http://localhost:4002 |
| Mock LLM | http://localhost:4001 |
| Postgres | `localhost:5432`, database `pulse`, user `pulse`, password `pulse` |

Add a competitor and read its timeline:

```bash
curl -s -X POST http://localhost:3000/api/competitors \
  -H 'content-type: application/json' \
  -d '{"id":"acme-crm"}'

curl -s http://localhost:3000/api/competitors/acme-crm/snapshots
```

The first snapshot appears after the worker polls. The default interval is 15 minutes. For a faster local check, set `POLL_INTERVAL_MS=5000` on the `backend` service and start again.

Unchanged polls do not call the model. `GET http://localhost:4001/control/stats` returns `{ "callCount": N }`. That count stays flat across polls whose canonical fields did not change.

`npm test` in `backend/` runs the unit tests. Integration tests use a separate Postgres from `backend/docker-compose.test.yml` (`pulse_test` on port `5433`), so they never touch the app database:

```bash
cd backend
npm run test:integration
```

That script starts the test Postgres if needed, applies migrations, then runs.

## Configuration

With `docker compose`, change variables on the `backend` service in `docker-compose.yml` — that is what the container reads. For a backend process on the host, copy `backend/.env.example` to `backend/.env`.

| Variable | Default | Role |
| --- | --- | --- |
| `LISTING_SOURCE_BASE_URL` | `http://localhost:4002` | Only listings are fetched, via `GET {base}/listings/:id`. |
| `LLM_BASE_URL` | `http://localhost:4001/v1` | OpenAI Chat Completions base URL. The client posts to `{base}/chat/completions`. |
| `LLM_API_KEY` | `mock` | Bearer token. The mock accepts any string. |
| `LLM_MODEL` | `mock-llm` | `model` field on the chat request. |
| `POLL_INTERVAL_MS` | `900000` | Earliest gap before the same competitor is due again. |
| `SOURCE_RATE_PER_SECOND` | `5` | Token-bucket ceiling for listing requests. |
| `LLM_DAILY_CAP` | `2000` | UTC-day cap on model calls. |
| `SOURCE_TIMEOUT_MS` | `10000` | Listing fetch abort. |
| `LLM_TIMEOUT_MS` | `15000` | Model call abort. |
| `RETENTION_DAYS` | `90` | Snapshot rows older than this are deleted. Competitors stay. |
| `DATABASE_URL` | — | Required. Postgres connection string. |
| `PORT` | `3000` | API port. |

### Point the API at another listing source

Set `LISTING_SOURCE_BASE_URL` to the other origin, with no `/listings` suffix. Example: `http://reviewer-host:4002`. The worker never imports the source and never reads `listings.json`.

Inside Compose the default is `http://listing-source:4002`, which is the bundled source on the Docker network. From a process on the host, use `http://localhost:4002`.

### Which LLM

The default is the bundled mock. It speaks the OpenAI Chat Completions shape and echoes a snippet of the prompt. It does not write a real summary. `POST http://localhost:4001/control/configure` with `{ "latencyMs": 20000, "failNext": 1 }` makes the next call slow or a 500.

A real OpenAI-compatible provider is the same client with different settings:

```bash
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
```

Put the key in the environment or in Compose. Do not commit it.

## API

No authentication. One internal user is assumed.

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/api/competitors` | `[{ "id", "changedLast24h" }]`, oldest created first |
| `POST` | `/api/competitors` | `201` `{ "id" }`. Body `{ "id": string }`. `400` illegal id, `409` duplicate |
| `DELETE` | `/api/competitors/:id` | `204`. Snapshots go with the competitor. `404` if it is not tracked |
| `GET` | `/api/competitors/:id/snapshots` | Newest first. `404` if the id is not tracked |

Ids are trimmed and lowercased. A legal id matches `^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$`, so `Acme-CRM` is stored as `acme-crm`. Empty strings, spaces, and path segments such as `../x` are rejected and are not stored. `POST` does not call the listing source.

A snapshot has the fields from the brief (`fetchedAt`, `title`, `tagline`, `price`, `description`, `changed`, `summary`) plus `pollStatus` and `summaryStatus`. `summary` is `null` until a sentence exists. `summaryStatus` is why.

| `summaryStatus` | Meaning |
| --- | --- |
| `no_previous` | First good listing. It becomes the baseline. No model call. |
| `no_material_change` | Canonical fields match the baseline, including a relist of the same copy. |
| `pending` | A material change is stored. The summary is still in flight, or the process stopped before it was written. |
| `ready` | `summary` holds the model text. |
| `llm_timeout` | The model did not answer within `LLM_TIMEOUT_MS`. |
| `llm_failed` | The model returned a non-200 response, or the call threw. |
| `llm_unusable` | The body had no text. |
| `llm_cap_reached` | The UTC day already used `LLM_DAILY_CAP` calls. This poll did not call. |
| `poll_failed` | The listing source failed, timed out, returned a partial body, or 404'd an id that was not currently listed. |

`changedLast24h` is true when `lastMaterialAt` falls in the last 24 hours.

## Decisions

### What counts as a change

The worker compares one canonical baseline stored on the competitor: title, tagline, description, price amount, currency, period, and listing state (`unknown`, `listed`, `unlisted`).

Text is trimmed, `&amp;` and `&nbsp;` are decoded, and whitespace is collapsed. Price is compared as amount, currency, and period. Only the source currencies are structured: `$` / `USD`, `€` / `EUR`, `£` / `GBP`. So `$29/mo`, `$29.00/mo`, `$29 / month`, and `USD 29 per month` are the same price, but `$29/mo` to `€29/mo` is a change. Zero prices (`Free`, `Free forever`, `$0/mo`) are one value. Any other currency marker, or a string that does not match those patterns, is compared as the collapsed raw text. Per-request fields (`renderedAt`, `requestId`, `promoBanner`, `viewerCount`, `cache`, key order) are ignored.

A missing, empty, or non-string field is `partial`. An HTTP 5xx, HTML error page, or non-JSON 200 is `error`. A fetch that throws, including the 10 second abort, is `timeout`. Those three keep the previous baseline and do not call the model. `nextPollAt` still moves forward, so one dead id does not stay at the head of the queue.

The first good listing after `unknown` is `changed: false` and `no_previous`. A later listing with the same canonical fields is `no_material_change`. A later listing with a different title, tagline, description, or price is material, and so is a `404` after the competitor was `listed` (it was delisted). A `404` while the state is still `unknown` or already `unlisted` is `poll_failed`, not a change. A relist of the same canonical copy is `no_material_change`: the state returns to `listed`, and the 24-hour flag does not flip.

**Considered instead:** treating every raw difference as material, and treating a delist as just another failed poll. Format noise would burn the daily model cap. A silent delist would hide the event the timeline is for.

### Unknown ids

The source does not advertise which ids exist, and `POST` does not ask it. An unknown id is tracked immediately. Polls record `not_found` until a listing appears. The first real listing then establishes the baseline.

**Considered instead:** calling the source inside `POST` and rejecting a 404. That makes add depend on a slow, flaky service, and a competitor can be absent now and listed later.

### Rate limit, and why the scheduler stays single-flight

One process polls the oldest due competitor, waits for a token (default 5 per second), then issues one `GET`. The bucket is the client-side ceiling from the brief: refill at `SOURCE_RATE_PER_SECOND`, capacity equal to that rate, so a short burst is fine and the next `take` sleeps only until one token exists. On `429` it pauses the same gate for `Retry-After` seconds (or 1 second when the header is missing). It does not write a snapshot and does not move `nextPollAt`. A refusal is backpressure, not an observation. After the pause, the same oldest id is tried again.

**Considered instead:** a fixed `sleep(1000 / rate)` after every fetch, and pacing only by waiting on `429`. Fixed sleep still charges the full gap after a slow response and never uses a free burst. Reactive-only pacing would work, but every excess call is wasted, and `Retry-After` is coarser than staying under 5/second before the request leaves. The bucket keeps the steady rate; `Retry-After` is the fallback when the client and source disagree.

The model call starts only after that snapshot transaction commits, and the loop does not wait for it. A slow or failed model cannot drop the poll and cannot hold the next listing fetch. One attempt, with its own 15 second timeout.

The worker keeps a single listing request in flight. The source limit is global, so extra workers would share the same 5 requests/second and mostly collect `429`s. A cron burst of all ids every 15 minutes would do the same. A pool of in-flight requests would fill the bucket more tightly when the source is slow (tens of milliseconds to about 800 ms, sometimes about 8 seconds, client abort at 10). It would not raise the ceiling. The source still allows 5 requests/second in total.

`POLL_INTERVAL_MS` is the earliest time that same competitor is due again. It is not a promise that every competitor is visited inside the interval.

### The production numbers do not fit

6,000 competitors every 15 minutes need about 6.7 listing requests/second. The source allows 5. With no retries, 5 requests/second covers 4,500 polls in 15 minutes, and 6,000 polls take 1,200 seconds, which is 20 minutes. Timeouts and 5xx responses make the slip larger.

What this process does: keep the 5/second ceiling, poll oldest-due first, record failures, and let `nextPollAt` slide. The queue stays fair. `POLL_INTERVAL_MS=15m` is only the earliest re-poll after an observation, not a throughput promise. Past about 4,500 competitors the queue slips and the gap between polls for the same id becomes uneven; at 6,000 the floor is already about 20 minutes.

If the expected load is 6,000 competitors, set the interval to 20 minutes up front so the cadence stays even under the rate limit, instead of keeping a 15-minute target that the queue cannot sustain.

### LLM cap

A material change reserves one slot in `LlmDailyUsage` for the UTC day with `INSERT ... ON CONFLICT DO UPDATE ... WHERE count < cap`. The reserve happens before the HTTP call, so a timeout, a 500, or an empty body still consumes a slot. When the cap is spent, the snapshot stays and `summaryStatus` is `llm_cap_reached`.

Slots are first-come, in poll order. There is no price-first queue. At demo size a single counter is enough, and the conditional update is already safe if two summaries reserve at once. In production, with 6,000 competitors, 2,000 calls a day cannot cover every material edit. I would spend the budget on price changes and delists before tagline or description edits.

If the process stops while a row is `pending`, the next boot retries that stored prompt once. The stored status stays `llm_timeout`, `llm_unusable`, `llm_failed`, or `llm_cap_reached`. A retry that throws is `llm_failed`.

### History

Every observation except `429` is one snapshot row: unchanged polls, failed polls, and material changes. The timeline is one newest-first query. The baseline used for the diff lives on the competitor and is updated in the same transaction as the snapshot. A partial or a 5xx does not touch it, so a hole cannot look like a price change.

Rows older than 90 days are deleted in batches of 1,000, off the fetch loop. `Snapshot.fetchedAt` is indexed for that delete. Tracked competitors are kept. At the 20-minute floor this is on the order of 40 million snapshot rows over 90 days. That is acceptable for Postgres in this exercise.

**Considered instead:** store full listing text only when `changed` is true, and keep thin rows (status, timestamps) for unchanged and failed polls. That would cut storage a lot, but the timeline would have to join or backfill fields for most entries. The brief asks to show unchanged and failed polls directly, so every observation keeps the same snapshot shape.

## Left out on purpose

- Authentication — the brief assumes one internal user, so there is no login.
- A richer UI — the pages stay plain (list + timeline) so statuses stay easy to read.
- WebSocket / SSE for the UI — at 5 listing fetches/second live updates would help, but the protocol and client wiring are overhead here; refresh is enough.
- A priority queue for the LLM cap (price/delist first). At this size first-come is enough; the README notes when that would change.
- Refunding LLM slots by outcome — every reserved call counts, including timeout, 5xx, and empty body. Status-aware refunds are extra machinery for little gain here.

## AI tools

Cursor was used to implement the backend and to draft this README. The models behind the agents were Grok and Claude Opus.

Places where the AI proposal was changed:
- The first draft stored every unsuccessful startup retry as `llm_failed`, including a timeout, an empty reply, and a day that was already at the cap. The startup path now keeps `llm_timeout`, `llm_unusable`, and `llm_cap_reached`, so the timeline can still say which of those happened. A retry that throws is still `llm_failed`.
- NestJS plus a job queue was suggested for the worker. That was replaced with Express and an in-process poll loop — enough for four routes, without the extra framework weight.

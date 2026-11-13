import type { ListingClient } from "../../integrations/listing-client";
import type { LlmClient } from "../../integrations/llm-client";
import type { AppLogger } from "../../shared/logger";
import {
  buildPrompt,
  classifyBody,
  decidePoll,
  resumePendingSummary,
  summarizePrompt,
  type Baseline,
  type PromptState,
  type SummaryWrite,
} from "./domain";
import type { PollingRepository } from "./polling.repository";
import type { TokenBucket } from "./token-bucket";

const RETENTION_INTERVAL_MS = 60 * 60 * 1000;
const RETENTION_BATCH = 1000;
const IDLE_SLEEP_MS = 1000;

export type PollingServiceDeps = {
  repository: PollingRepository;
  listing: ListingClient;
  llm: LlmClient;
  bucket: TokenBucket;
  pollIntervalMs: number;
  llmDailyCap: number;
  retentionDays: number;
  logger: AppLogger;
};

export type PollingService = {
  start(): void;
  stop(): void;
};

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function baselineChanged(before: Baseline, after: Baseline): boolean {
  const keys = Object.keys(after) as Array<keyof Baseline>;
  return keys.some((key) => before[key] !== after[key]);
}

function promptState(baseline: Baseline): PromptState {
  return {
    listingState: baseline.listingState,
    title: baseline.title,
    tagline: baseline.tagline,
    description: baseline.description,
    priceDisplay: baseline.priceDisplay,
  };
}

export function createPollingService({
  repository,
  listing,
  llm,
  bucket,
  pollIntervalMs,
  llmDailyCap,
  retentionDays,
  logger,
}: PollingServiceDeps): PollingService {
  let stopped = false;

  const reserve = () => repository.reserveLlmCall(utcDay(new Date()), llmDailyCap);

  const storeSummary = (id: string, result: SummaryWrite) =>
    repository.updateSummary(id, result.summary, result.summaryStatus);

  async function writeSummary(competitorId: string, snapshotId: string, prompt: string): Promise<void> {
    try {
      const result = await summarizePrompt({
        prompt,
        reserve,
        complete: (text) => llm.summarize(text),
      });
      await storeSummary(snapshotId, result);
      logger.info({ competitorId, snapshotId, summaryStatus: result.summaryStatus }, "summary");
    } catch (error) {
      logger.error({ err: error, competitorId, snapshotId }, "summary failed");
      try {
        await storeSummary(snapshotId, { summaryStatus: "llm_failed", summary: null });
      } catch (updateError) {
        logger.error({ err: updateError, competitorId, snapshotId }, "summary status was not stored");
      }
    }
  }

  async function pollDueCompetitor(): Promise<"idle" | "paused" | "polled"> {
    const competitor = await repository.findNextDue();
    if (!competitor) {
      return "idle";
    }

    await bucket.take();
    const fetched = await listing.fetchListing(competitor.id);
    if (fetched.status === "rate_limited") {
      bucket.pause(fetched.retryAfterSeconds);
      logger.info({ competitorId: competitor.id, pollStatus: "rate_limited" }, "poll paused");
      return "paused";
    }

    const observation = fetched.status === "ok" ? classifyBody(fetched.body) : fetched;
    const decision = decidePoll(competitor.baseline, observation);
    const previous = promptState(competitor.baseline);
    const next = promptState(decision.baseline);
    const summaryPrompt = decision.summaryStatus === "pending" ? buildPrompt(previous, next) : null;
    const fetchedAt = new Date();
    const snapshotId = await repository.savePoll({
      competitorId: competitor.id,
      fetchedAt,
      pollStatus: decision.pollStatus,
      changed: decision.changed,
      summaryStatus: decision.summaryStatus,
      fields: decision.fields,
      baseline: decision.baseline,
      nextPollAt: new Date(fetchedAt.getTime() + pollIntervalMs),
      touchBaseline: baselineChanged(competitor.baseline, decision.baseline),
      summaryPrompt,
    });

    logger.info(
      { competitorId: competitor.id, pollStatus: decision.pollStatus, summaryStatus: decision.summaryStatus },
      "poll",
    );

    if (decision.summaryStatus === "pending" && summaryPrompt) {
      void writeSummary(competitor.id, snapshotId, summaryPrompt);
    }
    return "polled";
  }

  async function retryPendingSummaries(): Promise<void> {
    const rows = await repository.listPending();
    for (const row of rows) {
      try {
        const result = await resumePendingSummary({
          prompt: row.summaryPrompt,
          reserve,
          complete: (prompt) => llm.summarize(prompt),
        });
        await storeSummary(row.id, result);
      } catch (error) {
        logger.error({ err: error, snapshotId: row.id }, "pending summary failed");
        try {
          await storeSummary(row.id, { summaryStatus: "llm_failed", summary: null });
        } catch (updateError) {
          logger.error({ err: updateError, snapshotId: row.id }, "pending summary status was not stored");
        }
      }
    }
  }

  async function runLoop(): Promise<void> {
    let lastRetention = 0;
    let purge: Promise<void> | undefined;

    while (!stopped) {
      try {
        const outcome = await pollDueCompetitor();
        const now = Date.now();
        if (purge === undefined && now - lastRetention >= RETENTION_INTERVAL_MS) {
          const cutoff = new Date(now - retentionDays * 24 * 60 * 60 * 1000);
          purge = repository
            .deleteOlderThan(cutoff, RETENTION_BATCH)
            .then((deleted) => {
              if (deleted < RETENTION_BATCH) {
                lastRetention = Date.now();
              }
            })
            .catch((error: unknown) => {
              logger.error({ err: error }, "retention delete failed");
              lastRetention = Date.now();
            })
            .finally(() => {
              purge = undefined;
            });
        }
        if (outcome === "idle" && !stopped) {
          await sleep(IDLE_SLEEP_MS);
        }
      } catch (error) {
        logger.error({ err: error }, "poll failed");
        if (!stopped) {
          await sleep(IDLE_SLEEP_MS);
        }
      }
    }
  }

  return {
    stop() {
      stopped = true;
    },
    start() {
      stopped = false;
      void retryPendingSummaries().catch((error: unknown) => {
        logger.error({ err: error }, "pending summaries were not retried");
      });
      void runLoop().catch((error: unknown) => {
        logger.error({ err: error }, "poller stopped");
      });
    },
  };
}

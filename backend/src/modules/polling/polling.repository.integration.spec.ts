import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { emptyBaseline } from "./domain";
import { createPollingRepository, type PollSaveInput } from "./polling.repository";

const prisma = new PrismaClient();
const pollingRepository = createPollingRepository(prisma);

function poll(overrides: Partial<PollSaveInput> = {}): PollSaveInput {
  return {
    competitorId: "acme-crm",
    fetchedAt: new Date("2026-09-10T12:00:00Z"),
    pollStatus: "ok",
    changed: true,
    summaryStatus: "pending",
    fields: { title: "Acme", tagline: "CRM", price: "$29/mo", description: "Deals" },
    baseline: {
      listingState: "listed",
      title: "Acme",
      tagline: "CRM",
      description: "Deals",
      priceAmount: 29,
      priceCurrency: "USD",
      pricePeriod: "month",
      priceDisplay: "$29/mo",
      priceRaw: null,
    },
    nextPollAt: new Date("2026-09-10T12:15:00Z"),
    touchBaseline: true,
    summaryPrompt: "price changed",
    ...overrides,
  };
}

describe("polling repository", () => {
  beforeEach(async () => {
    await prisma.snapshot.deleteMany();
    await prisma.competitor.deleteMany();
    await prisma.llmDailyUsage.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns the oldest due competitor with the baseline written by savePoll", async () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    await prisma.competitor.create({ data: { id: "acme-crm", nextPollAt: past } });
    expect(await pollingRepository.findNextDue()).toEqual({
      id: "acme-crm",
      baseline: emptyBaseline(),
    });

    await pollingRepository.savePoll(poll({ nextPollAt: future }));
    expect(await pollingRepository.findNextDue()).toBeNull();

    await prisma.competitor.update({ where: { id: "acme-crm" }, data: { nextPollAt: past } });
    expect(await pollingRepository.findNextDue()).toEqual({
      id: "acme-crm",
      baseline: poll().baseline,
    });
  });

  it("lists pending summaries until they are updated", async () => {
    await prisma.competitor.create({ data: { id: "acme-crm" } });
    const snapshotId = await pollingRepository.savePoll(poll());
    expect(await pollingRepository.listPending()).toEqual([{ id: snapshotId, summaryPrompt: "price changed" }]);

    await pollingRepository.updateSummary(snapshotId, "Price dropped to $29/mo", "ready");
    expect(await pollingRepository.listPending()).toEqual([]);
  });

  it("deletes only snapshots older than the cutoff, up to the limit", async () => {
    await prisma.competitor.create({ data: { id: "acme-crm" } });
    await pollingRepository.savePoll(poll({ fetchedAt: new Date("2026-06-01T00:00:00Z") }));
    await pollingRepository.savePoll(poll({ fetchedAt: new Date("2026-06-02T00:00:00Z") }));
    await pollingRepository.savePoll(poll({ fetchedAt: new Date("2026-09-10T00:00:00Z") }));

    const cutoff = new Date("2026-07-01T00:00:00Z");
    expect(await pollingRepository.deleteOlderThan(cutoff, 1)).toBe(1);
    expect(await pollingRepository.deleteOlderThan(cutoff, 10)).toBe(1);
    expect(await prisma.snapshot.count()).toBe(1);
  });

  it("does not increment the LLM counter past the cap", async () => {
    expect(await pollingRepository.reserveLlmCall("2026-09-10", 1)).toBe(true);
    expect(await pollingRepository.reserveLlmCall("2026-09-10", 1)).toBe(false);
    expect(await prisma.llmDailyUsage.findUnique({ where: { day: "2026-09-10" } })).toMatchObject({ count: 1 });
  });
});

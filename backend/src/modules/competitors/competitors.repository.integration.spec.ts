import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../shared/errors";
import { createCompetitorRepository } from "./competitors.repository";
import { createPollingRepository } from "../polling/polling.repository";

const prisma = new PrismaClient();
const competitorRepository = createCompetitorRepository(prisma);
const pollingRepository = createPollingRepository(prisma);

describe("competitor repository", () => {
  beforeEach(async () => {
    await prisma.snapshot.deleteMany();
    await prisma.competitor.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects a duplicate id and deletes snapshots with the competitor", async () => {
    await expect(competitorRepository.create("acme-crm")).resolves.toBeUndefined();
    await expect(competitorRepository.create("acme-crm")).rejects.toThrow(ConflictError);
    await expect(competitorRepository.remove("missing")).rejects.toThrow(NotFoundError);
    await pollingRepository.savePoll({
      competitorId: "acme-crm",
      fetchedAt: new Date("2026-09-10T12:00:00Z"),
      pollStatus: "ok",
      changed: false,
      summaryStatus: "no_previous",
      fields: { title: "Acme", tagline: "CRM", price: "$39/mo", description: "Deals" },
      baseline: {
        listingState: "listed",
        title: "Acme",
        tagline: "CRM",
        description: "Deals",
        priceAmount: 39,
        priceCurrency: "USD",
        pricePeriod: "month",
        priceDisplay: "$39/mo",
        priceRaw: null,
      },
      nextPollAt: new Date("2026-09-10T12:15:00Z"),
      touchBaseline: true,
      summaryPrompt: null,
    });
    await expect(competitorRepository.remove("acme-crm")).resolves.toBeUndefined();
    expect(await prisma.snapshot.count()).toBe(0);
  });

  it("sets changedLast24h from lastMaterialAt and returns snapshots newest first", async () => {
    await competitorRepository.create("acme-crm");
    await pollingRepository.savePoll({
      competitorId: "acme-crm",
      fetchedAt: new Date("2026-09-09T12:00:00Z"),
      pollStatus: "ok",
      changed: false,
      summaryStatus: "no_previous",
      fields: { title: "Acme", tagline: "CRM", price: "$39/mo", description: "Deals" },
      baseline: {
        listingState: "listed",
        title: "Acme",
        tagline: "CRM",
        description: "Deals",
        priceAmount: 39,
        priceCurrency: "USD",
        pricePeriod: "month",
        priceDisplay: "$39/mo",
        priceRaw: null,
      },
      nextPollAt: new Date("2026-09-09T12:15:00Z"),
      touchBaseline: true,
      summaryPrompt: null,
    });
    await pollingRepository.savePoll({
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
    });
    const list = await competitorRepository.list(new Date("2026-09-10T18:00:00Z"));
    expect(list).toEqual([{ id: "acme-crm", changedLast24h: true }]);
    const snapshots = await competitorRepository.snapshots("acme-crm");
    expect(snapshots).not.toBeNull();
    if (snapshots !== null) {
      expect(snapshots.map((row) => row.price)).toEqual(["$29/mo", "$39/mo"]);
      expect(snapshots[0]?.changed).toBe(true);
      expect(snapshots[0]?.fetchedAt).toBeInstanceOf(Date);
    }
  });
});

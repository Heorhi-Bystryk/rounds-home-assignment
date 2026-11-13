import { Prisma, type PrismaClient, type SummaryStatus } from "@prisma/client";
import type { Baseline, Decision } from "./domain";

export type PollSaveInput = {
  competitorId: string;
  fetchedAt: Date;
  pollStatus: Decision["pollStatus"];
  changed: boolean;
  summaryStatus: Decision["summaryStatus"];
  fields: Decision["fields"];
  baseline: Baseline;
  nextPollAt: Date;
  touchBaseline: boolean;
  summaryPrompt: string | null;
};

export type PollingRepository = {
  listPending(): Promise<Array<{ id: string; summaryPrompt: string | null }>>;
  findNextDue(): Promise<{ id: string; baseline: Baseline } | null>;
  savePoll(input: PollSaveInput): Promise<string>;
  updateSummary(id: string, summary: string | null, summaryStatus: SummaryStatus): Promise<void>;
  deleteOlderThan(cutoff: Date, limit: number): Promise<number>;
  reserveLlmCall(day: string, cap: number): Promise<boolean>;
};

function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

function toBaseline(row: {
  listingState: Baseline["listingState"];
  title: string | null;
  tagline: string | null;
  description: string | null;
  priceAmount: Prisma.Decimal | null;
  priceCurrency: string | null;
  pricePeriod: string | null;
  priceDisplay: string | null;
  priceRaw: string | null;
}): Baseline {
  return {
    listingState: row.listingState,
    title: row.title,
    tagline: row.tagline,
    description: row.description,
    priceAmount: toNumber(row.priceAmount),
    priceCurrency: row.priceCurrency,
    pricePeriod: row.pricePeriod,
    priceDisplay: row.priceDisplay,
    priceRaw: row.priceRaw,
  };
}

export function createPollingRepository(prisma: PrismaClient): PollingRepository {
  return {
    async savePoll(input: PollSaveInput): Promise<string> {
      return prisma.$transaction(async (tx) => {
        const snapshot = await tx.snapshot.create({
          data: {
            competitorId: input.competitorId,
            fetchedAt: input.fetchedAt,
            pollStatus: input.pollStatus,
            title: input.fields?.title ?? null,
            tagline: input.fields?.tagline ?? null,
            price: input.fields?.price ?? null,
            description: input.fields?.description ?? null,
            changed: input.changed,
            summary: null,
            summaryStatus: input.summaryStatus,
            summaryPrompt: input.summaryPrompt,
          },
        });
        const data: Prisma.CompetitorUpdateInput = { nextPollAt: input.nextPollAt };
        if (input.touchBaseline) {
          data.listingState = input.baseline.listingState;
          data.title = input.baseline.title;
          data.tagline = input.baseline.tagline;
          data.description = input.baseline.description;
          data.priceAmount = input.baseline.priceAmount;
          data.priceCurrency = input.baseline.priceCurrency;
          data.pricePeriod = input.baseline.pricePeriod;
          data.priceDisplay = input.baseline.priceDisplay;
          data.priceRaw = input.baseline.priceRaw;
        }
        if (input.changed) {
          data.lastMaterialAt = input.fetchedAt;
        }
        await tx.competitor.update({ where: { id: input.competitorId }, data });
        return snapshot.id;
      });
    },

    async findNextDue(): Promise<{ id: string; baseline: Baseline } | null> {
      const row = await prisma.competitor.findFirst({
        where: { nextPollAt: { lte: new Date() } },
        orderBy: { nextPollAt: "asc" },
      });
      if (!row) {
        return null;
      }
      return { id: row.id, baseline: toBaseline(row) };
    },

    async listPending(): Promise<Array<{ id: string; summaryPrompt: string | null }>> {
      return prisma.snapshot.findMany({
        where: { summaryStatus: "pending" },
        select: { id: true, summaryPrompt: true },
      });
    },

    async updateSummary(id: string, summary: string | null, summaryStatus: SummaryStatus): Promise<void> {
      await prisma.snapshot.update({
        where: { id },
        data: { summary, summaryStatus },
      });
    },

    async deleteOlderThan(cutoff: Date, limit: number) {
      const deleted = await prisma.$executeRaw`
        DELETE FROM "Snapshot"
        WHERE id IN (
          SELECT id FROM "Snapshot"
          WHERE "fetchedAt" < ${cutoff}
          LIMIT ${limit}
        )
      `;
      return Number(deleted);
    },

    async reserveLlmCall(day: string, cap: number): Promise<boolean> {
      const rows = await prisma.$queryRaw<Array<{ count: number }>>`
        INSERT INTO "LlmDailyUsage" ("day", "count")
        VALUES (${day}, 1)
        ON CONFLICT ("day") DO UPDATE
        SET "count" = "LlmDailyUsage"."count" + 1
        WHERE "LlmDailyUsage"."count" < ${cap}
        RETURNING "count"
      `;
      return rows.length > 0;
    },
  };
}

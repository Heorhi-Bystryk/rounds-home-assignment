import { Prisma, type PrismaClient, type SummaryStatus } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../shared/errors";

const DAY_MS = 24 * 60 * 60 * 1000;

export type SnapshotRow = {
  fetchedAt: Date;
  title: string | null;
  tagline: string | null;
  price: string | null;
  description: string | null;
  changed: boolean;
  summary: string | null;
  pollStatus: "ok" | "not_found" | "error" | "timeout" | "partial";
  summaryStatus: SummaryStatus;
};

export type CompetitorListRow = {
  id: string;
  changedLast24h: boolean;
};

export type CompetitorRepository = {
  create(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  list(now: Date): Promise<CompetitorListRow[]>;
  snapshots(id: string): Promise<SnapshotRow[] | null>;
};

function isPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export function createCompetitorRepository(prisma: PrismaClient): CompetitorRepository {
  return {
    async create(id: string): Promise<void> {
      try {
        await prisma.competitor.create({ data: { id } });
      } catch (error) {
        if (isPrismaCode(error, "P2002")) {
          throw new ConflictError();
        }
        throw error;
      }
    },

    async remove(id: string): Promise<void> {
      try {
        await prisma.competitor.delete({ where: { id } });
      } catch (error) {
        if (isPrismaCode(error, "P2025")) {
          throw new NotFoundError();
        }
        throw error;
      }
    },

    async list(now: Date): Promise<CompetitorListRow[]> {
      const since = new Date(now.getTime() - DAY_MS);
      const rows = await prisma.competitor.findMany({ orderBy: { createdAt: "asc" } });
      return rows.map((row) => ({
        id: row.id,
        changedLast24h: row.lastMaterialAt !== null && row.lastMaterialAt >= since,
      }));
    },

    async snapshots(id: string): Promise<SnapshotRow[] | null> {
      const exists = await prisma.competitor.findUnique({ where: { id }, select: { id: true } });
      if (!exists) {
        return null;
      }
      const rows = await prisma.snapshot.findMany({
        where: { competitorId: id },
        orderBy: { fetchedAt: "desc" },
        select: {
          fetchedAt: true,
          title: true,
          tagline: true,
          price: true,
          description: true,
          changed: true,
          summary: true,
          pollStatus: true,
          summaryStatus: true,
        },
      });
      return rows;
    },
  };
}

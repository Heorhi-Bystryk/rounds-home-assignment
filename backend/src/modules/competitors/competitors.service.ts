import type { SummaryStatus } from "@prisma/client";
import { NotFoundError } from "../../shared/errors";
import type { CompetitorRepository } from "./competitors.repository";

export type CompetitorListItem = { id: string; changedLast24h: boolean };

export type SnapshotResponse = {
  fetchedAt: string;
  title: string | null;
  tagline: string | null;
  price: string | null;
  description: string | null;
  changed: boolean;
  summary: string | null;
  pollStatus: "ok" | "not_found" | "error" | "timeout" | "partial";
  summaryStatus: SummaryStatus;
};

export type CompetitorService = {
  add(id: string): Promise<{ id: string }>;
  remove(id: string): Promise<void>;
  list(): Promise<CompetitorListItem[]>;
  snapshots(id: string): Promise<SnapshotResponse[]>;
};

export function createCompetitorService(repository: CompetitorRepository): CompetitorService {
  return {
    async add(id) {
      await repository.create(id);
      return { id };
    },
    remove: (id) => repository.remove(id),
    list: () => repository.list(new Date()),
    async snapshots(id) {
      const rows = await repository.snapshots(id);
      if (rows === null) {
        throw new NotFoundError();
      }
      return rows.map((row) => ({
        fetchedAt: row.fetchedAt.toISOString(),
        title: row.title,
        tagline: row.tagline,
        price: row.price,
        description: row.description,
        changed: row.changed,
        summary: row.summary,
        pollStatus: row.pollStatus,
        summaryStatus: row.summaryStatus,
      }));
    },
  };
}

import { describe, expect, it } from "vitest";
import { NotFoundError } from "../../shared/errors";
import { createCompetitorService } from "./competitors.service";
import type { SnapshotRow, CompetitorRepository } from "./competitors.repository";

function makeFakeRepo(overrides: Partial<CompetitorRepository>): CompetitorRepository {
  const notImplemented = (): never => {
    throw new Error("not implemented in fake");
  };
  return {
    create: overrides.create ?? notImplemented,
    remove: overrides.remove ?? notImplemented,
    list: overrides.list ?? notImplemented,
    snapshots: overrides.snapshots ?? notImplemented,
  };
}

describe("CompetitorService", () => {
  describe("add", () => {
    it("returns id after create", async () => {
      const competitorRepository = makeFakeRepo({
        create: async (_id) => undefined,
      });
      const service = createCompetitorService(competitorRepository);
      await expect(service.add("acme-crm")).resolves.toEqual({ id: "acme-crm" });
    });
  });

  describe("snapshots", () => {
    it("throws NotFoundError when competitorRepository returns null", async () => {
      const competitorRepository = makeFakeRepo({
        snapshots: async (_id) => null,
      });
      const service = createCompetitorService(competitorRepository);
      await expect(service.snapshots("acme-crm")).rejects.toThrow(NotFoundError);
    });

    it("maps fetchedAt to an ISO string", async () => {
      const fetchedAt = new Date("2026-09-10T12:00:00.000Z");
      const rows: SnapshotRow[] = [
        {
          fetchedAt,
          title: "Acme CRM",
          tagline: "Deals faster",
          price: "$39/mo",
          description: "Manage deals",
          changed: true,
          summary: "Price changed",
          pollStatus: "ok",
          summaryStatus: "ready",
        },
      ];
      const competitorRepository = makeFakeRepo({
        snapshots: async (_id) => rows,
      });
      const service = createCompetitorService(competitorRepository);
      const result = await service.snapshots("acme-crm");
      expect(result[0]?.fetchedAt).toBe(fetchedAt.toISOString());
      expect(result[0]?.title).toBe("Acme CRM");
    });
  });
});

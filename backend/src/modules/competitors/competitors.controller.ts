import { Router } from "express";
import { asyncHandler } from "../../shared/http";
import { requireCompetitorId } from "./competitors.validator";
import type { CompetitorService } from "./competitors.service";

export function createCompetitorController(service: CompetitorService) {
  const router = Router();

  router.get("/", asyncHandler(async (_req, res) => {
    res.json(await service.list());
  }));

  router.post("/", asyncHandler(async (req, res) => {
    const id = requireCompetitorId(req.body?.id);
    res.status(201).json(await service.add(id));
  }));

  router.delete("/:id", asyncHandler(async (req, res) => {
    const id = requireCompetitorId(req.params.id);
    await service.remove(id);
    res.sendStatus(204);
  }));

  router.get("/:id/snapshots", asyncHandler(async (req, res) => {
    const id = requireCompetitorId(req.params.id);
    res.json(await service.snapshots(id));
  }));

  return router;
}

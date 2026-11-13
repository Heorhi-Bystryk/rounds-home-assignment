import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { createCompetitorController } from "./modules/competitors/competitors.controller";
import type { CompetitorService } from "./modules/competitors/competitors.service";
import { errorHandler } from "./shared/http";

export function createApp(competitors: CompetitorService): Express {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.use(rejectInvalidJson);
  app.use("/api/competitors", createCompetitorController(competitors));
  app.use(errorHandler);
  return app;
}

function rejectInvalidJson(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: "invalid_json" });
    return;
  }
  next(error);
}

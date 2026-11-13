import type { NextFunction, Request, RequestHandler, Response } from "express";
import { logger } from "./logger";
import { CompetitorPulseError } from "./errors";

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function errorHandler(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof CompetitorPulseError) {
    res.status(error.status).json({ error: error.code });
    return;
  }
  logger.error({ err: error }, "request failed");
  res.status(500).json({ error: "internal_error" });
}

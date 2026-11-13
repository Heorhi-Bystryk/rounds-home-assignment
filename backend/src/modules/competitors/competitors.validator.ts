import { z } from "zod";
import { BadRequestError } from "../../shared/errors";

export function requireCompetitorId(value: unknown): string {
  const parsed = z.string().trim().min(1).safeParse(value);
  if (!parsed.success) {
    throw new BadRequestError("invalid_id");
  }
  return parsed.data;
}

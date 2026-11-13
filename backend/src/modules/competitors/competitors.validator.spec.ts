import { describe, expect, it } from "vitest";
import { BadRequestError } from "../../shared/errors";
import { requireCompetitorId } from "./competitors.validator";

describe("requireCompetitorId", () => {
  it("accepts ids with mixed case, underscores, dots, and hyphens", () => {
    expect(requireCompetitorId("Acme_CRM.v2-beta")).toBe("Acme_CRM.v2-beta");
  });

  it("trims leading and trailing whitespace", () => {
    expect(requireCompetitorId("  acme  ")).toBe("acme");
  });

  it("throws BadRequestError for empty or non-string input", () => {
    expect(() => requireCompetitorId("")).toThrow(BadRequestError);
    expect(() => requireCompetitorId("   ")).toThrow(BadRequestError);
    expect(() => requireCompetitorId(null)).toThrow(BadRequestError);
    expect(() => requireCompetitorId(42)).toThrow(BadRequestError);
  });
});

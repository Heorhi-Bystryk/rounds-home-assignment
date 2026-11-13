import { describe, expect, it } from "vitest";
import { classifyBody, normalizePrice, normalizeText } from "./normalize";

describe("normalizeText", () => {
  it("collapses whitespace and decodes entities", () => {
    expect(normalizeText("  Simple&nbsp;CRM &amp; deals \n")).toBe("Simple CRM & deals");
  });
});

describe("normalizePrice", () => {
  describe("USD – all four source-emitted formats compare equal", () => {
    it("all four USD formats parse to amount=29, period=month", () => {
      const variants = ["$29/mo", "$29.00/mo", "$29 / month", "USD 29 per month"];
      for (const v of variants) {
        expect(normalizePrice(v)).toMatchObject({ structured: true, amount: 29, period: "month" });
      }
    });

    it("$29/mo and USD 29 per month have equal amount and period", () => {
      const a = normalizePrice("$29/mo");
      const b = normalizePrice("USD 29 per month");
      expect(a.structured).toBe(true);
      expect(b.structured).toBe(true);
      expect(a.amount).toBe(b.amount);
      expect(a.period).toBe(b.period);
    });
  });

  describe("EUR – all four source-emitted formats compare equal", () => {
    it("all four EUR formats parse to amount=29, period=month", () => {
      const variants = ["€29/mo", "€29.00/mo", "€29 / month", "EUR 29 per month"];
      for (const v of variants) {
        expect(normalizePrice(v)).toMatchObject({ structured: true, amount: 29, period: "month" });
      }
    });
  });

  describe("GBP – source-emitted formats", () => {
    it("£ and GBP code parse to the same amount and period", () => {
      const a = normalizePrice("£12/mo");
      const b = normalizePrice("GBP 12 per month");
      expect(a).toMatchObject({ structured: true, amount: 12, currency: "GBP", period: "month", display: "£12/mo" });
      expect(b).toMatchObject({ structured: true, amount: 12, currency: "GBP", period: "month", display: "£12/mo" });
    });
  });

  describe("currency whitelist (USD / EUR / GBP only)", () => {
    it("keeps unknown currency codes and symbols as raw", () => {
      expect(normalizePrice("CAD 29/mo")).toMatchObject({ structured: false, display: "CAD 29/mo" });
      expect(normalizePrice("₹199/mo")).toMatchObject({ structured: false, display: "₹199/mo" });
    });

    it("stores currency as ISO code and display with the source symbol", () => {
      expect(normalizePrice("$29/mo")).toMatchObject({ currency: "USD", display: "$29/mo" });
      expect(normalizePrice("EUR 29 per month")).toMatchObject({ currency: "EUR", display: "€29/mo" });
    });
  });

  describe("zero-amount prices", () => {
    it("Free variants share amount with null currency/period but keep source display for UI", () => {
      const cases = [
        ["Free", "Free"],
        ["Free forever", "Free forever"],
        ["$0/mo", "$0/mo"],
        ["€0/mo", "€0/mo"],
        ["$0/yr", "$0/yr"],
      ] as const;
      for (const [input, display] of cases) {
        expect(normalizePrice(input)).toEqual({
          structured: true,
          amount: 0,
          currency: null,
          period: null,
          display,
          raw: null,
        });
      }
    });
  });

  describe("change detection", () => {
    it("detects a price amount change", () => {
      const before = normalizePrice("$29/mo");
      const after = normalizePrice("$39/mo");
      expect(before.amount).toBe(29);
      expect(after.amount).toBe(39);
      expect(before.amount).not.toBe(after.amount);
    });

    it("detects a billing period change", () => {
      const monthly = normalizePrice("$29/mo");
      const annual = normalizePrice("$29/yr");
      expect(monthly.period).toBe("month");
      expect(annual.period).toBe("year");
    });
  });

  it("keeps an unrecognized price as raw text", () => {
    expect(normalizePrice("Contact sales")).toMatchObject({ structured: false, display: "Contact sales" });
  });
});

describe("classifyBody", () => {
  it("drops per-request noise", () => {
    const observation = classifyBody({
      title: "Acme",
      tagline: "CRM",
      price: "$29/mo",
      description: "Deals",
      requestId: "abc",
      renderedAt: "2026-01-01T00:00:00Z",
    });
    expect(observation).toMatchObject({ status: "ok", listing: { title: "Acme", price: { amount: 29, period: "month" } } });
  });

  it("marks a missing, empty, or null field as partial", () => {
    expect(classifyBody({ tagline: "CRM", price: "$29/mo", description: "Deals" }).status).toBe("partial");
    expect(classifyBody({ title: "  ", tagline: "CRM", price: "$29/mo", description: "Deals" }).status).toBe("partial");
    expect(classifyBody({ title: null, tagline: "CRM", price: "$29/mo", description: "Deals" }).status).toBe("partial");
  });
});

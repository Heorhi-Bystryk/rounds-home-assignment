import { describe, expect, it } from "vitest";
import { decidePoll, emptyBaseline, type Baseline } from "./decide";
import { classifyBody, type Observation } from "./normalize";

const listing = {
  title: "Acme CRM",
  tagline: "Simple CRM",
  price: "$39/mo",
  description: "Track deals.",
};

function ok(price = "$39/mo"): Observation {
  return classifyBody({ ...listing, price });
}

function listed(price = "$39/mo"): Baseline {
  const observation = ok(price);
  if (observation.status !== "ok") {
    throw new Error("expected listing");
  }
  return decidePoll(emptyBaseline(), observation).baseline;
}

describe("decidePoll", () => {
  it("stores the first listing without calling the LLM", () => {
    const decision = decidePoll(emptyBaseline(), ok());
    expect(decision).toMatchObject({ changed: false, summaryStatus: "no_previous", pollStatus: "ok" });
    expect(decision.baseline.listingState).toBe("listed");
    expect(decision.fields?.price).toBe("$39/mo");
  });

  it("ignores a format-only repeat (USD symbol vs code)", () => {
    const decision = decidePoll(listed(), ok("USD 39 per month"));
    expect(decision).toMatchObject({ changed: false, summaryStatus: "no_material_change", pollStatus: "ok" });
  });

  it("ignores a format-only repeat for EUR symbol vs code", () => {
    const decision = decidePoll(listed("€29/mo"), ok("EUR 29 per month"));
    expect(decision).toMatchObject({ changed: false, summaryStatus: "no_material_change", pollStatus: "ok" });
  });

  it("ignores Free / Free forever / $0/mo / €0/mo / $0/yr as the same price but keeps source price on the snapshot", () => {
    let baseline = listed("Free");
    for (const price of ["Free forever", "$0/mo", "€0/mo", "$0/yr", "Free"]) {
      const decision = decidePoll(baseline, ok(price));
      expect(decision).toMatchObject({ changed: false, summaryStatus: "no_material_change", pollStatus: "ok" });
      expect(decision.fields?.price).toBe(price);
      baseline = decision.baseline;
    }
  });

  it("marks a real price change as pending summary", () => {
    const decision = decidePoll(listed(), ok("$29/mo"));
    expect(decision).toMatchObject({ changed: true, summaryStatus: "pending", pollStatus: "ok" });
    expect(decision.fields?.price).toBe("$29/mo");
    expect(decision.baseline.priceDisplay).toBe("$29/mo");
  });

  it("marks a currency change as pending summary", () => {
    const decision = decidePoll(listed("$29/mo"), ok("€29/mo"));
    expect(decision).toMatchObject({ changed: true, summaryStatus: "pending", pollStatus: "ok" });
    expect(decision.baseline.priceCurrency).toBe("EUR");
  });

  it("treats 404 after a listing as a delist and keeps the old fields for a later compare", () => {
    const decision = decidePoll(listed("$39/mo"), { status: "not_found" });
    expect(decision).toMatchObject({ changed: true, summaryStatus: "pending", pollStatus: "not_found" });
    expect(decision.baseline.listingState).toBe("unlisted");
    expect(decision.baseline.priceDisplay).toBe("$39/mo");
    expect(decision.fields).toBeNull();
  });

  it("does not summarize the first 404 of an unknown id", () => {
    const decision = decidePoll(emptyBaseline(), { status: "not_found" });
    expect(decision).toMatchObject({ changed: false, summaryStatus: "poll_failed", pollStatus: "not_found" });
    expect(decision.baseline.listingState).toBe("unknown");
  });

  it("does not move the baseline on a partial, error, or timeout", () => {
    const baseline = listed();
    for (const status of ["partial", "error", "timeout"] as const) {
      const decision = decidePoll(baseline, { status });
      expect(decision.changed).toBe(false);
      expect(decision.summaryStatus).toBe("poll_failed");
      expect(decision.baseline).toEqual(baseline);
    }
  });

  it("treats an identical relist as no material change and marks the competitor listed again", () => {
    const delisted = decidePoll(listed("$39/mo"), { status: "not_found" }).baseline;
    const decision = decidePoll(delisted, ok("$39/mo"));
    expect(decision).toMatchObject({ changed: false, summaryStatus: "no_material_change" });
    expect(decision.baseline.listingState).toBe("listed");
  });
});

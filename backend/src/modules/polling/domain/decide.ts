import type { CanonicalListing, Observation } from "./normalize";

export type Baseline = {
  listingState: "unknown" | "listed" | "unlisted";
  title: string | null;
  tagline: string | null;
  description: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  pricePeriod: string | null;
  priceDisplay: string | null;
  priceRaw: string | null;
};

export type SnapshotFields = {
  title: string;
  tagline: string;
  price: string;
  description: string;
};

export type Decision = {
  changed: boolean;
  summaryStatus: "no_previous" | "no_material_change" | "pending" | "poll_failed";
  pollStatus: "ok" | "not_found" | "error" | "timeout" | "partial";
  baseline: Baseline;
  fields: SnapshotFields | null;
};

export function emptyBaseline(): Baseline {
  return {
    listingState: "unknown",
    title: null,
    tagline: null,
    description: null,
    priceAmount: null,
    priceCurrency: null,
    pricePeriod: null,
    priceDisplay: null,
    priceRaw: null,
  };
}

function sameListing(baseline: Baseline, listing: CanonicalListing): boolean {
  if (baseline.title !== listing.title || baseline.tagline !== listing.tagline || baseline.description !== listing.description) {
    return false;
  }
  if (!listing.price.structured) {
    return baseline.priceRaw === listing.price.raw;
  }
  return (
    baseline.priceAmount === listing.price.amount &&
    baseline.pricePeriod === listing.price.period &&
    baseline.priceCurrency === listing.price.currency
  );
}

function fromListing(listing: CanonicalListing): Baseline {
  return {
    listingState: "listed",
    title: listing.title,
    tagline: listing.tagline,
    description: listing.description,
    priceAmount: listing.price.amount,
    priceCurrency: listing.price.currency,
    pricePeriod: listing.price.period,
    priceDisplay: listing.price.display,
    priceRaw: listing.price.raw,
  };
}

function fieldsOf(listing: CanonicalListing): SnapshotFields {
  return {
    title: listing.title,
    tagline: listing.tagline,
    price: listing.price.display,
    description: listing.description,
  };
}

function keep(baseline: Baseline, pollStatus: Decision["pollStatus"]): Decision {
  return { changed: false, summaryStatus: "poll_failed", pollStatus, baseline, fields: null };
}

export function decidePoll(baseline: Baseline, observation: Observation): Decision {
  if (observation.status === "partial" || observation.status === "error" || observation.status === "timeout") {
    return keep(baseline, observation.status);
  }
  if (observation.status === "not_found") {
    if (baseline.listingState !== "listed") {
      return keep(baseline, "not_found");
    }
    return {
      changed: true,
      summaryStatus: "pending",
      pollStatus: "not_found",
      baseline: { ...baseline, listingState: "unlisted" },
      fields: null,
    };
  }
  const listing = observation.listing;
  if (baseline.listingState === "unknown") {
    return {
      changed: false,
      summaryStatus: "no_previous",
      pollStatus: "ok",
      baseline: fromListing(listing),
      fields: fieldsOf(listing),
    };
  }
  if (sameListing(baseline, listing)) {
    return {
      changed: false,
      summaryStatus: "no_material_change",
      pollStatus: "ok",
      baseline: fromListing(listing),
      fields: fieldsOf(listing),
    };
  }
  return {
    changed: true,
    summaryStatus: "pending",
    pollStatus: "ok",
    baseline: fromListing(listing),
    fields: fieldsOf(listing),
  };
}

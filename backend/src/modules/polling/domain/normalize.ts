export type CanonicalPrice = {
  structured: boolean;
  amount: number | null;
  currency: string | null;
  period: string | null;
  display: string;
  raw: string | null;
};

export type CanonicalListing = {
  title: string;
  tagline: string;
  description: string;
  price: CanonicalPrice;
};

export type Observation =
  | { status: "ok"; listing: CanonicalListing }
  | { status: "partial" }
  | { status: "not_found" }
  | { status: "error" }
  | { status: "timeout" };

const CURRENCY_BY_SYMBOL: Record<string, string> = { $: "USD", "€": "EUR", "£": "GBP" };
const SYMBOL_BY_CURRENCY: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" };

function parseCurrencyMarker(marker: string): string | null {
  const trimmed = marker.trim();
  if (trimmed === "") {
    return null;
  }
  if (CURRENCY_BY_SYMBOL[trimmed]) {
    return CURRENCY_BY_SYMBOL[trimmed]!;
  }
  const code = trimmed.toUpperCase();
  return SYMBOL_BY_CURRENCY[code] ? code : null;
}

export function normalizeText(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// [pattern, period canonical, short suffix] — most-specific first
type PeriodEntry = [RegExp, string, string];
const PERIOD_SUFFIXES: PeriodEntry[] = [
  [/\/seat\/mo$/i, "seat_month", "/seat/mo"],
  [/\s*\/\s*seat\s*\/\s*month$/i, "seat_month", "/seat/mo"],
  [/\s+per\s+seat\s+per\s+month$/i, "seat_month", "/seat/mo"],
  [/\/yr$/i, "year", "/yr"],
  [/\s*\/\s*year$/i, "year", "/yr"],
  [/\s+per\s+year$/i, "year", "/yr"],
  [/\/mo$/i, "month", "/mo"],
  [/\s*\/\s*month$/i, "month", "/mo"],
  [/\s+per\s+month$/i, "month", "/mo"],
];

export function normalizePrice(input: string): CanonicalPrice {
  const text = normalizeText(input);

  if (/^(free|free forever)$/i.test(text)) {
    return { structured: true, amount: 0, currency: null, period: null, display: text, raw: null };
  }

  let period: string | null = null;
  let shortSuffix = "/mo";
  let withoutPeriod = text;
  for (const [re, p, suffix] of PERIOD_SUFFIXES) {
    const m = text.match(re);
    if (m) {
      period = p;
      shortSuffix = suffix;
      withoutPeriod = text.slice(0, m.index!).trimEnd();
      break;
    }
  }

  if (period === null) {
    return { structured: false, amount: null, currency: null, period: null, display: text, raw: text };
  }

  const amountMatch = withoutPeriod.match(/^(.*?)(\d+(?:\.\d+)?)\s*$/);
  if (!amountMatch) {
    return { structured: false, amount: null, currency: null, period: null, display: text, raw: text };
  }

  const currency = parseCurrencyMarker(amountMatch[1]!);
  const amount = Number(amountMatch[2]);

  if (currency === null || !isFinite(amount)) {
    return { structured: false, amount: null, currency: null, period: null, display: text, raw: text };
  }

  if (amount === 0) {
    return { structured: true, amount: 0, currency: null, period: null, display: text, raw: null };
  }

  const symbol = SYMBOL_BY_CURRENCY[currency]!;
  return {
    structured: true,
    amount,
    currency,
    period,
    display: `${symbol}${String(amount)}${shortSuffix}`,
    raw: null,
  };
}

export function classifyBody(body: unknown): Observation {
  if (!body || typeof body !== "object") {
    return { status: "error" };
  }
  const record = body as Record<string, unknown>;
  const title = record.title;
  const tagline = record.tagline;
  const price = record.price;
  const description = record.description;
  const values = [title, tagline, price, description];
  if (values.some((value) => typeof value !== "string" || value.trim() === "")) {
    return { status: "partial" };
  }
  return {
    status: "ok",
    listing: {
      title: normalizeText(title as string),
      tagline: normalizeText(tagline as string),
      description: normalizeText(description as string),
      price: normalizePrice(price as string),
    },
  };
}

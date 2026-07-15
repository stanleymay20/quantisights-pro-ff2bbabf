// Parses a monetary impact estimate out of `expected_impact`, which can be
// a raw number or free-form advisory/insight prose. That prose frequently
// cites numbers with no monetary meaning at all -- risk scores, day counts,
// percentages -- e.g. "Reduce CFO risk score from 72 to below 50 within 60
// days". A parser that averages every digit found in the string treats
// that as an average of [72, 50, 60] = ~61, or picks up an unrelated small
// number like a day count and reports it as a several-euro impact, which
// then renders next to genuinely large decisions as a nonsensical "+€11"
// or "+€2". Only trust a number that's explicitly marked as currency (a
// €/$/£ symbol, optionally with a k/m magnitude suffix); anything else
// returns null so callers can render an honest "not quantified" instead of
// a fabricated figure.
export function parseImpactEstimate(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const text = String(value);
  const matches = text.match(/[€$£]\s?-?\d[\d,]*(?:\.\d+)?\s?[kKmM]?/g);
  if (!matches?.length) return null;
  const nums = matches
    .map(parseCurrencyToken)
    .filter((n): n is number => n !== null);
  if (!nums.length) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function parseCurrencyToken(token: string): number | null {
  const cleaned = token.replace(/[€$£,\s]/g, "");
  const match = cleaned.match(/^(-?\d+(?:\.\d+)?)([kKmM])?$/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return null;
  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") return n * 1_000;
  if (suffix === "m") return n * 1_000_000;
  return n;
}

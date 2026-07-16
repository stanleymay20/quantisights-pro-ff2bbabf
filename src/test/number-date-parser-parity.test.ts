import { describe, expect, it } from "vitest";
import { parseMessyDate as clientParseDate, parseMessyNumber as clientParseNumber } from "@/lib/messy-data-guards";
import {
  parseMessyDate as serverParseDate,
  parseMessyNumber as serverParseNumber,
  // deno-lint-ignore-next-line -- importing a Deno Edge Function's shared module directly into Vitest works because it's pure TS with zero Deno-specific syntax; that's the whole point of this test.
} from "../../supabase/functions/_shared/messy-data-guards";

// The audit (§3.3) found number/date parsing implemented three-plus times
// with observably different results for the same input across the client
// and server. supabase/functions/_shared/messy-data-guards.ts is a
// tracked, synced copy of the relevant parts of this file rather than a
// shared import (Edge Functions are deployed as isolated per-directory
// bundles, so a cross-tree relative import isn't a safe assumption to
// build on). This test is the guardrail: if the two files ever diverge,
// it fails.
const NUMBER_FIXTURES = [
  "1.234,56", "1,234.56", "1 234,56", "€1.234,56", "$1,234.56",
  "(1,234.56)", "12,5%", "", "not a number", "999999999999999",
  "1.234.567,89", "10K", "2.5M", null, undefined,
];

const DATE_FIXTURES = [
  "2024-01-15", "15.01.2024", "01/15/2024", "2024", "2024-01",
  "45292", "1700000000", "1700000000000", "not a date", "Q1-2024",
  "2024-W03", "FY24-Q2", null, undefined,
];

describe("Number/date parser parity: client vs. Deno Edge Function shared module", () => {
  it.each(NUMBER_FIXTURES)("parseMessyNumber(%j) agrees between runtimes", (input) => {
    const clientResult = clientParseNumber(input);
    const serverResult = serverParseNumber(input);
    if (Number.isNaN(clientResult)) {
      expect(Number.isNaN(serverResult)).toBe(true);
    } else {
      expect(serverResult).toBe(clientResult);
    }
  });

  it.each(DATE_FIXTURES)("parseMessyDate(%j) agrees between runtimes", (input) => {
    expect(serverParseDate(input)).toBe(clientParseDate(input));
  });
});

import { describe, expect, it } from "vitest";
import { parseImpactEstimate } from "../../supabase/functions/_shared/impact-estimate";

describe("parseImpactEstimate", () => {
  it("passes a raw number through unchanged", () => {
    expect(parseImpactEstimate(95000)).toBe(95000);
  });

  it("returns null for null/undefined input", () => {
    expect(parseImpactEstimate(null)).toBeNull();
    expect(parseImpactEstimate(undefined)).toBeNull();
  });

  it("does not mistake risk-score prose for a monetary estimate", () => {
    // Round 4 audit finding: this exact advisory text produced a
    // predicted_net_impact of ~€61 (average of 72, 50, 60) under the old
    // "average every digit in the string" parser, rendering as a bogus
    // "+€11"-style figure next to genuinely large decisions.
    expect(
      parseImpactEstimate("Reduce CFO risk score from 72 to below 50 within 60 days")
    ).toBeNull();
  });

  it("does not mistake a day-count/percentage description for currency", () => {
    expect(parseImpactEstimate("2-4pp churn reduction potential over next quarter")).toBeNull();
  });

  it("extracts a euro figure marked with a currency symbol", () => {
    expect(parseImpactEstimate("Estimated financial exposure is about €420,000.")).toBe(420000);
  });

  it("extracts a dollar figure with a k-suffix", () => {
    expect(parseImpactEstimate("Retain 9-11 of 14 at-risk accounts, preserving $27K-33K MRR")).toBe(27000);
  });

  it("extracts an m-suffixed currency figure", () => {
    expect(parseImpactEstimate("Projected upside of $1.2M over the fiscal year")).toBe(1_200_000);
  });

  it("returns null for prose with no numbers at all", () => {
    expect(parseImpactEstimate("Improve executive visibility into cost drivers")).toBeNull();
  });
});

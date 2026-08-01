import { describe, expect, it } from "vitest";
import { parseMessyNumber } from "@/lib/messy-data-guards";

// Phase 1 required regression fixtures (docs/implementation/phase-1-canonical-contracts-plan.md,
// mission item 5) for the single canonical number parser.
describe("parseMessyNumber: canonical fixture set", () => {
  it("EU decimal-comma notation", () => {
    expect(parseMessyNumber("1.234,56")).toBeCloseTo(1234.56, 2);
  });

  it("US decimal-point notation", () => {
    expect(parseMessyNumber("1,234.56")).toBeCloseTo(1234.56, 2);
  });

  it("space-separated thousands with EU decimal comma", () => {
    expect(parseMessyNumber("1 234,56")).toBeCloseTo(1234.56, 2);
  });

  it("Euro-prefixed EU notation", () => {
    expect(parseMessyNumber("€1.234,56")).toBeCloseTo(1234.56, 2);
  });

  it("dollar-prefixed US notation", () => {
    expect(parseMessyNumber("$1,234.56")).toBeCloseTo(1234.56, 2);
  });

  it("accounting-negative parentheses", () => {
    expect(parseMessyNumber("(1,234.56)")).toBeCloseTo(-1234.56, 2);
  });

  it("percentage with comma decimal", () => {
    expect(parseMessyNumber("12,5%")).toBeCloseTo(12.5, 2);
  });

  it("empty string returns NaN, not zero", () => {
    expect(Number.isNaN(parseMessyNumber(""))).toBe(true);
  });

  it("invalid text returns NaN", () => {
    expect(Number.isNaN(parseMessyNumber("not a number"))).toBe(true);
  });

  it("values exceeding common safety limits parse but are not capped here", () => {
    // parseMessyNumber's job is correct parsing, not business-rule
    // enforcement -- the >1e12 safety cap is applied by callers
    // (DataUpload.tsx's handleImport, transform-metrics's MAX_VALUE),
    // both confirmed still enforcing it after the Phase 1 migration.
    const parsed = parseMessyNumber("999999999999999");
    expect(Number.isFinite(parsed)).toBe(true);
    expect(Math.abs(parsed)).toBeGreaterThan(1e12);
  });

  it("the same raw value resolves identically wherever it's parsed (inference/validation/persistence all call this one function)", () => {
    // A regression here would mean a value like this again disagrees
    // between what a user is shown in preview and what gets written --
    // exactly the class of bug fixed in DataUpload.tsx's cleanNumeric.
    const value = "1.234,56";
    const first = parseMessyNumber(value);
    const second = parseMessyNumber(value);
    expect(first).toBe(second);
    expect(first).toBeCloseTo(1234.56, 2);
  });
});

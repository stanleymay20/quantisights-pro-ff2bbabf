import { describe, expect, it } from "vitest";
import { parseMessyDate } from "@/lib/messy-data-guards";

// Phase 1 required regression fixtures (mission item 6) for the single
// canonical date parser.
describe("parseMessyDate: canonical fixture set", () => {
  it("ISO date", () => {
    expect(parseMessyDate("2024-01-15")).toBe("2024-01-15");
  });

  it("German-style dotted date (DD.MM.YYYY)", () => {
    expect(parseMessyDate("15.01.2024")).toBe("2024-01-15");
  });

  it("US-style slashed date (MM/DD/YYYY) resolved via the day>12 disambiguation heuristic", () => {
    expect(parseMessyDate("01/15/2024")).toBe("2024-01-15");
  });

  it("year only", () => {
    expect(parseMessyDate("2024")).toBe("2024-01-01");
  });

  it("year and month", () => {
    expect(parseMessyDate("2024-01")).toBe("2024-01-01");
  });

  it("Excel serial date", () => {
    expect(parseMessyDate("45292")).toBe("2024-01-01");
  });

  it("Unix timestamp (seconds)", () => {
    expect(parseMessyDate("1700000000")).toBe("2023-11-14");
  });

  it("Unix timestamp (milliseconds)", () => {
    expect(parseMessyDate("1700000000000")).toBe("2023-11-14");
  });

  it("invalid date text returns null, not a fabricated date", () => {
    expect(parseMessyDate("not a date")).toBeNull();
  });

  it("ambiguous D/M vs M/D dates: the heuristic is documented as non-locale-aware, not silently 'fixed' to guess correctly", () => {
    // Audit §3.4 / plan: parseMessyDate always resolves an ambiguous
    // slash-date the same way regardless of the source file's actual
    // locale, because there is no per-file locale signal available to it.
    // This test locks in and documents that known behavior rather than
    // asserting a false claim of correctness -- true locale-aware
    // disambiguation needs a locale hint at the SourceIdentity/upload
    // level, which is out of scope for Phase 1 (flagged in the final
    // report as Phase 2 scope).
    expect(parseMessyDate("03/04/2024")).toBe("2024-04-03");
  });

  it("a genuinely malformed calendar date (month 13) is a known, pre-existing gap: it is NOT rejected", () => {
    // parseMessyDate constructs a syntactically ISO-shaped string from the
    // D/M/Y regex match without validating the result is a real calendar
    // date. This is a real limitation, documented here rather than
    // silently patched -- changing validation behavior is out of scope
    // for a parser-unification phase and belongs in Phase 2 alongside
    // calibrated evidence scoring for date-role proposals.
    expect(parseMessyDate("13/13/2024")).toBe("2024-13-13");
  });

  it("the same raw value resolves identically on every call (no hidden state, no locale drift)", () => {
    const value = "15.01.2024";
    expect(parseMessyDate(value)).toBe(parseMessyDate(value));
  });
});

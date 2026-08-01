import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMessyNumber } from "@/lib/messy-data-guards";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Enterprise data platform audit: DataUpload no longer corrupts EU-formatted numbers on import", () => {
  it("parseMessyNumber correctly reads European decimal-comma notation", () => {
    // Audit finding (docs/audits/enterprise-data-platform-code-audit.md §2):
    // DataUpload.tsx's cleanNumeric() -- the function actually used on the
    // metrics-table write path -- stripped commas unconditionally before
    // parseFloat, so "1.234,56" (one thousand two hundred thirty-four
    // point five six) became "1.234.56" -> parseFloat stops at the second
    // dot -> 1.234. A ~1000x silent understatement with no error raised.
    expect(parseMessyNumber("1.234,56")).toBeCloseTo(1234.56, 2);
    expect(parseMessyNumber("1.234.567,89")).toBeCloseTo(1234567.89, 2);
    // US formatting must still work correctly.
    expect(parseMessyNumber("1,234.56")).toBeCloseTo(1234.56, 2);
    // Currency symbols, accounting negatives, and percentages.
    expect(parseMessyNumber("€1.234,56")).toBeCloseTo(1234.56, 2);
    expect(parseMessyNumber("(1.234,56)")).toBeCloseTo(-1234.56, 2);
  });

  it("DataUpload.tsx's cleanNumeric delegates to the locale-aware parser instead of its own broken implementation", () => {
    const source = read("src/pages/DataUpload.tsx");
    expect(source).toContain('import { parseMessyNumber } from "@/lib/messy-data-guards";');
    expect(source).toContain("const cleanNumeric = (raw: string | undefined): number => parseMessyNumber(raw);");
    // The old body stripped commas unconditionally before parseFloat --
    // confirm that pattern is gone, not just that the import was added.
    expect(source).not.toContain('.replace(/[\\s$€£¥₹,]/g, "")');
  });
});

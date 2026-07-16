import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Phase 1: server-side number/date parsers migrated to the canonical shared module", () => {
  it("transform-metrics no longer has its own broken cleanNumeric/minimal normalizeDate bodies", () => {
    const source = read("supabase/functions/transform-metrics/index.ts");
    expect(source).toContain('import { parseMessyDate, parseMessyNumber } from "../_shared/messy-data-guards.ts";');
    expect(source).toContain("return parseMessyNumber(raw);");
    expect(source).toContain("return parseMessyDate(val);");
    // The old body stripped commas unconditionally before parseFloat --
    // confirm that exact broken pattern is gone from this file too (it
    // was already removed from DataUpload.tsx in the P0 fix).
    expect(source).not.toContain('.replace(/[\\s$€£¥₹,]/g, "")');
  });

  it("ingest-pipeline's pickNumber/pickDate delegate to the canonical parser instead of their own minimal logic", () => {
    const source = read("supabase/functions/_shared/ingest-pipeline.ts");
    expect(source).toContain('import { parseMessyDate, parseMessyNumber } from "./messy-data-guards.ts";');
    expect(source).toContain("const n = parseMessyNumber(String(v));");
    expect(source).toContain("return parseMessyDate(String(v));");
  });

  it("the canonical Deno-side module exists and exports both functions", () => {
    const source = read("supabase/functions/_shared/messy-data-guards.ts");
    expect(source).toContain("export function parseMessyNumber(");
    expect(source).toContain("export function parseMessyDate(");
  });
});

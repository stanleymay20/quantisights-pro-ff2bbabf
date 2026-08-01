import { describe, expect, it } from "vitest";
import {
  computeRepresentativeSample,
  FULL_SCAN_ROW_THRESHOLD,
  sampleRows,
  SAMPLING_VERSION,
} from "@/lib/ingestion-contracts";

describe("Representative sampling: reproducibility and coverage", () => {
  it("small datasets get a full scan, not an approximation", () => {
    const { indices, strategy } = computeRepresentativeSample(FULL_SCAN_ROW_THRESHOLD, "checksum-a");
    expect(strategy.mode).toBe("full_scan");
    expect(indices.length).toBe(FULL_SCAN_ROW_THRESHOLD);
    expect(strategy.rowCoverage).toBe(1);
  });

  it("large datasets sample from beginning, middle, end, and a random spread", () => {
    const { indices, strategy } = computeRepresentativeSample(50_000, "checksum-b");
    expect(strategy.mode).toBe("representative");
    expect(strategy.segments.beginning).toBeGreaterThan(0);
    expect(strategy.segments.middle).toBeGreaterThan(0);
    expect(strategy.segments.end).toBeGreaterThan(0);
    expect(strategy.segments.random).toBeGreaterThan(0);

    // Confirms this actually catches the audit's "rows 101-50000 differ
    // from rows 1-100" failure mode -- indices must span well beyond the
    // legacy 100-row window.
    expect(Math.max(...indices)).toBeGreaterThan(40_000);
    expect(Math.min(...indices)).toBeLessThan(100);
    const hasMiddleIndex = indices.some((i) => i > 20_000 && i < 30_000);
    expect(hasMiddleIndex).toBe(true);
  });

  it("the same checksum + version + row count always produces the same sample (reproducible)", () => {
    const a = computeRepresentativeSample(50_000, "same-checksum");
    const b = computeRepresentativeSample(50_000, "same-checksum");
    expect(a.indices).toEqual(b.indices);
    expect(a.strategy).toEqual(b.strategy);
  });

  it("a different checksum produces a different random component", () => {
    const a = computeRepresentativeSample(50_000, "checksum-x");
    const b = computeRepresentativeSample(50_000, "checksum-y");
    expect(a.indices).not.toEqual(b.indices);
  });

  it("every profile records the actual sampling method used (mode, version, checksum, coverage)", () => {
    const { strategy } = computeRepresentativeSample(1000, "checksum-z");
    expect(strategy.samplingVersion).toBe(SAMPLING_VERSION);
    expect(strategy.sourceChecksum).toBe("checksum-z");
    expect(strategy.totalRows).toBe(1000);
    expect(strategy.sampleSize).toBeGreaterThan(0);
  });

  it("sampleRows returns the actual row values at the selected indices", () => {
    const rows = Array.from({ length: 1000 }, (_, i) => `row-${i}`);
    const { sampled, strategy } = sampleRows(rows, "checksum-rows");
    expect(sampled.length).toBe(strategy.sampleSize);
    expect(sampled.every((v) => rows.includes(v))).toBe(true);
  });

  it("zero rows does not throw and reports zero coverage", () => {
    const { indices, strategy } = computeRepresentativeSample(0, "checksum-empty");
    expect(indices).toEqual([]);
    expect(strategy.rowCoverage).toBe(0);
  });
});

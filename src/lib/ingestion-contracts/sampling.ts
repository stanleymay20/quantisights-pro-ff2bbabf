// Representative sampling contract + utility.
//
// The audit (§3.6) found every inference stage samples only the first
// 100-1000 rows of a dataset, with no record of whether a mapping came
// from a full scan or a partial, non-representative sample. This module
// is the replacement primitive: given a row count and a source checksum,
// it deterministically selects indices from the beginning, middle, end,
// and a pseudo-random spread, and records exactly what it did.
//
// Reproducibility: the same (checksum, samplingVersion, totalRows,
// targetSampleSize) always produces the same selected indices, because the
// pseudo-random component is seeded from a hash of those inputs rather
// than Math.random().
import { z } from "zod";

export const SAMPLING_VERSION = "1.0.0";

export const SamplingModeSchema = z.enum(["full_scan", "representative"]);
export type SamplingMode = z.infer<typeof SamplingModeSchema>;

export const SamplingStrategySchema = z.object({
  mode: SamplingModeSchema,
  samplingVersion: z.string().min(1),
  sourceChecksum: z.string().min(1),
  totalRows: z.number().int().nonnegative(),
  sampleSize: z.number().int().nonnegative(),
  rowCoverage: z.number().min(0).max(1),
  segments: z.object({
    beginning: z.number().int().nonnegative(),
    middle: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    random: z.number().int().nonnegative(),
  }),
});
export type SamplingStrategy = z.infer<typeof SamplingStrategySchema>;

/** Below this row count, sample everything rather than approximating. */
export const FULL_SCAN_ROW_THRESHOLD = 500;

/** Target sample size for representative sampling above the full-scan threshold. */
export const DEFAULT_TARGET_SAMPLE_SIZE = 400;

/** FNV-1a: small, dependency-free, deterministic string hash used to seed the PRNG. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: small, deterministic PRNG. Same seed always yields the same sequence. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SampleResult {
  indices: number[];
  strategy: SamplingStrategy;
}

/**
 * Deterministically selects row indices for profiling/inference.
 *
 * @param totalRows total row count of the source (excluding header)
 * @param sourceChecksum checksum of the source file/table (drives reproducibility)
 * @param targetSampleSize desired sample size when not doing a full scan
 */
export function computeRepresentativeSample(
  totalRows: number,
  sourceChecksum: string,
  targetSampleSize: number = DEFAULT_TARGET_SAMPLE_SIZE,
): SampleResult {
  if (totalRows <= FULL_SCAN_ROW_THRESHOLD) {
    return {
      indices: Array.from({ length: totalRows }, (_, i) => i),
      strategy: SamplingStrategySchema.parse({
        mode: "full_scan",
        samplingVersion: SAMPLING_VERSION,
        sourceChecksum,
        totalRows,
        sampleSize: totalRows,
        rowCoverage: totalRows === 0 ? 0 : 1,
        segments: { beginning: totalRows, middle: 0, end: 0, random: 0 },
      }),
    };
  }

  const sampleSize = Math.min(targetSampleSize, totalRows);
  // Split the budget: 30% beginning, 20% middle, 20% end, 30% random spread
  // -- beginning gets the largest fixed share because header-adjacent rows
  // are what most existing consumers already relied on, so a regression
  // there would be the most visible; the random component exists
  // specifically to catch the "rows 101-50000 differ from rows 1-100"
  // failure mode the audit called out.
  const beginningCount = Math.round(sampleSize * 0.3);
  const middleCount = Math.round(sampleSize * 0.2);
  const endCount = Math.round(sampleSize * 0.2);
  const randomCount = Math.max(0, sampleSize - beginningCount - middleCount - endCount);

  const selected = new Set<number>();
  for (let i = 0; i < beginningCount; i++) selected.add(i);

  const middleStart = Math.max(0, Math.floor(totalRows / 2) - Math.floor(middleCount / 2));
  for (let i = 0; i < middleCount; i++) selected.add(Math.min(totalRows - 1, middleStart + i));

  for (let i = 0; i < endCount; i++) selected.add(Math.max(0, totalRows - 1 - i));

  const rng = mulberry32(fnv1a(`${sourceChecksum}:${SAMPLING_VERSION}:${totalRows}:${targetSampleSize}`));
  let guardIterations = 0;
  while (selected.size < beginningCount + middleCount + endCount + randomCount && guardIterations < totalRows * 4) {
    guardIterations++;
    const candidate = Math.floor(rng() * totalRows);
    selected.add(candidate);
  }

  const indices = Array.from(selected).sort((a, b) => a - b);

  return {
    indices,
    strategy: SamplingStrategySchema.parse({
      mode: "representative",
      samplingVersion: SAMPLING_VERSION,
      sourceChecksum,
      totalRows,
      sampleSize: indices.length,
      rowCoverage: totalRows === 0 ? 0 : indices.length / totalRows,
      segments: { beginning: beginningCount, middle: middleCount, end: endCount, random: randomCount },
    }),
  };
}

/** Convenience: sample an in-memory row array using computeRepresentativeSample. */
export function sampleRows<T>(
  rows: T[],
  sourceChecksum: string,
  targetSampleSize: number = DEFAULT_TARGET_SAMPLE_SIZE,
): { sampled: T[]; strategy: SamplingStrategy } {
  const { indices, strategy } = computeRepresentativeSample(rows.length, sourceChecksum, targetSampleSize);
  return { sampled: indices.map((i) => rows[i]), strategy };
}

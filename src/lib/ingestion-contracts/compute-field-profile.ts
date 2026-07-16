// Computes a canonical FieldProfile from a column's sampled raw values.
// Composed entirely from the REAL, production primitives in
// src/lib/messy-data-guards.ts (parseMessyNumber, parseMessyDate,
// isBooleanLike, isIdentifierLike, isPotentialPiiHeader, normalizeCell) --
// the same functions every legacy inference module already calls through.
// This is new code (Phase 1 didn't have a field-profile contract before),
// not a duplicate of legacy logic: it's what the canonical profiling
// layer composes those shared primitives into, honoring the "no
// reimplemented logic" rule for the primitives themselves.
import {
  isBooleanLike,
  isIdentifierLike,
  isPotentialPiiHeader,
  normalizeCell,
  parseMessyDate,
  parseMessyNumber,
} from "@/lib/messy-data-guards";
import { sampleRows } from "./sampling";
import { FieldProfileSchema, type FieldProfile } from "./field-profile";

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export interface ComputeFieldProfileArgs {
  sheetOrTableIdentity: string;
  originalHeader: string;
  originalColumnPosition: number;
  /** every value in the column, in original row order (not pre-sampled -- this function samples internally so the strategy is recorded consistently) */
  columnValues: string[];
  sourceChecksum: string;
}

export function computeFieldProfile(args: ComputeFieldProfileArgs): FieldProfile {
  const { sampled, strategy } = sampleRows(args.columnValues, args.sourceChecksum);
  const clean = sampled.map(normalizeCell).filter((v) => v.length > 0);
  const nonEmptyCount = clean.length;
  const totalSampled = sampled.length;

  const numericRate = totalSampled === 0 ? 0 : clean.filter((v) => Number.isFinite(parseMessyNumber(v))).length / totalSampled;
  const dateRate = totalSampled === 0 ? 0 : clean.filter((v) => parseMessyDate(v) !== null).length / totalSampled;
  const booleanRate = totalSampled === 0 ? 0 : clean.filter(isBooleanLike).length / totalSampled;
  const identifierRate = totalSampled === 0 ? 0 : clean.filter(isIdentifierLike).length / totalSampled;
  const distinctValues = new Set(clean.map((v) => v.toLowerCase()));

  const normalizedHeader = normalizeHeader(args.originalHeader);
  const headerLooksPii = isPotentialPiiHeader(args.originalHeader);
  const emailRate = totalSampled === 0 ? 0 : clean.filter((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)).length / totalSampled;

  const anomalies: string[] = [];
  if (totalSampled > 0 && nonEmptyCount === 0) anomalies.push("all sampled values are empty/null-like");
  if (numericRate > 0 && numericRate < 1 && dateRate === 0 && booleanRate === 0) {
    anomalies.push(`mixed numeric/non-numeric values: numericRate=${numericRate.toFixed(2)}`);
  }

  const profile: FieldProfile = {
    fieldId: `${args.sheetOrTableIdentity}:${args.originalColumnPosition}`,
    originalHeader: args.originalHeader,
    normalizedHeader,
    originalColumnPosition: args.originalColumnPosition,
    samplingStrategy: strategy,
    nullRate: totalSampled === 0 ? 1 : 1 - nonEmptyCount / totalSampled,
    distinctCount: distinctValues.size,
    approximateCardinality: strategy.mode === "representative",
    numericRate,
    dateRate,
    booleanRate,
    identifierLikelihood: identifierRate,
    piiLikelihood: headerLooksPii ? Math.max(0.7, emailRate) : emailRate,
    detectedFormats: [],
    representativeValues: Array.from(distinctValues).slice(0, 20),
    anomalies,
  };

  return FieldProfileSchema.parse(profile);
}

// Canonical parsed-tabular representation. This is the boundary between
// "physical parsing" and everything downstream (profiling, inference,
// mapping) -- it assigns no business meaning, only structure + provenance.
import { z } from "zod";

export const ParsingEvidenceSchema = z.object({
  parserName: z.string().min(1),
  parserVersion: z.string().min(1),
  headerRowIndex: z.number().int().nonnegative(),
  detectionMethod: z.string().min(1), // e.g. "scored_header_scan(first_10_rows)", "single_row_assumed"
  notes: z.array(z.string()).default([]),
});
export type ParsingEvidence = z.infer<typeof ParsingEvidenceSchema>;

export const ParsedCellSchema = z.object({
  originalColumnPosition: z.number().int().nonnegative(),
  // The value as it appeared in the source, before any normalization.
  // Some existing parsers (see compat/from-parsed-csv.ts) normalize at
  // parse time and don't retain a separate raw value -- in that case
  // rawValue === normalizedValue and a warning notes the limitation,
  // rather than the contract silently pretending it has raw evidence it
  // doesn't.
  rawValue: z.string(),
  normalizedValue: z.string(),
  warnings: z.array(z.string()).default([]),
});
export type ParsedCell = z.infer<typeof ParsedCellSchema>;

export const ParsedRowSchema = z.object({
  originalRowNumber: z.number().int().nonnegative(),
  cells: z.array(ParsedCellSchema),
});
export type ParsedRow = z.infer<typeof ParsedRowSchema>;

export const ParsedTabularDataSchema = z.object({
  sheetOrTableIdentity: z.string().min(1),
  headers: z.array(z.string()),
  rows: z.array(ParsedRowSchema),
  totalRowCount: z.number().int().nonnegative(),
  parsingEvidence: ParsingEvidenceSchema,
  warnings: z.array(z.string()).default([]),
});
export type ParsedTabularData = z.infer<typeof ParsedTabularDataSchema>;

/** Row values only, in original column order -- convenience view for code that doesn't need cell-level provenance. */
export function toPlainRows(data: ParsedTabularData): string[][] {
  return data.rows.map((row) => row.cells.map((cell) => cell.normalizedValue));
}

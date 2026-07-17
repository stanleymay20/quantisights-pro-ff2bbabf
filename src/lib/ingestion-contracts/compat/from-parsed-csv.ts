// Compatibility adapter: converts the REAL, production `parseCSVText()`
// (src/lib/data-upload-utils.ts) and `parseWorkbookFile()`
// (src/lib/workbook-parser.ts) output into the canonical ParsedTabularData
// contract. Neither legacy parser is modified -- this only wraps their
// existing, already-shipped output.
import { computeContentChecksum } from "../checksum";
import { fail, makeProcessingError, ok, type ContractResult } from "../errors";
import {
  ParsedTabularDataSchema,
  type ParsedTabularData,
} from "../parsed-tabular";
import type { WorkbookSheet } from "@/lib/workbook-parser";

const ADAPTER_NAME = "compat:from-parsed-csv";

/**
 * Both parseCSVText and the workbook parser normalize each cell (via
 * normalizeCell) at parse time and do not retain a separate pre-normalized
 * raw value. rawValue is therefore set equal to normalizedValue here, with
 * a dataset-level warning recorded -- this is a known, documented
 * limitation of wrapping the legacy output rather than the contract
 * silently claiming raw-value provenance it doesn't have.
 */
const RAW_VALUE_NOT_RETAINED_WARNING =
  "source parser normalizes cells before this adapter sees them; rawValue equals normalizedValue for this dataset";

function buildParsedTabularData(
  sheetOrTableIdentity: string,
  headers: string[],
  rows: string[][],
  parserName: string,
  parserVersion: string,
  detectionMethod: string,
  headerRowIndex: number,
): ContractResult<ParsedTabularData> {
  if (headers.length === 0) {
    return fail(
      makeProcessingError({
        code: "empty_headers",
        stage: "physical_parsing",
        severity: "fatal",
        sheetOrTable: sheetOrTableIdentity,
        userMessage: "This sheet or file has no detectable header row.",
        technicalMessage: `${ADAPTER_NAME}: received zero headers for "${sheetOrTableIdentity}"`,
        retryable: false,
        suggestedAction: "Confirm the file has a header row and re-upload.",
      }),
    );
  }

  const warnings: string[] = [RAW_VALUE_NOT_RETAINED_WARNING];
  const parsedRows = rows.map((row, rowIdx) => {
    const cellWarnings: string[] = [];
    if (row.length !== headers.length) {
      cellWarnings.push(`row has ${row.length} cells, expected ${headers.length} (header count)`);
    }
    return {
      originalRowNumber: rowIdx,
      cells: headers.map((_, colIdx) => {
        const value = row[colIdx] ?? "";
        return {
          originalColumnPosition: colIdx,
          rawValue: value,
          normalizedValue: value,
          warnings: colIdx >= row.length ? [...cellWarnings, "missing cell, defaulted to empty string"] : [],
        };
      }),
    };
  });

  const data: ParsedTabularData = ParsedTabularDataSchema.parse({
    sheetOrTableIdentity,
    headers,
    rows: parsedRows,
    totalRowCount: rows.length,
    parsingEvidence: {
      parserName,
      parserVersion,
      headerRowIndex,
      detectionMethod,
      notes: [],
    },
    warnings,
  });

  return ok(data);
}

export function fromCsvParseResult(
  parsed: { headers: string[]; rows: string[][] },
  sheetOrTableIdentity: string = "csv",
): ContractResult<ParsedTabularData> {
  return buildParsedTabularData(
    sheetOrTableIdentity,
    parsed.headers,
    parsed.rows,
    "parseCSVText",
    "legacy",
    "single_row_assumed",
    0,
  );
}

export function fromWorkbookSheet(sheet: WorkbookSheet): ContractResult<ParsedTabularData> {
  return buildParsedTabularData(
    sheet.name,
    sheet.headers,
    sheet.rows,
    "parseWorkbookFile",
    "legacy",
    "scored_header_scan(first_10_rows)",
    0, // detectHeaderRowIndex() is internal to parseWorkbookFile and not exposed on WorkbookSheet; the sheet's rows already start after the detected header.
  );
}

/** Content checksum for a parsed CSV/workbook sheet, for use as SamplingStrategy.sourceChecksum. */
export function checksumForParsedTable(headers: string[], rows: string[][]): string {
  return computeContentChecksum(`${headers.join("")}${rows.length}${rows[0]?.join("") ?? ""}${rows[rows.length - 1]?.join("") ?? ""}`);
}

// ---- Data Upload Utility Functions ----
// Extracted from DataUpload.tsx for maintainability.
// All ingestion stages (parse → infer → validate → diagnose) share a single
// normalization layer from messy-data-guards.ts so behavior stays consistent.
// The inference rules intentionally let sampled values override header keywords.
// Example: sales_channel contains "sales" but values are text, so it must be a segment, not a metric.

import Papa from "papaparse";
import {
  deduplicateHeaders,
  isBooleanLike,
  isEmailLike,
  isIdentifierHeader,
  isIdentifierLike,
  isPhoneLike,
  isPotentialPiiHeader,
  normalizeCell,
  parseMessyDate,
  parseMessyNumber,
} from "./messy-data-guards";

export const COUNTRY_SAMPLES = new Set([
  "united states", "usa", "us", "china", "india", "germany", "france", "japan",
  "united kingdom", "uk", "brazil", "canada", "australia", "italy", "spain",
  "mexico", "south korea", "russia", "indonesia", "turkey", "saudi arabia",
  "netherlands", "switzerland", "sweden", "norway", "denmark", "finland",
  "egypt", "nigeria", "south africa", "argentina", "colombia", "chile",
  "ghana", "uae", "qatar", "kuwait", "bahrain", "oman", "iraq", "iran", "israel",
  "thailand", "vietnam", "malaysia", "singapore", "philippines", "pakistan",
  "bangladesh", "poland", "portugal", "greece", "czech republic", "austria",
  "belgium", "ireland", "new zealand", "peru", "venezuela",
]);

export type ColumnTarget =
  | "date"
  | "value"
  | "region"
  | "region_code"
  | "segment"
  | "metric_type"
  | "skip";

export interface DetectedSchema {
  column: string;
  colIdx: number;
  inferredType: ColumnTarget;
  confidence: number;
  reason: string;
  sampleValues: string[];
  rulesApplied: string[];
  autoFix?: "year_to_date";
}

export type ColumnMapping = Record<number, ColumnTarget>;

export interface ValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  validPoints: number;
  invalidPoints: number;
  totalPoints: number;
  errors: HumanizedError[];
  qualityScore: number;
  completeness: number;
  dateRange: { min: string; max: string } | null;
  valueRange: { min: number; max: number } | null;
}

export interface HumanizedError {
  row: number;
  rawMessage: string;
  friendlyTitle: string;
  friendlyDescription: string;
  suggestion?: string;
  autoFixable: boolean;
  fixType?: "year_to_date" | "remove_row" | "trim_value";
}

export interface DatasetIntelligence {
  recordCount: number;
  validPointCount: number;
  columnCount: number;
  dateSpan: string | null;
  regionCount: number;
  regions: string[];
  metricTypes: string[];
  signals: { icon: string; title: string; description: string }[];
  qualityScore: number;
  qualityLabel: string;
}

export interface DatasetDiagnostics {
  missingValuesPct: number;
  outlierCount: number;
  duplicateRows: number;
  dateContinuity: "OK" | "Gaps detected" | "N/A";
  dateGapCount: number;
  piiRisk: {
    level: "none" | "low" | "high";
    columns: string[];
  };
}

export interface DatasetClassification {
  type: string;
  confidence: number;
  subType?: string;
  recommendedWorkflows: string[];
}

export type ImportMode = "single" | "multi";

const NOT_DATE_PATTERNS = [
  /_years$/i, /^life_expectancy/i, /^tenure/i, /^age$/i, /^duration/i,
  /_duration$/i, /_age$/i, /^experience/i, /^months$/i, /^days$/i,
  /_months$/i, /_days$/i, /_count$/i, /^headcount$/i,
];

const TEXT_DIMENSION_HEADER_PATTERNS = [
  /(^|_)channel($|_)/i, /(^|_)sales_channel($|_)/i, /(^|_)department($|_)/i,
  /(^|_)region($|_)/i, /(^|_)country($|_)/i, /(^|_)supplier($|_)/i,
  /(^|_)vendor($|_)/i, /(^|_)product($|_)/i, /(^|_)product_line($|_)/i,
  /(^|_)category($|_)/i, /(^|_)segment($|_)/i, /(^|_)industry($|_)/i,
  /(^|_)owner($|_)/i, /(^|_)executive_owner($|_)/i, /(^|_)flag($|_)/i,
  /(^|_)decision_flag($|_)/i, /(^|_)status($|_)/i, /(^|_)type($|_)/i,
];

const PERIOD_HEADER_PATTERNS = [
  /^date$/i,
  /^month$/i,
  /^quarter$/i,
  /^period$/i,
  /^fiscal_period$/i,
  /^reporting_period$/i,
  /^week$/i,
  /^year$/i,
  /(^|_)date$/i,
  /(^|_)month$/i,
  /(^|_)quarter$/i,
  /(^|_)period$/i,
];

const METRIC_HEADER_KEYWORDS = [
  "value", "amount", "revenue", "gdp", "price", "cost", "total", "income",
  "profit", "spend", "rate", "inflation", "unemployment", "expectancy", "growth",
  "index", "score", "throughput", "utilization", "headcount", "attrition", "nps",
  "satisfaction", "conversion", "churn", "retention", "margin", "balance",
  "receivable", "payable", "orders", "customers", "employees", "units", "turnover",
  "delivery", "defect", "returns", "lead_time",
];

function isNotDateHeader(header: string): boolean {
  return NOT_DATE_PATTERNS.some(p => p.test(header.trim()));
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function isProtectedPeriodHeader(lower: string): boolean {
  return PERIOD_HEADER_PATTERNS.some(p => p.test(lower));
}

function cleanNumericVal(raw: string | undefined): number {
  return parseMessyNumber(raw);
}

function isNumericValue(raw: string | undefined): boolean {
  return Number.isFinite(parseMessyNumber(raw));
}

function isDateValue(raw: string | undefined): boolean {
  return parseMessyDate(raw) !== null;
}

function toDateValue(raw: string | undefined): string | null {
  return parseMessyDate(raw);
}

function cardinality(samples: string[]): number {
  return new Set(samples.map(s => s.toLowerCase().trim()).filter(Boolean)).size;
}

export function parseCSVText(text: string): { headers: string[]; rows: string[][] } {
  const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const result = Papa.parse(cleaned.trim(), {
    header: false,
    skipEmptyLines: "greedy",
    transformHeader: (h: string) => h.trim(),
    transform: (val: string) => normalizeCell(val),
  });
  const data = result.data as string[][];
  if (data.length < 2) return { headers: [], rows: [] };
  const rawHeaders = data[0].map(h => (h ?? "").replace(/^"|"$/g, "").trim());
  const headers = deduplicateHeaders(rawHeaders);
  const rows = data.slice(1).filter(row => row.some(cell => cell && cell.trim()));
  return { headers, rows };
}

export function slugifyMetric(name: string): string {
  return name
    .toLowerCase()
    .replace(/[%]/g, "_pct")
    .replace(/[/]/g, "_per_")
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function deduplicateMetricSlugs(slugs: string[]): string[] {
  const counts = new Map<string, number>();
  return slugs.map(s => {
    const count = (counts.get(s) ?? 0) + 1;
    counts.set(s, count);
    return count > 1 ? `${s}_${count}` : s;
  });
}

function findMappedIdx(mapping: ColumnMapping, target: string): number {
  const entry = Object.entries(mapping).find(([, v]) => v === target);
  return entry ? Number(entry[0]) : -1;
}

function findAllMappedIdx(mapping: ColumnMapping, target: string): number[] {
  return Object.entries(mapping)
    .filter(([, v]) => v === target)
    .map(([k]) => Number(k));
}

export function inferSchema(headers: string[], rows: string[][]): DetectedSchema[] {
  const sampleRows = rows.slice(0, Math.min(rows.length, 100));

  const detections: DetectedSchema[] = headers.map((header, colIdx) => {
    const samples = sampleRows.map(r => r[colIdx]).filter(v => v && v.trim());
    const lower = normalizeHeader(header);
    const uniqueValues = cardinality(samples);
    const numericCount = samples.filter(isNumericValue).length;
    const numericRate = numericCount / Math.max(samples.length, 1);
    const dateCount = samples.filter(isDateValue).length;
    const dateRate = dateCount / Math.max(samples.length, 1);
    const isTextDimensionHeader = TEXT_DIMENSION_HEADER_PATTERNS.some(p => p.test(lower));
    const metricKeyword = METRIC_HEADER_KEYWORDS.find(k => lower.includes(k));

    if (samples.length === 0) {
      return {
        column: header,
        colIdx,
        inferredType: "skip",
        confidence: 30,
        reason: "No sample values found",
        sampleValues: [],
        rulesApplied: ["empty_samples"],
      };
    }

    // Identifier guard — never treat IDs/SKUs/UUIDs as numeric metrics.
    const idValueRate =
      samples.filter(s => isIdentifierLike(s)).length / Math.max(samples.length, 1);
    if (isIdentifierHeader(header) || idValueRate > 0.6) {
      return {
        column: header,
        colIdx,
        inferredType: "segment",
        confidence: 90,
        reason: "Identifier column detected (kept as segment, not a metric)",
        sampleValues: samples.slice(0, 3),
        rulesApplied: ["identifier_guard", `idValueRate=${(idValueRate * 100).toFixed(0)}%`],
      };
    }

    // Boolean guard — true/false, yes/no, y/n, 0/1.
    const boolRate =
      samples.filter(s => isBooleanLike(s)).length / Math.max(samples.length, 1);
    if (boolRate >= 0.9 && uniqueValues <= 3) {
      return {
        column: header,
        colIdx,
        inferredType: "segment",
        confidence: 88,
        reason: "Boolean-like column detected",
        sampleValues: samples.slice(0, 3),
        rulesApplied: ["boolean_guard", `boolRate=${(boolRate * 100).toFixed(0)}%`],
      };
    }

    // Protected time bucket rule. Month/quarter/period fields are never numeric metrics.
    if (!isNotDateHeader(header) && isProtectedPeriodHeader(lower)) {
      const allYears = samples.every(s => /^\d{4}$/.test(s.trim()));
      const inferredType: ColumnTarget = dateRate >= 0.6 ? "date" : "segment";
      return {
        column: header,
        colIdx,
        inferredType,
        confidence: inferredType === "date" ? 96 : 86,
        reason: inferredType === "date"
          ? "Protected period/time column detected"
          : "Protected period label kept as segment",
        sampleValues: samples.slice(0, 3),
        autoFix: allYears ? "year_to_date" : undefined,
        rulesApplied: ["protected_period_header", `dateRate=${(dateRate * 100).toFixed(0)}%`, `numericRate=${(numericRate * 100).toFixed(0)}%`],
      };
    }

    if (isTextDimensionHeader && numericRate < 0.8) {
      const type: ColumnTarget = lower.includes("region") || lower.includes("country") ? "region" : "segment";
      return {
        column: header,
        colIdx,
        inferredType: type,
        confidence: 92,
        reason: "Categorical business dimension detected from header and text samples",
        sampleValues: samples.slice(0, 3),
        rulesApplied: ["header_match:text_dimension", `numericRate=${(numericRate * 100).toFixed(0)}%`],
      };
    }

    const isDateHeader = !isNotDateHeader(header) && (
      lower === "date" || lower === "year" || lower === "period" || lower === "time" ||
      lower === "month" || lower === "quarter" || lower.endsWith("_date") || lower.startsWith("date_")
    );

    if (isDateHeader && dateRate >= 0.9) {
      const allYears = samples.every(s => /^\d{4}$/.test(s.trim()));
      return {
        column: header,
        colIdx,
        inferredType: "date",
        confidence: lower === "date" ? 98 : 90,
        reason: allYears ? "Year values detected" : "Date-like values detected",
        sampleValues: samples.slice(0, 3),
        autoFix: allYears ? "year_to_date" : undefined,
        rulesApplied: ["header_match:date_keyword", `dateRate=${(dateRate * 100).toFixed(0)}%`],
      };
    }

    if ((lower.includes("region") || lower.includes("country") || lower.includes("nation") || lower.includes("state") || lower.includes("territory")) && numericRate < 0.8) {
      return {
        column: header,
        colIdx,
        inferredType: "region",
        confidence: 90,
        reason: "Geographic dimension detected",
        sampleValues: samples.slice(0, 3),
        rulesApplied: ["header_match:geo_keyword"],
      };
    }

    const countryMatchRate = samples.filter(s => COUNTRY_SAMPLES.has(s.toLowerCase().trim())).length / Math.max(samples.length, 1);
    if (countryMatchRate > 0.5) {
      return {
        column: header,
        colIdx,
        inferredType: "region",
        confidence: 88,
        reason: `${Math.round(countryMatchRate * 100)}% of values match known countries`,
        sampleValues: samples.slice(0, 3),
        rulesApplied: ["COUNTRY_SAMPLES", `matchRate=${(countryMatchRate * 100).toFixed(0)}%`],
      };
    }

    if ((lower.includes("code") || lower.includes("iso") || lower.includes("site_id") || lower.includes("dept_id")) && numericRate < 0.8) {
      const codeRate = samples.filter(s => /^[A-Z0-9_-]{2,12}$/i.test(s.trim())).length / Math.max(samples.length, 1);
      if (codeRate > 0.7) {
        return {
          column: header,
          colIdx,
          inferredType: "region_code",
          confidence: 82,
          reason: "Short business/location codes detected",
          sampleValues: samples.slice(0, 3),
          rulesApplied: ["header_match:code_keyword", `codeRate=${(codeRate * 100).toFixed(0)}%`],
        };
      }
    }

    // Critical guard: header keywords alone are not enough. Values must be numeric.
    if (metricKeyword && numericRate >= 0.85) {
      return {
        column: header,
        colIdx,
        inferredType: "value",
        confidence: Math.round(78 + numericRate * 20),
        reason: "Numeric metric column detected from header and sampled values",
        sampleValues: samples.slice(0, 3),
        rulesApplied: [`header_match:${metricKeyword}`, `numericRate=${(numericRate * 100).toFixed(0)}%`],
      };
    }

    if (metricKeyword && numericRate < 0.85) {
      return {
        column: header,
        colIdx,
        inferredType: "segment",
        confidence: 86,
        reason: "Header sounded like a metric, but sampled values are text",
        sampleValues: samples.slice(0, 3),
        rulesApplied: [`header_match:${metricKeyword}`, "value_guard:demoted_to_segment", `numericRate=${(numericRate * 100).toFixed(0)}%`],
      };
    }

    const avgMagnitude = samples.reduce((sum, s) => sum + Math.abs(cleanNumericVal(s) || 0), 0) / Math.max(samples.length, 1);
    if (numericRate >= 0.95 && avgMagnitude > 0) {
      const allLookLikeYears = samples.every(s => {
        const n = cleanNumericVal(s);
        return n >= 1900 && n <= 2100 && Number.isInteger(n);
      });
      return {
        column: header,
        colIdx,
        inferredType: allLookLikeYears && !lower.includes("amount") && !lower.includes("value") ? "skip" : "value",
        confidence: allLookLikeYears ? 55 : 82,
        reason: allLookLikeYears ? "Ambiguous year-like numeric values" : "Numeric values detected by sample statistics",
        sampleValues: samples.slice(0, 3),
        rulesApplied: [`numericRate=${(numericRate * 100).toFixed(0)}%`, `avgMagnitude=${avgMagnitude.toFixed(1)}`],
      };
    }

    if (lower.includes("metric") || lower.includes("indicator") || lower.includes("measure")) {
      return {
        column: header,
        colIdx,
        inferredType: "metric_type",
        confidence: 80,
        reason: "Metric identifier column detected",
        sampleValues: samples.slice(0, 3),
        rulesApplied: ["header_match:metric_type"],
      };
    }

    if (uniqueValues <= Math.max(50, samples.length * 0.8) && numericRate < 0.3) {
      return {
        column: header,
        colIdx,
        inferredType: "segment",
        confidence: uniqueValues <= 20 ? 75 : 62,
        reason: `Text category detected (${uniqueValues} unique sampled values)`,
        sampleValues: samples.slice(0, 3),
        rulesApplied: [`uniqueValues=${uniqueValues}`, `numericRate=${(numericRate * 100).toFixed(0)}%`],
      };
    }

    return {
      column: header,
      colIdx,
      inferredType: "skip",
      confidence: 40,
      reason: "No clear pattern detected",
      sampleValues: samples.slice(0, 3),
      rulesApplied: ["no_rule_matched"],
    };
  });

  const dateDetections = detections.filter(d => d.inferredType === "date");
  if (dateDetections.length > 1) {
    const bestDate = dateDetections.reduce((best, d) => d.confidence > best.confidence ? d : best);
    detections.forEach((d) => {
      if (d.inferredType === "date" && d.colIdx !== bestDate.colIdx) {
        const samples = sampleRows.map(r => r[d.colIdx]).filter(Boolean);
        const uniqueValues = cardinality(samples);
        (d as { inferredType: ColumnTarget }).inferredType = "segment";
        d.reason = "Secondary date-like column kept as segment for grouping";
        d.confidence = 75;
        d.rulesApplied = [...d.rulesApplied, "single_date_rule:demoted_to_segment", `uniqueValues=${uniqueValues}`];
      }
    });
  }

  return detections;
}

export function humanizeError(row: number, rawMessage: string): HumanizedError {
  const lower = rawMessage.toLowerCase();

  if (lower.includes("invalid date") || lower.includes("date format")) {
    const yearMatch = rawMessage.match(/"(\d{4})"/);
    if (yearMatch) {
      return {
        row, rawMessage,
        friendlyTitle: "Year-only date detected",
        friendlyDescription: `Row ${row} contains "${yearMatch[1]}" instead of a full date.`,
        suggestion: `We can convert this automatically: ${yearMatch[1]} → ${yearMatch[1]}-01-01`,
        autoFixable: true, fixType: "year_to_date",
      };
    }
    return {
      row, rawMessage,
      friendlyTitle: "Date format issue",
      friendlyDescription: `Row ${row} has an unrecognized date format.`,
      suggestion: "Expected format: YYYY-MM-DD or YYYY-MM.",
      autoFixable: false,
    };
  }

  if (lower.includes("missing date")) {
    return {
      row, rawMessage,
      friendlyTitle: "Missing date",
      friendlyDescription: `Row ${row} is missing a date value.`,
      suggestion: "This row will be skipped during import unless a date is provided.",
      autoFixable: true, fixType: "remove_row",
    };
  }

  if (lower.includes("missing value")) {
    return {
      row, rawMessage,
      friendlyTitle: "Missing metric value",
      friendlyDescription: `Row ${row} has no numeric value.`,
      suggestion: "Rows without values will be excluded from analysis.",
      autoFixable: true, fixType: "remove_row",
    };
  }

  if (lower.includes("non-numeric") || lower.includes("not a number")) {
    const columnMatch = rawMessage.match(/column "([^"]+)"/i);
    return {
      row, rawMessage,
      friendlyTitle: "Non-numeric value detected",
      friendlyDescription: columnMatch
        ? `Row ${row} contains text in metric column "${columnMatch[1]}".`
        : `Row ${row} contains text where a number is expected.`,
      suggestion: "Change text columns such as channel, supplier, product, status, or month to Segment instead of Metric.",
      autoFixable: false,
    };
  }

  if (lower.includes("exceeds limit") || lower.includes("exceeds max")) {
    return {
      row, rawMessage,
      friendlyTitle: "Value out of range",
      friendlyDescription: `Row ${row} has an unusually large value that exceeds safe limits.`,
      suggestion: "Values must be within ±1 trillion. Check for unit mismatches.",
      autoFixable: true, fixType: "trim_value",
    };
  }

  return {
    row, rawMessage,
    friendlyTitle: "Data issue",
    friendlyDescription: rawMessage,
    autoFixable: false,
  };
}

export function validateData(
  rows: string[][],
  headers: string[],
  mapping: ColumnMapping,
  importMode: ImportMode = "single",
): ValidationResult {
  const dateIdx = findMappedIdx(mapping, "date");
  const hasDateColumn = dateIdx >= 0;
  const valueIndices = findAllMappedIdx(mapping, "value");
  const primaryValueIdx = valueIndices[0] ?? -1;

  const errors: HumanizedError[] = [];
  let validRows = 0;
  let validPoints = 0;
  let invalidPoints = 0;
  const dates: string[] = [];
  const values: number[] = [];
  let totalCells = 0;
  let filledCells = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    let rowValid = true;
    let dateValid = true;

    row.forEach((cell) => {
      totalCells += 1;
      if (cell && cell.trim()) filledCells += 1;
    });

    if (hasDateColumn) {
      const normalizedDate = toDateValue(row[dateIdx]);
      if (!normalizedDate) {
        errors.push(humanizeError(i + 2, `Invalid date format: "${row[dateIdx] ?? ""}"`));
        rowValid = false;
        dateValid = false;
      } else {
        dates.push(normalizedDate);
      }
    }

    const checkIndices = importMode === "multi" ? valueIndices : (primaryValueIdx >= 0 ? [primaryValueIdx] : []);
    for (const vIdx of checkIndices) {
      const raw = row[vIdx];
      const num = cleanNumericVal(raw);
      if (!raw || !raw.trim()) {
        if (importMode === "single") {
          errors.push(humanizeError(i + 2, `Missing value in column "${headers[vIdx] ?? vIdx}"`));
          rowValid = false;
        }
        invalidPoints += 1;
      } else if (!Number.isFinite(num)) {
        errors.push(humanizeError(i + 2, `Non-numeric value in column "${headers[vIdx] ?? vIdx}": "${raw}"`));
        rowValid = false;
        invalidPoints += 1;
      } else if (Math.abs(num) > 1e12) {
        errors.push(humanizeError(i + 2, `Value exceeds limit: ${num}`));
        rowValid = false;
        invalidPoints += 1;
      } else {
        if (dateValid) validPoints += 1;
        values.push(num);
      }
    }

    if (rowValid) validRows += 1;
  }

  const totalPoints = importMode === "multi" ? rows.length * Math.max(1, valueIndices.length) : rows.length;
  const completeness = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;
  const errorRate = rows.length > 0 ? (errors.length / rows.length) * 100 : 0;
  const structureBonus = (primaryValueIdx >= 0 ? 10 : 0) + (hasDateColumn ? 10 : 0);
  const qualityScore = Math.max(0, Math.min(100, Math.round(
    completeness * 0.4 + (100 - errorRate) * 0.4 + structureBonus
  )));

  const sortedDates = [...dates].sort();
  return {
    totalRows: rows.length,
    validRows,
    invalidRows: rows.length - validRows,
    validPoints,
    invalidPoints,
    totalPoints,
    errors: errors.slice(0, 50),
    qualityScore,
    completeness,
    dateRange: sortedDates.length > 0 ? { min: sortedDates[0], max: sortedDates[sortedDates.length - 1] } : null,
    valueRange: values.length > 0
      ? { min: Math.min(...values), max: Math.max(...values) }
      : null,
  };
}

export function generateIntelligence(
  headers: string[],
  rows: string[][],
  mapping: ColumnMapping,
  validation: ValidationResult,
  importMode: ImportMode = "single",
): DatasetIntelligence {
  const regionIdx = findMappedIdx(mapping, "region");
  const metricIdx = findMappedIdx(mapping, "metric_type");
  const valueIndices = findAllMappedIdx(mapping, "value");
  const regions = regionIdx >= 0 ? [...new Set(rows.map(r => r[regionIdx]).filter(Boolean))] : [];
  const valueCols = valueIndices.map(i => headers[i] || `col_${i}`);

  let metricTypes: string[];
  if (metricIdx >= 0) metricTypes = [...new Set(rows.map(r => r[metricIdx]).filter(Boolean))];
  else if (importMode === "multi" && valueCols.length > 1) metricTypes = valueCols.map(c => slugifyMetric(c));
  else metricTypes = valueCols.length ? [slugifyMetric(valueCols[0])] : [];

  const signals: { icon: string; title: string; description: string }[] = [];
  if (importMode === "multi" && valueCols.length > 1) {
    signals.push({
      icon: "📊",
      title: `${valueCols.length} metrics detected`,
      description: `Multi-metric dataset: ${valueCols.slice(0, 4).join(", ")}${valueCols.length > 4 ? ` +${valueCols.length - 4} more` : ""}.`,
    });
  }
  if (regions.length > 0) {
    signals.push({ icon: "🌍", title: `${regions.length} regions detected`, description: `Regional analysis enabled across ${regions.slice(0, 5).join(", ")}.` });
  }
  if (validation.qualityScore >= 85) {
    signals.push({ icon: "✅", title: "High-quality dataset", description: "The uploaded data is ready for executive analysis." });
  } else if (validation.qualityScore < 60) {
    signals.push({ icon: "⚠️", title: "Data quality needs review", description: "Some records require mapping or formatting attention before analysis." });
  }

  const dateSpan = validation.dateRange ? `${validation.dateRange.min} → ${validation.dateRange.max}` : null;
  const qualityLabel = validation.qualityScore >= 85 ? "Excellent" : validation.qualityScore >= 70 ? "Good" : validation.qualityScore >= 50 ? "Fair" : "Needs review";

  return {
    recordCount: rows.length,
    validPointCount: validation.validPoints,
    columnCount: headers.length,
    dateSpan,
    regionCount: regions.length,
    regions: regions.slice(0, 50),
    metricTypes,
    signals,
    qualityScore: validation.qualityScore,
    qualityLabel,
  };
}

export function computeDiagnostics(
  rows: string[][],
  headers: string[],
  mapping: ColumnMapping,
): DatasetDiagnostics {
  const dateIdx = findMappedIdx(mapping, "date");
  const valueIndices = findAllMappedIdx(mapping, "value");
  let missing = 0;
  let total = 0;

  rows.forEach(row => {
    row.forEach(cell => {
      total += 1;
      if (!cell || !cell.trim()) missing += 1;
    });
  });

  const seen = new Set<string>();
  let duplicateRows = 0;
  rows.forEach(row => {
    const key = row.join("||");
    if (seen.has(key)) duplicateRows += 1;
    seen.add(key);
  });

  const nums = valueIndices.flatMap(idx => rows.map(r => cleanNumericVal(r[idx])).filter(Number.isFinite));
  let outlierCount = 0;
  if (nums.length > 5) {
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    const sd = Math.sqrt(nums.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / nums.length);
    outlierCount = sd > 0 ? nums.filter(v => Math.abs(v - mean) > sd * 3).length : 0;
  }

  let dateContinuity: DatasetDiagnostics["dateContinuity"] = "N/A";
  let dateGapCount = 0;
  if (dateIdx >= 0) {
    const uniqueDates = [...new Set(rows.map(r => toDateValue(r[dateIdx])).filter(Boolean) as string[])].sort();
    if (uniqueDates.length > 2) {
      dateContinuity = "OK";
      for (let i = 1; i < uniqueDates.length; i += 1) {
        const prev = new Date(uniqueDates[i - 1]).getTime();
        const curr = new Date(uniqueDates[i]).getTime();
        const days = (curr - prev) / 86400000;
        if (days > 32) dateGapCount += 1;
      }
      if (dateGapCount > 0) dateContinuity = "Gaps detected";
    }
  }

  // PII detection — flag columns that look like personal data.
  const sampleRows = rows.slice(0, Math.min(rows.length, 200));
  const piiColumns: string[] = [];
  headers.forEach((header, idx) => {
    const headerHit = isPotentialPiiHeader(header);
    const samples = sampleRows.map(r => r[idx]).filter(v => v && v.trim());
    if (samples.length === 0 && !headerHit) return;
    const emailRate = samples.filter(isEmailLike).length / Math.max(samples.length, 1);
    const phoneRate = samples.filter(isPhoneLike).length / Math.max(samples.length, 1);
    if (headerHit || emailRate > 0.5 || phoneRate > 0.5) {
      piiColumns.push(header);
    }
  });
  const piiLevel: DatasetDiagnostics["piiRisk"]["level"] =
    piiColumns.length === 0 ? "none" : piiColumns.length >= 2 ? "high" : "low";

  return {
    missingValuesPct: total > 0 ? Math.round((missing / total) * 100) : 0,
    outlierCount,
    duplicateRows,
    dateContinuity,
    dateGapCount,
    piiRisk: { level: piiLevel, columns: piiColumns },
  };
}

export function classifyDataset(headers: string[], mapping: ColumnMapping): DatasetClassification {
  const lowerHeaders = headers.map(h => normalizeHeader(h));
  const joined = lowerHeaders.join(" ");
  const metricCount = Object.values(mapping).filter(v => v === "value").length;

  if (/revenue|mrr|arr|churn|customer|subscription/.test(joined)) {
    return { type: "Revenue & Growth", confidence: 86, subType: "Commercial KPIs", recommendedWorkflows: ["Executive Intelligence", "Forecasting", "Decision Ledger"] };
  }
  if (/inventory|supplier|delivery|defect|units|lead_time|manufacturing|production/.test(joined)) {
    return { type: "Manufacturing Operations", confidence: 90, subType: "Operations KPIs", recommendedWorkflows: ["Operational Risk", "Supplier Analysis", "Executive Intelligence"] };
  }
  if (/cash|payable|receivable|margin|cost|profit/.test(joined)) {
    return { type: "Financial Performance", confidence: 84, subType: "Finance KPIs", recommendedWorkflows: ["CFO Dashboard", "Risk & Compliance", "Forecasting"] };
  }
  return { type: metricCount > 1 ? "Multi-Metric Dataset" : "General Business Dataset", confidence: 65, recommendedWorkflows: ["Data Exploration", "Decision Intelligence"] };
}

export function confidenceColor(confidence: number): string {
  if (confidence >= 85) return "text-success";
  if (confidence >= 65) return "text-warning";
  return "text-muted-foreground";
}

export function qualityColor(score: number): string {
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-primary";
  if (score >= 50) return "text-warning";
  return "text-destructive";
}

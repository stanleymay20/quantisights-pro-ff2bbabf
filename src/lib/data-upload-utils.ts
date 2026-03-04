// ---- Data Upload Utility Functions ----
// Extracted from DataUpload.tsx for maintainability

import Papa from "papaparse";

// --- Country detection for region inference ---
export const COUNTRY_SAMPLES = new Set([
  "united states", "usa", "us", "china", "india", "germany", "france", "japan",
  "united kingdom", "uk", "brazil", "canada", "australia", "italy", "spain",
  "mexico", "south korea", "russia", "indonesia", "turkey", "saudi arabia",
  "netherlands", "switzerland", "sweden", "norway", "denmark", "finland",
  "egypt", "nigeria", "south africa", "argentina", "colombia", "chile",
  "uae", "qatar", "kuwait", "bahrain", "oman", "iraq", "iran", "israel",
  "thailand", "vietnam", "malaysia", "singapore", "philippines", "pakistan",
  "bangladesh", "poland", "portugal", "greece", "czech republic", "austria",
  "belgium", "ireland", "new zealand", "peru", "venezuela",
]);

export interface DetectedSchema {
  column: string;
  colIdx: number;
  inferredType: "date" | "value" | "region" | "region_code" | "segment" | "metric_type" | "skip";
  confidence: number;
  reason: string;
  sampleValues: string[];
  rulesApplied: string[];
  autoFix?: "year_to_date";
}

/** Mapping is keyed by colIdx (column position), not header name */
export type ColumnMapping = Record<number, string>;

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
}

export interface DatasetClassification {
  type: string;
  confidence: number;
  subType?: string;
  recommendedWorkflows: string[];
}

export type ImportMode = "single" | "multi";

// ---- NOT-date header patterns ----
const NOT_DATE_PATTERNS = [
  /_years$/i, /^life_expectancy/i, /^tenure/i, /^age$/i, /^duration/i,
  /_duration$/i, /_age$/i, /^experience/i, /^months$/i, /^days$/i,
  /_months$/i, /_days$/i, /_count$/i, /^headcount$/i,
];

function isNotDateHeader(header: string): boolean {
  return NOT_DATE_PATTERNS.some(p => p.test(header.trim()));
}

// ---- Robust CSV Parser (PapaParse) ----
export function parseCSVText(text: string): { headers: string[]; rows: string[][] } {
  const result = Papa.parse(text.trim(), {
    header: false,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
    transform: (val: string) => val.trim(),
  });
  const data = result.data as string[][];
  if (data.length < 2) return { headers: [], rows: [] };
  const headers = data[0].map(h => h.replace(/^"|"$/g, "").trim());
  const rows = data.slice(1);
  return { headers, rows };
}

// ---- Slugify metric name ----
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

/** Deduplicate metric slugs by appending _2, _3 etc */
export function deduplicateMetricSlugs(slugs: string[]): string[] {
  const counts = new Map<string, number>();
  return slugs.map(s => {
    const count = (counts.get(s) ?? 0) + 1;
    counts.set(s, count);
    return count > 1 ? `${s}_${count}` : s;
  });
}

// ---- Helper: get colIdx from mapping by target type ----
function findMappedIdx(mapping: ColumnMapping, target: string): number {
  const entry = Object.entries(mapping).find(([, v]) => v === target);
  return entry ? Number(entry[0]) : -1;
}

function findAllMappedIdx(mapping: ColumnMapping, target: string): number[] {
  return Object.entries(mapping)
    .filter(([, v]) => v === target)
    .map(([k]) => Number(k));
}

// ---- Schema Autodetection Engine ----
export function inferSchema(headers: string[], rows: string[][]): DetectedSchema[] {
  const sampleSize = Math.min(rows.length, 50);
  const sampleRows = rows.slice(0, sampleSize);

  // First pass: detect all types
  const detections: DetectedSchema[] = headers.map((header, colIdx) => {
    const samples = sampleRows.map(r => r[colIdx]).filter(Boolean);
    const lower = header.toLowerCase().trim();
    const uniqueValues = new Set(samples.map(s => s.toLowerCase().trim()));
    const numericRate = samples.filter(s => !isNaN(parseFloat(s)) && isFinite(parseFloat(s))).length / Math.max(samples.length, 1);

    // 0. Explicit NOT-date check
    if (isNotDateHeader(header)) {
      if (numericRate > 0.7) {
        return {
          column: header, colIdx, inferredType: "value" as const, confidence: 88,
          reason: "Numeric duration/measurement column (not a date)",
          sampleValues: samples.slice(0, 3),
          rulesApplied: ["NOT_DATE_PATTERNS", `numericRate=${(numericRate * 100).toFixed(0)}%`],
        };
      }
    }

    // 1. Date detection
    const isDateHeader = lower === "year" || lower === "date" || lower === "period" || lower === "time"
      || lower === "month" || lower === "quarter" || lower.endsWith("_date") || lower.startsWith("date_");
    if (isDateHeader) {
      const allYears = samples.every(s => /^\d{4}$/.test(s.trim()) && parseInt(s) >= 1900 && parseInt(s) <= 2100);
      const allDates = samples.every(s => !isNaN(Date.parse(s)));
      if (allYears) {
        return {
          column: header, colIdx, inferredType: "date" as const, confidence: 92,
          reason: "Year values detected (1900–2100 range)",
          sampleValues: samples.slice(0, 3), autoFix: "year_to_date" as const,
          rulesApplied: ["header_match:date_keyword", "allYears=true", "range:1900-2100"],
        };
      }
      if (allDates) {
        return {
          column: header, colIdx, inferredType: "date" as const, confidence: 95,
          reason: "Standard date format detected",
          sampleValues: samples.slice(0, 3),
          rulesApplied: ["header_match:date_keyword", "Date.parse:all_valid"],
        };
      }
      return {
        column: header, colIdx, inferredType: "date" as const, confidence: 70,
        reason: "Column name suggests date field",
        sampleValues: samples.slice(0, 3),
        rulesApplied: ["header_match:date_keyword", "values_inconclusive"],
      };
    }

    // 1b. Year-like values with "year" in header
    if (!isNotDateHeader(header)) {
      const allYears = samples.length > 0 && samples.every(s => /^\d{4}$/.test(s.trim()) && parseInt(s) >= 1900 && parseInt(s) <= 2100);
      if (allYears && (lower === "year" || lower.includes("year"))) {
        return {
          column: header, colIdx, inferredType: "date" as const, confidence: 88,
          reason: "Year values detected in header containing 'year'",
          sampleValues: samples.slice(0, 3), autoFix: "year_to_date" as const,
          rulesApplied: ["header_contains:year", "allYears=true"],
        };
      }
    }

    // 2a. Region code detection
    if (lower.includes("code") || lower.includes("iso") || lower.includes("site_id") || lower.includes("dept_id") || lower.includes("territory_code")) {
      const codeRate = samples.filter(s => /^[A-Z0-9]{2,5}$/i.test(s.trim())).length / Math.max(samples.length, 1);
      if (codeRate > 0.7) {
        return {
          column: header, colIdx, inferredType: "region_code" as const, confidence: 85,
          reason: "Short codes detected (ISO/site/dept)",
          sampleValues: samples.slice(0, 3),
          rulesApplied: ["header_match:code_keyword", `codeRate=${(codeRate * 100).toFixed(0)}%`],
        };
      }
    }

    // 2b. Region detection
    if (lower.includes("region") || lower.includes("country") || lower.includes("nation") || lower.includes("state") || lower.includes("territory") || lower === "country_code") {
      return {
        column: header, colIdx, inferredType: "region" as const, confidence: 90,
        reason: "Geographic identifiers detected",
        sampleValues: samples.slice(0, 3),
        rulesApplied: ["header_match:geo_keyword"],
      };
    }
    const countryMatchRate = samples.filter(s => COUNTRY_SAMPLES.has(s.toLowerCase().trim())).length / Math.max(samples.length, 1);
    if (countryMatchRate > 0.5) {
      return {
        column: header, colIdx, inferredType: "region" as const, confidence: 85,
        reason: `${Math.round(countryMatchRate * 100)}% of values match known countries`,
        sampleValues: samples.slice(0, 3),
        rulesApplied: ["COUNTRY_SAMPLES", `matchRate=${(countryMatchRate * 100).toFixed(0)}%`],
      };
    }

    // 3. Value detection: header hint
    if (lower.includes("value") || lower.includes("amount") || lower.includes("revenue") ||
        lower.includes("gdp") || lower.includes("price") || lower.includes("cost") ||
        lower.includes("total") || lower.includes("sales") || lower.includes("income") ||
        lower.includes("profit") || lower.includes("spend") || lower.includes("rate") ||
        lower.includes("inflation") || lower.includes("unemployment") || lower.includes("expectancy") ||
        lower.includes("growth") || lower.includes("index") || lower.includes("score") ||
        lower.includes("throughput") || lower.includes("utilization") || lower.includes("headcount") ||
        lower.includes("attrition") || lower.includes("nps") || lower.includes("satisfaction") ||
        lower.includes("conversion") || lower.includes("churn") || lower.includes("retention")) {
      const matchedKeyword = ["value","amount","revenue","gdp","price","cost","total","sales","income","profit","spend","rate","inflation","unemployment","expectancy","growth","index","score","throughput","utilization","headcount","attrition","nps","satisfaction","conversion","churn","retention"]
        .find(k => lower.includes(k)) || "keyword";
      return {
        column: header, colIdx, inferredType: "value" as const, confidence: 90,
        reason: "Numeric metric column detected",
        sampleValues: samples.slice(0, 3),
        rulesApplied: [`header_match:${matchedKeyword}`, `numericRate=${(numericRate * 100).toFixed(0)}%`],
      };
    }
    // Value by statistics
    const avgMagnitude = samples.reduce((sum, s) => sum + Math.abs(parseFloat(s) || 0), 0) / Math.max(samples.length, 1);
    if (numericRate > 0.9 && avgMagnitude > 1) {
      const allLookLikeYears = samples.every(s => {
        const n = parseFloat(s);
        return n >= 1900 && n <= 2100 && Number.isInteger(n);
      });
      if (allLookLikeYears && !lower.includes("value") && !lower.includes("amount")) {
        return {
          column: header, colIdx, inferredType: "skip" as const, confidence: 50,
          reason: "Ambiguous: looks like year values but header is unclear",
          sampleValues: samples.slice(0, 3),
          rulesApplied: ["numericRate>90%", "allLookLikeYears=true", "no_value_keyword"],
        };
      }
      return {
        column: header, colIdx, inferredType: "value" as const, confidence: 80,
        reason: `Numeric values (avg: ${avgMagnitude.toLocaleString(undefined, { maximumFractionDigits: 1 })})`,
        sampleValues: samples.slice(0, 3),
        rulesApplied: [`numericRate=${(numericRate * 100).toFixed(0)}%`, `avgMagnitude=${avgMagnitude.toFixed(1)}`],
      };
    }

    // 4. Segment detection
    if (lower.includes("segment") || lower.includes("category") || lower.includes("sector") || lower.includes("industry") || lower.includes("group") || lower.includes("department") || lower.includes("team")) {
      return {
        column: header, colIdx, inferredType: "segment" as const, confidence: 85,
        reason: "Categorical grouping detected",
        sampleValues: samples.slice(0, 3),
        rulesApplied: ["header_match:segment_keyword"],
      };
    }

    // 5. Metric type detection
    if (lower.includes("metric") || lower.includes("type") || lower.includes("indicator") || lower.includes("measure")) {
      return {
        column: header, colIdx, inferredType: "metric_type" as const, confidence: 80,
        reason: "Metric type identifiers detected",
        sampleValues: samples.slice(0, 3),
        rulesApplied: ["header_match:metric_keyword"],
      };
    }

    // 6. Low-cardinality text → segment guess
    if (uniqueValues.size > 1 && uniqueValues.size <= 20 && numericRate < 0.3) {
      return {
        column: header, colIdx, inferredType: "segment" as const, confidence: 60,
        reason: `Low-cardinality text (${uniqueValues.size} unique values)`,
        sampleValues: samples.slice(0, 3),
        rulesApplied: [`uniqueValues=${uniqueValues.size}`, `numericRate=${(numericRate * 100).toFixed(0)}%`],
      };
    }

    return {
      column: header, colIdx, inferredType: "skip" as const, confidence: 40,
      reason: "No clear pattern detected",
      sampleValues: samples.slice(0, 3),
      rulesApplied: ["no_rule_matched"],
    };
  });

  // Second pass: enforce single date column - pick highest confidence
  const dateDetections = detections.filter(d => d.inferredType === "date");
  if (dateDetections.length > 1) {
    const bestDate = dateDetections.reduce((best, d) => d.confidence > best.confidence ? d : best);
    detections.forEach((d) => {
      if (d.inferredType === "date" && d.colIdx !== bestDate.colIdx) {
        const colSamples = sampleRows.map(r => r[d.colIdx]).filter(Boolean);
        const numRate = colSamples.filter(s => !isNaN(parseFloat(s)) && isFinite(parseFloat(s))).length / Math.max(colSamples.length, 1);
        if (numRate > 0.8) {
          (d as any).inferredType = "value";
          d.reason = "Reclassified as value (another column chosen as date)";
          d.confidence = 65;
          d.rulesApplied = [...d.rulesApplied, "single_date_rule:demoted_to_value"];
        } else {
          (d as any).inferredType = "skip";
          d.reason = "Multiple date columns detected — demoted";
          d.confidence = 40;
          d.rulesApplied = [...d.rulesApplied, "single_date_rule:demoted_to_skip"];
        }
      }
    });
  }

  return detections;
}

// ---- Humanized Error Translation ----
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
      suggestion: "Expected format: YYYY-MM-DD (e.g., 2024-01-15)",
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
    return {
      row, rawMessage,
      friendlyTitle: "Non-numeric value detected",
      friendlyDescription: `Row ${row} contains text where a number is expected.`,
      suggestion: "Check for currency symbols, commas, or text in your value column.",
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

// ---- Validation (supports multi-metric mode, counts validPoints) ----
export function validateData(
  rows: string[][],
  headers: string[],
  mapping: ColumnMapping,
  importMode: ImportMode = "single",
): ValidationResult {
  const dateIdx = findMappedIdx(mapping, "date");
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

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let rowValid = true;

    row.forEach((cell) => {
      totalCells++;
      if (cell && cell.trim()) filledCells++;
    });

    // Date validation
    let dateValid = true;
    if (dateIdx >= 0) {
      let d = row[dateIdx]?.trim();
      if (d && /^\d{4}$/.test(d)) {
        d = `${d}-01-01`;
      }
      if (!d) {
        errors.push(humanizeError(i + 2, "Missing date value"));
        rowValid = false;
        dateValid = false;
      } else if (isNaN(Date.parse(d))) {
        errors.push(humanizeError(i + 2, `Invalid date format: "${d}"`));
        rowValid = false;
        dateValid = false;
      } else {
        dates.push(d);
      }
    }

    // Validate values — count per metric-point pair
    const checkIndices = importMode === "multi" ? valueIndices : (primaryValueIdx >= 0 ? [primaryValueIdx] : []);
    for (const vIdx of checkIndices) {
      const v = row[vIdx];
      const num = parseFloat(v);
      if (!v || !v.trim()) {
        if (importMode === "single") {
          errors.push(humanizeError(i + 2, "Missing value"));
          rowValid = false;
        }
        invalidPoints++;
      } else if (isNaN(num) || !isFinite(num)) {
        errors.push(humanizeError(i + 2, `Non-numeric value: "${v}"`));
        rowValid = false;
        invalidPoints++;
      } else if (Math.abs(num) > 1e12) {
        errors.push(humanizeError(i + 2, `Value exceeds limit: ${num}`));
        rowValid = false;
        invalidPoints++;
      } else {
        if (dateValid) validPoints++;
        values.push(num);
      }
    }

    if (rowValid) validRows++;
  }

  const totalPoints = importMode === "multi" ? rows.length * valueIndices.length : rows.length;
  const completeness = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;
  const errorRate = rows.length > 0 ? (errors.length / rows.length) * 100 : 0;
  const qualityScore = Math.max(0, Math.min(100, Math.round(
    completeness * 0.4 + (100 - errorRate) * 0.4 + (dateIdx >= 0 && primaryValueIdx >= 0 ? 20 : 0)
  )));

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
    dateRange: dates.length > 0
      ? { min: dates.sort()[0], max: dates.sort()[dates.length - 1] }
      : null,
    valueRange: values.length > 0
      ? { min: Math.min(...values), max: Math.max(...values) }
      : null,
  };
}

// ---- Dataset Intelligence Engine ----
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
  const dateIdx = findMappedIdx(mapping, "date");

  const regions = regionIdx >= 0
    ? [...new Set(rows.map(r => r[regionIdx]).filter(Boolean))]
    : [];

  const valueCols = valueIndices.map(i => headers[i] || `col_${i}`);

  let metricTypes: string[];
  if (metricIdx >= 0) {
    metricTypes = [...new Set(rows.map(r => r[metricIdx]).filter(Boolean))];
  } else if (importMode === "multi" && valueCols.length > 1) {
    metricTypes = valueCols.map(c => slugifyMetric(c));
  } else {
    metricTypes = [];
  }

  const signals: { icon: string; title: string; description: string }[] = [];

  if (importMode === "multi" && valueCols.length > 1) {
    signals.push({
      icon: "📊", title: `${valueCols.length} metrics detected`,
      description: `Multi-metric dataset: ${valueCols.slice(0, 4).join(", ")}${valueCols.length > 4 ? ` +${valueCols.length - 4} more` : ""}. Cross-metric correlation analysis enabled.`,
    });
  }

  // Volatility detection
  const primaryValueIdx = valueIndices[0] ?? -1;
  if (primaryValueIdx >= 0 && rows.length > 10) {
    const values = rows.map(r => parseFloat(r[primaryValueIdx])).filter(v => !isNaN(v));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
    const cv = (stdDev / Math.abs(mean)) * 100;
    if (cv > 50) {
      signals.push({
        icon: "📊", title: "High value volatility detected",
        description: `Coefficient of variation: ${cv.toFixed(0)}% — significant fluctuations across the dataset.`,
      });
    }
  }

  // Trend detection
  if (primaryValueIdx >= 0 && dateIdx >= 0 && rows.length > 20) {
    const sorted = [...rows].sort((a, b) => {
      const da = Date.parse(a[dateIdx]) || 0;
      const db = Date.parse(b[dateIdx]) || 0;
      return da - db;
    });
    const third = Math.floor(sorted.length / 3);
    const earlyAvg = sorted.slice(0, third).reduce((s, r) => s + (parseFloat(r[primaryValueIdx]) || 0), 0) / third;
    const lateAvg = sorted.slice(-third).reduce((s, r) => s + (parseFloat(r[primaryValueIdx]) || 0), 0) / third;
    const changePct = ((lateAvg - earlyAvg) / Math.abs(earlyAvg || 1)) * 100;
    if (Math.abs(changePct) > 15) {
      signals.push({
        icon: changePct > 0 ? "📈" : "📉",
        title: `${changePct > 0 ? "Growth" : "Decline"} trend detected`,
        description: `${Math.abs(changePct).toFixed(0)}% ${changePct > 0 ? "increase" : "decrease"} between early and late periods.`,
      });
    }
  }

  // Multi-region diversity
  if (regions.length > 3) {
    signals.push({
      icon: "🌍", title: "Multi-region dataset",
      description: `${regions.length} distinct regions detected — cross-regional comparison available.`,
    });
  }

  // Date span
  let dateSpan: string | null = null;
  if (validation.dateRange) {
    const minYear = new Date(validation.dateRange.min).getFullYear();
    const maxYear = new Date(validation.dateRange.max).getFullYear();
    dateSpan = `${minYear}–${maxYear}`;
    const span = maxYear - minYear;
    if (span > 10) {
      signals.push({
        icon: "📅", title: "Long-term historical data",
        description: `${span}-year span enables trend analysis and cycle detection.`,
      });
    }
  }

  // Quality signal
  if (validation.qualityScore >= 90) {
    signals.push({
      icon: "✅", title: "Excellent data quality",
      description: `Quality score: ${validation.qualityScore}/100 — ready for high-confidence analysis.`,
    });
  } else if (validation.qualityScore < 60) {
    signals.push({
      icon: "⚠️", title: "Data quality concerns",
      description: `Quality score: ${validation.qualityScore}/100 — insights will have reduced confidence.`,
    });
  }

  const qScore = validation.qualityScore;
  return {
    recordCount: validation.validPoints > 0 ? validation.validPoints : validation.validRows,
    validPointCount: validation.validPoints,
    columnCount: headers.length,
    dateSpan,
    regionCount: regions.length,
    regions: regions.slice(0, 8),
    metricTypes: metricTypes.slice(0, 8),
    signals,
    qualityScore: qScore,
    qualityLabel: qScore >= 80 ? "Excellent" : qScore >= 50 ? "Fair" : "Poor",
  };
}

// ---- Dataset Diagnostics ----
export function computeDiagnostics(
  rows: string[][],
  headers: string[],
  mapping: ColumnMapping,
): DatasetDiagnostics {
  const dateIdx = findMappedIdx(mapping, "date");
  const valueIndices = findAllMappedIdx(mapping, "value");

  let totalCells = 0;
  let emptyCells = 0;
  rows.forEach(row => {
    headers.forEach((_, j) => {
      totalCells++;
      if (!row[j] || !row[j].trim()) emptyCells++;
    });
  });
  const missingValuesPct = totalCells > 0 ? parseFloat(((emptyCells / totalCells) * 100).toFixed(1)) : 0;

  let outlierCount = 0;
  for (const vIdx of valueIndices) {
    const values = rows.map(r => parseFloat(r[vIdx])).filter(v => !isNaN(v));
    if (values.length < 10) continue;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
    if (stdDev > 0) {
      outlierCount += values.filter(v => Math.abs(v - mean) > 3 * stdDev).length;
    }
  }

  const rowStrings = new Set<string>();
  let duplicateRows = 0;
  rows.forEach(row => {
    const key = row.join("|");
    if (rowStrings.has(key)) duplicateRows++;
    else rowStrings.add(key);
  });

  let dateContinuity: "OK" | "Gaps detected" | "N/A" = "N/A";
  let dateGapCount = 0;
  if (dateIdx >= 0) {
    const dates = rows
      .map(r => {
        let d = r[dateIdx]?.trim();
        if (d && /^\d{4}$/.test(d)) d = `${d}-01-01`;
        return Date.parse(d);
      })
      .filter(d => !isNaN(d))
      .sort((a, b) => a - b);

    if (dates.length > 2) {
      const years = [...new Set(dates.map(d => new Date(d).getFullYear()))].sort((a, b) => a - b);
      for (let i = 1; i < years.length; i++) {
        if (years[i] - years[i - 1] > 1) dateGapCount++;
      }
      dateContinuity = dateGapCount === 0 ? "OK" : "Gaps detected";
    }
  }

  return { missingValuesPct, outlierCount, duplicateRows, dateContinuity, dateGapCount };
}

// ---- Dataset Classification ----
const DATASET_PATTERNS: { type: string; keywords: string[]; workflows: string[]; subTypes?: { type: string; keywords: string[] }[] }[] = [
  {
    type: "Macroeconomic Indicators",
    keywords: ["gdp", "inflation", "unemployment", "interest_rate", "cpi", "ppi", "trade_balance", "fiscal", "monetary", "economic"],
    workflows: ["Forecasting", "Scenario Modeling", "Anomaly Detection", "Cross-metric Correlation"],
    subTypes: [
      { type: "National Accounts", keywords: ["gdp", "gnp", "consumption", "investment"] },
      { type: "Labor Market", keywords: ["unemployment", "employment", "labor", "workforce", "jobs"] },
      { type: "Price Indices", keywords: ["inflation", "cpi", "ppi", "price_index", "deflator"] },
    ],
  },
  {
    type: "Sales Performance",
    keywords: ["revenue", "sales", "orders", "conversion", "deal", "pipeline", "booking", "arr", "mrr"],
    workflows: ["Forecasting", "KPI Monitoring", "Decision Ledger", "Scenario Planning"],
  },
  {
    type: "Marketing Analytics",
    keywords: ["marketing", "campaign", "leads", "cac", "cpl", "impressions", "clicks", "ctr", "roas", "funnel"],
    workflows: ["Funnel Analysis", "Attribution Modeling", "Anomaly Detection", "Forecasting"],
  },
  {
    type: "Operational Metrics",
    keywords: ["operations", "throughput", "cycle_time", "utilization", "capacity", "sla", "uptime", "incidents"],
    workflows: ["KPI Monitoring", "Anomaly Detection", "Scenario Planning", "Decision Ledger"],
  },
  {
    type: "Financial Statements",
    keywords: ["revenue", "expense", "profit", "ebitda", "margin", "balance", "assets", "liabilities", "equity", "cashflow"],
    workflows: ["Forecasting", "Scenario Modeling", "Benchmarking", "Decision Ledger"],
  },
  {
    type: "Customer Analytics",
    keywords: ["customer", "churn", "retention", "nps", "satisfaction", "ltv", "arpu", "cohort", "engagement"],
    workflows: ["Cohort Analysis", "Churn Prediction", "KPI Monitoring", "Scenario Planning"],
  },
  {
    type: "People Analytics",
    keywords: ["headcount", "attrition", "hiring", "compensation", "salary", "employee", "turnover", "tenure", "diversity"],
    workflows: ["Workforce Planning", "Attrition Forecasting", "KPI Monitoring", "Benchmarking"],
  },
  {
    type: "Energy & Commodities",
    keywords: ["oil", "gas", "energy", "commodity", "crude", "barrel", "electricity", "mining", "production"],
    workflows: ["Price Forecasting", "Scenario Modeling", "Anomaly Detection", "Cross-metric Correlation"],
  },
  {
    type: "Product Analytics",
    keywords: ["feature", "adoption", "dau", "mau", "session", "activation", "onboarding", "usage", "engagement"],
    workflows: ["Engagement Analysis", "Funnel Optimization", "Anomaly Detection", "KPI Monitoring"],
  },
  {
    type: "Risk & Compliance",
    keywords: ["risk", "compliance", "incident", "audit", "violation", "exposure", "probability", "severity"],
    workflows: ["Risk Monitoring", "Anomaly Detection", "Decision Ledger", "Scenario Planning"],
  },
];

export function classifyDataset(headers: string[], mapping: ColumnMapping): DatasetClassification {
  const allText = headers.map(h => h.toLowerCase().replace(/[_\-]/g, " ")).join(" ");
  const valueIndices = findAllMappedIdx(mapping, "value");
  const valueCols = valueIndices.map(i => (headers[i] || "").toLowerCase().replace(/[_\-]/g, " "));
  const searchText = allText + " " + valueCols.join(" ");

  let bestMatch: DatasetClassification = { type: "General Dataset", confidence: 30, recommendedWorkflows: ["KPI Monitoring", "Forecasting", "Anomaly Detection"] };

  for (const pattern of DATASET_PATTERNS) {
    const matchCount = pattern.keywords.filter(k => searchText.includes(k)).length;
    const score = Math.min(95, Math.round((matchCount / pattern.keywords.length) * 100) + 20);
    if (matchCount > 0 && score > bestMatch.confidence) {
      bestMatch = { type: pattern.type, confidence: score, recommendedWorkflows: pattern.workflows };

      if (pattern.subTypes) {
        for (const sub of pattern.subTypes) {
          const subMatchCount = sub.keywords.filter(k => searchText.includes(k)).length;
          if (subMatchCount > 0) {
            bestMatch.subType = sub.type;
            break;
          }
        }
      }
    }
  }

  return bestMatch;
}

// ---- Confidence badge color ----
export const confidenceColor = (c: number) =>
  c >= 80 ? "bg-green-500/10 text-green-600 border-green-500/20" :
  c >= 60 ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" :
  "bg-muted text-muted-foreground border-border";

export const qualityColor = (score: number) =>
  score >= 80 ? "text-green-500" : score >= 50 ? "text-yellow-500" : "text-red-500";

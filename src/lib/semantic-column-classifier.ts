import { isBooleanLike, isIdentifierHeader, isIdentifierLike, normalizeCell, parseMessyDate, parseMessyNumber } from "./messy-data-guards";
import type { ColumnTarget } from "./data-upload-utils";

export type SemanticColumnType =
  | "date"
  | "metric"
  | "currency"
  | "percentage"
  | "ratio"
  | "identifier"
  | "boolean"
  | "location"
  | "pii"
  | "categorical"
  | "text"
  | "unknown";

export type BusinessRole =
  | "financial_kpi"
  | "operational_kpi"
  | "customer_kpi"
  | "workforce_kpi"
  | "risk_kpi"
  | "entity_key"
  | "time_dimension"
  | "geo_dimension"
  | "business_segment"
  | "status_flag"
  | "sensitive_attribute"
  | "descriptive_text"
  | "unknown";

export interface SemanticColumnProfile {
  column: string;
  colIdx: number;
  baseType: ColumnTarget;
  semanticType: SemanticColumnType;
  businessRole: BusinessRole;
  confidence: number;
  reason: string;
  reviewRequired: boolean;
  rulesApplied: string[];
}

const LOCATION_HEADER = /(^|_)(country|region|state|city|territory|postcode|postal_code|zip|zip_code|location)($|_)/i;
const PII_HEADER = /(^|_)(email|phone|mobile|contact|address|name)($|_)/i;
const BOOLEAN_HEADER = /(^|_)(is_|has_|flag|active|approved|completed|enabled|status)($|_)/i;
const PERCENT_HEADER = /(^|_)(pct|percent|percentage|rate|margin|ratio)($|_)/i;
const CURRENCY_HEADER = /(^|_)(revenue|cost|price|amount|profit|cash|salary|spend|balance|payable|receivable|budget|expense|income)($|_)/i;
const IDENTIFIER_HEADER = /(^|_)(id|uuid|guid|sku|code|number|no|reference|ref|invoice|order|customer|employee|transaction|account)($|_)/i;
const FINANCIAL_KPI = /(revenue|cost|profit|margin|cash|payable|receivable|budget|expense|income|ebitda|mrr|arr)/i;
const OPERATIONAL_KPI = /(inventory|turnover|delivery|defect|lead_time|cycle_time|downtime|throughput|units|yield|oee)/i;
const CUSTOMER_KPI = /(customer|orders|satisfaction|nps|churn|retention|conversion|new_customers)/i;
const WORKFORCE_KPI = /(employee|headcount|attrition|salary|tenure|performance|engagement)/i;
const RISK_KPI = /(risk|score|exposure|incident|compliance|breach)/i;

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function sampleStats(samples: string[]) {
  const clean = samples.map(normalizeCell).filter(Boolean);
  const numericRate = clean.filter(v => Number.isFinite(parseMessyNumber(v))).length / Math.max(clean.length, 1);
  const dateRate = clean.filter(v => parseMessyDate(v) !== null).length / Math.max(clean.length, 1);
  const booleanRate = clean.filter(isBooleanLike).length / Math.max(clean.length, 1);
  const identifierRate = clean.filter(isIdentifierLike).length / Math.max(clean.length, 1);
  const unique = new Set(clean.map(v => v.toLowerCase())).size;
  return { clean, numericRate, dateRate, booleanRate, identifierRate, unique };
}

export function classifySemanticColumn(args: {
  column: string;
  colIdx: number;
  baseType: ColumnTarget;
  samples: string[];
  baseConfidence?: number;
}): SemanticColumnProfile {
  const { column, colIdx, baseType, samples, baseConfidence = 50 } = args;
  const h = normalizeHeader(column);
  const stats = sampleStats(samples);
  const rules: string[] = [];

  if (isIdentifierHeader(column) || IDENTIFIER_HEADER.test(h) || stats.identifierRate >= 0.7) {
    rules.push("semantic:identifier_guard");
    return {
      column,
      colIdx,
      baseType,
      semanticType: LOCATION_HEADER.test(h) ? "location" : "identifier",
      businessRole: LOCATION_HEADER.test(h) ? "geo_dimension" : "entity_key",
      confidence: Math.max(92, baseConfidence),
      reason: LOCATION_HEADER.test(h)
        ? "Location or postal identifier detected; protected from metric analysis."
        : "Business/entity identifier detected; protected from metric analysis.",
      reviewRequired: false,
      rulesApplied: rules,
    };
  }

  if (PII_HEADER.test(h)) {
    rules.push("semantic:sensitive_header");
    return {
      column,
      colIdx,
      baseType,
      semanticType: "pii",
      businessRole: "sensitive_attribute",
      confidence: 90,
      reason: "Potential sensitive attribute detected from the column name.",
      reviewRequired: true,
      rulesApplied: rules,
    };
  }

  if (BOOLEAN_HEADER.test(h) || (stats.booleanRate >= 0.9 && stats.unique <= 3)) {
    rules.push("semantic:boolean_guard");
    return {
      column,
      colIdx,
      baseType,
      semanticType: "boolean",
      businessRole: "status_flag",
      confidence: 90,
      reason: "Boolean/status flag detected; kept as a segment, not a numeric KPI.",
      reviewRequired: false,
      rulesApplied: rules,
    };
  }

  if (baseType === "date" || stats.dateRate >= 0.85) {
    rules.push("semantic:date");
    return {
      column,
      colIdx,
      baseType,
      semanticType: "date",
      businessRole: "time_dimension",
      confidence: Math.max(88, baseConfidence),
      reason: "Date or reporting period detected.",
      reviewRequired: baseConfidence < 85,
      rulesApplied: rules,
    };
  }

  if (LOCATION_HEADER.test(h) || baseType === "region" || baseType === "region_code") {
    rules.push("semantic:location");
    return {
      column,
      colIdx,
      baseType,
      semanticType: "location",
      businessRole: "geo_dimension",
      confidence: Math.max(88, baseConfidence),
      reason: "Geographic dimension detected.",
      reviewRequired: false,
      rulesApplied: rules,
    };
  }

  if (baseType === "value" && stats.numericRate >= 0.85) {
    const semanticType: SemanticColumnType = PERCENT_HEADER.test(h) ? (h.includes("ratio") ? "ratio" : "percentage") : CURRENCY_HEADER.test(h) ? "currency" : "metric";
    const businessRole: BusinessRole = FINANCIAL_KPI.test(h)
      ? "financial_kpi"
      : OPERATIONAL_KPI.test(h)
        ? "operational_kpi"
        : CUSTOMER_KPI.test(h)
          ? "customer_kpi"
          : WORKFORCE_KPI.test(h)
            ? "workforce_kpi"
            : RISK_KPI.test(h)
              ? "risk_kpi"
              : "unknown";
    rules.push(`semantic:${semanticType}`);
    return {
      column,
      colIdx,
      baseType,
      semanticType,
      businessRole,
      confidence: Math.max(86, baseConfidence),
      reason: `${semanticType} column detected from numeric samples and business header semantics.`,
      reviewRequired: businessRole === "unknown" || baseConfidence < 85,
      rulesApplied: rules,
    };
  }

  if (baseType === "segment" || baseType === "metric_type") {
    rules.push("semantic:categorical");
    return {
      column,
      colIdx,
      baseType,
      semanticType: "categorical",
      businessRole: "business_segment",
      confidence: Math.max(75, baseConfidence),
      reason: "Categorical business grouping detected.",
      reviewRequired: baseConfidence < 75,
      rulesApplied: rules,
    };
  }

  return {
    column,
    colIdx,
    baseType,
    semanticType: stats.clean.length ? "text" : "unknown",
    businessRole: stats.clean.length ? "descriptive_text" : "unknown",
    confidence: Math.min(baseConfidence, 70),
    reason: "No strong business semantic pattern detected.",
    reviewRequired: true,
    rulesApplied: ["semantic:low_confidence"],
  };
}

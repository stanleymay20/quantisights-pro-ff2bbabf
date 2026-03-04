import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardSidebar, { SidebarMobileToggle } from "@/components/dashboard/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Upload, FileSpreadsheet, ArrowRight, Check, X,
  AlertTriangle, ShieldCheck, BarChart3, Info,
  Sparkles, Wand2, Globe, Calendar, Hash, TrendingUp,
  Zap, Eye, ChevronRight,
} from "lucide-react";
import UploadTrustBadges from "@/components/security/UploadTrustBadges";
import { motion, AnimatePresence } from "framer-motion";

type Step = "upload" | "autodetect" | "mapping" | "validation" | "intelligence" | "importing" | "done";

const METRIC_TYPES = ["revenue", "cost", "customers", "churn", "headcount", "marketing_spend"] as const;
const COLUMN_TARGETS = ["date", "value", "region", "segment", "metric_type", "skip"] as const;

// --- Country detection for region inference ---
const COUNTRY_SAMPLES = new Set([
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

interface DetectedSchema {
  column: string;
  inferredType: "date" | "value" | "region" | "segment" | "metric_type" | "skip";
  confidence: number;
  reason: string;
  sampleValues: string[];
  autoFix?: "year_to_date";
}

interface ValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: HumanizedError[];
  qualityScore: number;
  completeness: number;
  dateRange: { min: string; max: string } | null;
  valueRange: { min: number; max: number } | null;
}

interface HumanizedError {
  row: number;
  rawMessage: string;
  friendlyTitle: string;
  friendlyDescription: string;
  suggestion?: string;
  autoFixable: boolean;
  fixType?: "year_to_date" | "remove_row" | "trim_value";
}

interface DatasetIntelligence {
  recordCount: number;
  columnCount: number;
  dateSpan: string | null;
  regionCount: number;
  regions: string[];
  metricTypes: string[];
  signals: { icon: string; title: string; description: string }[];
  qualityScore: number;
  qualityLabel: string;
}

// ---- Schema Autodetection Engine ----
function inferSchema(headers: string[], rows: string[][]): DetectedSchema[] {
  const sampleSize = Math.min(rows.length, 50);
  const sampleRows = rows.slice(0, sampleSize);

  return headers.map((header) => {
    const colIdx = headers.indexOf(header);
    const samples = sampleRows.map(r => r[colIdx]).filter(Boolean);
    const lower = header.toLowerCase().trim();
    const uniqueValues = new Set(samples.map(s => s.toLowerCase().trim()));

    // 1. Date detection: header hint OR year-only values (1900–2100)
    if (lower.includes("date") || lower.includes("year") || lower === "period" || lower === "time") {
      const allYears = samples.every(s => /^\d{4}$/.test(s.trim()) && parseInt(s) >= 1900 && parseInt(s) <= 2100);
      const allDates = samples.every(s => !isNaN(Date.parse(s)));
      if (allYears) {
        return {
          column: header, inferredType: "date", confidence: 92,
          reason: "Year values detected (1900–2100 range)",
          sampleValues: samples.slice(0, 3), autoFix: "year_to_date",
        };
      }
      if (allDates) {
        return {
          column: header, inferredType: "date", confidence: 95,
          reason: "Standard date format detected",
          sampleValues: samples.slice(0, 3),
        };
      }
      // Header says date but values aren't parseable — still infer with lower confidence
      return {
        column: header, inferredType: "date", confidence: 70,
        reason: "Column name suggests date field",
        sampleValues: samples.slice(0, 3),
      };
    }

    // 2. Region detection: header hint OR country name matching
    if (lower.includes("region") || lower.includes("country") || lower.includes("nation") || lower.includes("state") || lower.includes("territory")) {
      return {
        column: header, inferredType: "region", confidence: 90,
        reason: "Geographic identifiers detected",
        sampleValues: samples.slice(0, 3),
      };
    }
    // Check if values are country names
    const countryMatchRate = samples.filter(s => COUNTRY_SAMPLES.has(s.toLowerCase().trim())).length / Math.max(samples.length, 1);
    if (countryMatchRate > 0.5) {
      return {
        column: header, inferredType: "region", confidence: 85,
        reason: `${Math.round(countryMatchRate * 100)}% of values match known countries`,
        sampleValues: samples.slice(0, 3),
      };
    }

    // 3. Value detection: header hint OR large numeric values
    if (lower.includes("value") || lower.includes("amount") || lower.includes("revenue") ||
        lower.includes("gdp") || lower.includes("price") || lower.includes("cost") ||
        lower.includes("total") || lower.includes("sales") || lower.includes("income") ||
        lower.includes("profit") || lower.includes("spend")) {
      return {
        column: header, inferredType: "value", confidence: 90,
        reason: "Numeric metric column detected",
        sampleValues: samples.slice(0, 3),
      };
    }
    const numericRate = samples.filter(s => !isNaN(parseFloat(s)) && isFinite(parseFloat(s))).length / Math.max(samples.length, 1);
    const avgMagnitude = samples.reduce((sum, s) => sum + Math.abs(parseFloat(s) || 0), 0) / Math.max(samples.length, 1);
    if (numericRate > 0.9 && avgMagnitude > 100) {
      return {
        column: header, inferredType: "value", confidence: 80,
        reason: `High-magnitude numeric values (avg: ${avgMagnitude.toLocaleString(undefined, { maximumFractionDigits: 0 })})`,
        sampleValues: samples.slice(0, 3),
      };
    }

    // 4. Segment detection
    if (lower.includes("segment") || lower.includes("category") || lower.includes("sector") || lower.includes("industry") || lower.includes("group")) {
      return {
        column: header, inferredType: "segment", confidence: 85,
        reason: "Categorical grouping detected",
        sampleValues: samples.slice(0, 3),
      };
    }

    // 5. Metric type detection
    if (lower.includes("metric") || lower.includes("type") || lower.includes("indicator") || lower.includes("measure")) {
      return {
        column: header, inferredType: "metric_type", confidence: 80,
        reason: "Metric type identifiers detected",
        sampleValues: samples.slice(0, 3),
      };
    }

    // 6. Low-cardinality text → segment guess
    if (uniqueValues.size > 1 && uniqueValues.size <= 20 && numericRate < 0.3) {
      return {
        column: header, inferredType: "segment", confidence: 60,
        reason: `Low-cardinality text (${uniqueValues.size} unique values)`,
        sampleValues: samples.slice(0, 3),
      };
    }

    return {
      column: header, inferredType: "skip", confidence: 40,
      reason: "No clear pattern detected",
      sampleValues: samples.slice(0, 3),
    };
  });
}

// ---- Humanized Error Translation ----
function humanizeError(row: number, rawMessage: string): HumanizedError {
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

// ---- Validation with humanized errors ----
function validateData(
  rows: string[][],
  headers: string[],
  mapping: Record<string, string>,
): ValidationResult {
  const dateCol = Object.entries(mapping).find(([, v]) => v === "date")?.[0];
  const valueCol = Object.entries(mapping).find(([, v]) => v === "value")?.[0];
  const dateIdx = dateCol ? headers.indexOf(dateCol) : -1;
  const valueIdx = valueCol ? headers.indexOf(valueCol) : -1;

  const errors: HumanizedError[] = [];
  let validRows = 0;
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

    if (dateIdx >= 0) {
      let d = row[dateIdx]?.trim();
      // Normalize year-only values during validation too
      if (d && /^\d{4}$/.test(d)) {
        d = `${d}-01-01`;
      }
      if (!d) {
        errors.push(humanizeError(i + 2, "Missing date value"));
        rowValid = false;
      } else if (isNaN(Date.parse(d))) {
        errors.push(humanizeError(i + 2, `Invalid date format: "${d}"`));
        rowValid = false;
      } else {
        dates.push(d);
      }
    }

    if (valueIdx >= 0) {
      const v = row[valueIdx];
      const num = parseFloat(v);
      if (!v || !v.trim()) {
        errors.push(humanizeError(i + 2, "Missing value"));
        rowValid = false;
      } else if (isNaN(num) || !isFinite(num)) {
        errors.push(humanizeError(i + 2, `Non-numeric value: "${v}"`));
        rowValid = false;
      } else if (Math.abs(num) > 1e12) {
        errors.push(humanizeError(i + 2, `Value exceeds limit: ${num}`));
        rowValid = false;
      } else {
        values.push(num);
      }
    }

    if (rowValid) validRows++;
  }

  const completeness = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;
  const errorRate = rows.length > 0 ? (errors.length / rows.length) * 100 : 0;
  const qualityScore = Math.max(0, Math.min(100, Math.round(
    completeness * 0.4 + (100 - errorRate) * 0.4 + (dateIdx >= 0 && valueIdx >= 0 ? 20 : 0)
  )));

  return {
    totalRows: rows.length,
    validRows,
    invalidRows: rows.length - validRows,
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
function generateIntelligence(
  headers: string[],
  rows: string[][],
  mapping: Record<string, string>,
  validation: ValidationResult,
): DatasetIntelligence {
  const regionCol = Object.entries(mapping).find(([, v]) => v === "region")?.[0];
  const metricCol = Object.entries(mapping).find(([, v]) => v === "metric_type")?.[0];
  const valueCol = Object.entries(mapping).find(([, v]) => v === "value")?.[0];
  const dateCol = Object.entries(mapping).find(([, v]) => v === "date")?.[0];

  const regionIdx = regionCol ? headers.indexOf(regionCol) : -1;
  const metricIdx = metricCol ? headers.indexOf(metricCol) : -1;
  const valueIdx = valueCol ? headers.indexOf(valueCol) : -1;
  const dateIdx = dateCol ? headers.indexOf(dateCol) : -1;

  const regions = regionIdx >= 0
    ? [...new Set(rows.map(r => r[regionIdx]).filter(Boolean))]
    : [];
  const metricTypes = metricIdx >= 0
    ? [...new Set(rows.map(r => r[metricIdx]).filter(Boolean))]
    : [];

  // Generate signals
  const signals: { icon: string; title: string; description: string }[] = [];

  // Volatility detection
  if (valueIdx >= 0 && rows.length > 10) {
    const values = rows.map(r => parseFloat(r[valueIdx])).filter(v => !isNaN(v));
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

  // Trend detection (simple: compare first third vs last third)
  if (valueIdx >= 0 && dateIdx >= 0 && rows.length > 20) {
    const sorted = [...rows].sort((a, b) => {
      const da = Date.parse(a[dateIdx]) || 0;
      const db = Date.parse(b[dateIdx]) || 0;
      return da - db;
    });
    const third = Math.floor(sorted.length / 3);
    const earlyAvg = sorted.slice(0, third).reduce((s, r) => s + (parseFloat(r[valueIdx]) || 0), 0) / third;
    const lateAvg = sorted.slice(-third).reduce((s, r) => s + (parseFloat(r[valueIdx]) || 0), 0) / third;
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
    recordCount: validation.totalRows,
    columnCount: headers.length,
    dateSpan,
    regionCount: regions.length,
    regions: regions.slice(0, 8),
    metricTypes: metricTypes.slice(0, 6),
    signals,
    qualityScore: qScore,
    qualityLabel: qScore >= 80 ? "Excellent" : qScore >= 50 ? "Fair" : "Poor",
  };
}

// ---- Confidence badge color ----
const confidenceColor = (c: number) =>
  c >= 80 ? "bg-green-500/10 text-green-600 border-green-500/20" :
  c >= 60 ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" :
  "bg-muted text-muted-foreground border-border";

const qualityColor = (score: number) =>
  score >= 80 ? "text-green-500" : score >= 50 ? "text-yellow-500" : "text-red-500";

const qualityLabel = (score: number) =>
  score >= 80 ? "Excellent" : score >= 50 ? "Fair" : "Poor";

const typeIcon = (t: string) => {
  switch (t) {
    case "date": return <Calendar className="w-3.5 h-3.5" />;
    case "value": return <Hash className="w-3.5 h-3.5" />;
    case "region": return <Globe className="w-3.5 h-3.5" />;
    case "segment": return <BarChart3 className="w-3.5 h-3.5" />;
    case "metric_type": return <TrendingUp className="w-3.5 h-3.5" />;
    default: return <X className="w-3.5 h-3.5" />;
  }
};

// ============ Component ============
const DataUpload = () => {
  const { user } = useAuth();
  const { currentOrgId } = useOrganization();
  const { tier, subscribed } = useSubscription();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [datasetName, setDatasetName] = useState("");
  const [defaultMetricType, setDefaultMetricType] = useState("revenue");
  const [importCount, setImportCount] = useState(0);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [detectedSchema, setDetectedSchema] = useState<DetectedSchema[]>([]);
  const [intelligence, setIntelligence] = useState<DatasetIntelligence | null>(null);
  const [yearAutoFixed, setYearAutoFixed] = useState(false);

  const parseCSV = useCallback((text: string) => {
    const lines = text.trim().split("\n").map((l) =>
      l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
    );
    if (lines.length < 2) return;
    const hdrs = lines[0];
    const dataRows = lines.slice(1);
    setHeaders(hdrs);
    setAllRows(dataRows);
    setRows(dataRows.slice(0, 100));

    // Run autodetection
    const schema = inferSchema(hdrs, dataRows);
    setDetectedSchema(schema);

    // Build auto-mapping from detection
    const autoMap: Record<string, string> = {};
    schema.forEach(s => { autoMap[s.column] = s.inferredType; });
    setMapping(autoMap);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 20MB.", variant: "destructive" });
      return;
    }
    if (!f.name.endsWith(".csv")) {
      toast({ title: "Invalid file type", description: "Only CSV files are supported.", variant: "destructive" });
      return;
    }
    setFile(f);
    setDatasetName(f.name.replace(/\.csv$/i, ""));
    const reader = new FileReader();
    reader.onload = (ev) => {
      parseCSV(ev.target?.result as string);
      setStep("autodetect");
    };
    reader.readAsText(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f || !f.name.endsWith(".csv")) {
      toast({ title: "Only CSV files supported", variant: "destructive" });
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum 20MB.", variant: "destructive" });
      return;
    }
    setFile(f);
    setDatasetName(f.name.replace(/\.csv$/i, ""));
    const reader = new FileReader();
    reader.onload = (ev) => {
      parseCSV(ev.target?.result as string);
      setStep("autodetect");
    };
    reader.readAsText(f);
  };

  // Auto-fix year-only dates
  const applyYearToDateFix = () => {
    const dateCol = Object.entries(mapping).find(([, v]) => v === "date")?.[0];
    if (!dateCol) return;
    const dateIdx = headers.indexOf(dateCol);
    if (dateIdx < 0) return;

    const fixedRows = allRows.map(row => {
      const newRow = [...row];
      const val = newRow[dateIdx]?.trim();
      if (val && /^\d{4}$/.test(val)) {
        newRow[dateIdx] = `${val}-01-01`;
      }
      return newRow;
    });
    setAllRows(fixedRows);
    setRows(fixedRows.slice(0, 100));
    setYearAutoFixed(true);
    toast({ title: "Dates converted", description: "Year values converted to YYYY-01-01 format." });
  };

  const hasYearOnlyDates = useMemo(() => {
    return detectedSchema.some(s => s.autoFix === "year_to_date");
  }, [detectedSchema]);

  const runValidation = () => {
    const hasMappedDate = Object.values(mapping).includes("date");
    const hasMappedValue = Object.values(mapping).includes("value");
    if (!hasMappedDate || !hasMappedValue) {
      toast({ title: "Date and Value columns required", description: "Please map at least a date and value column.", variant: "destructive" });
      return;
    }
    const result = validateData(allRows, headers, mapping);
    setValidation(result);

    // Generate intelligence preview
    const intel = generateIntelligence(headers, allRows, mapping, result);
    setIntelligence(intel);

    if (result.errors.length === 0 || result.validRows > 0) {
      setStep("intelligence");
    } else {
      setStep("validation");
    }
  };

  const handleImport = async () => {
    if (!currentOrgId || !user || !file) return;

    if (tier === "starter") {
      const { count } = await supabase
        .from("datasets")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", currentOrgId);
      if ((count ?? 0) >= 1) {
        toast({ title: "Dataset limit reached", description: "Starter plan allows 1 dataset. Upgrade to Growth for unlimited.", variant: "destructive" });
        return;
      }
    }
    if (!subscribed) {
      toast({ title: "Subscription required", description: "Please subscribe to upload datasets.", variant: "destructive" });
      return;
    }

    setStep("importing");

    try {
      const filePath = `${currentOrgId}/${Date.now()}_${file.name}`;
      await supabase.storage.from("datasets").upload(filePath, file);

      const { data: dataset, error: dsError } = await supabase
        .from("datasets")
        .insert({
          organization_id: currentOrgId,
          name: datasetName,
          file_path: filePath,
          uploaded_by: user.id,
          row_count: allRows.length,
          column_mapping: mapping,
          status: "processing",
        })
        .select()
        .single();

      if (dsError) throw dsError;

      const dateCol = Object.entries(mapping).find(([, v]) => v === "date")?.[0];
      const valueCol = Object.entries(mapping).find(([, v]) => v === "value")?.[0];
      const regionCol = Object.entries(mapping).find(([, v]) => v === "region")?.[0];
      const segmentCol = Object.entries(mapping).find(([, v]) => v === "segment")?.[0];
      const metricTypeCol = Object.entries(mapping).find(([, v]) => v === "metric_type")?.[0];

      const dateIdx = headers.indexOf(dateCol!);
      const valueIdx = headers.indexOf(valueCol!);
      const regionIdx = regionCol ? headers.indexOf(regionCol) : -1;
      const segmentIdx = segmentCol ? headers.indexOf(segmentCol) : -1;
      const metricTypeIdx = metricTypeCol ? headers.indexOf(metricTypeCol) : -1;

      const metricsToInsert = allRows
        .map((cols) => {
          const val = parseFloat(cols[valueIdx]);
          let dateVal = cols[dateIdx]?.trim();
          if (!dateVal) return null;
          // Safety net: normalize year-only values even if user skipped auto-fix
          if (/^\d{4}$/.test(dateVal)) {
            dateVal = `${dateVal}-01-01`;
          }
          if (isNaN(val) || !isFinite(val) || Math.abs(val) > 1e12) return null;
          if (isNaN(Date.parse(dateVal))) return null;
          return {
            organization_id: currentOrgId,
            dataset_id: dataset.id,
            metric_type: metricTypeIdx >= 0 ? cols[metricTypeIdx] : defaultMetricType,
            value: val,
            date: dateVal,
            region: regionIdx >= 0 ? cols[regionIdx] || null : null,
            segment: segmentIdx >= 0 ? cols[segmentIdx] || null : null,
          };
        })
        .filter(Boolean);

      let inserted = 0;
      for (let i = 0; i < metricsToInsert.length; i += 500) {
        const batch = metricsToInsert.slice(i, i + 500);
        const { error } = await supabase.from("metrics").insert(batch as any);
        if (error) throw error;
        inserted += batch.length;
      }

      await supabase.from("datasets").update({ status: "completed", row_count: inserted, current_version: 1 }).eq("id", dataset.id);

      await supabase.from("dataset_versions").insert({
        dataset_id: dataset.id,
        organization_id: currentOrgId,
        version_number: 1,
        file_path: filePath,
        row_count: inserted,
        column_mapping: mapping,
        change_summary: "Initial upload",
        created_by: user.id,
        is_active: true,
      });

      await supabase.functions.invoke("generate-insights", {
        body: { organization_id: currentOrgId },
      }).catch(() => {});

      setImportCount(inserted);
      setStep("done");
      toast({ title: `Imported ${inserted} records successfully!` });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
      setStep("mapping");
    }
  };

  // ---- Step indicator ----
  const steps = [
    { key: "upload", label: "Upload" },
    { key: "autodetect", label: "Detect" },
    { key: "mapping", label: "Map" },
    { key: "intelligence", label: "Preview" },
    { key: "importing", label: "Import" },
  ];
  const currentStepIndex = steps.findIndex(s => s.key === step || (step === "validation" && s.key === "intelligence"));

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-14 border-b border-border/30 flex items-center px-8 shrink-0 bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <SidebarMobileToggle />
            <h1 className="text-xl font-semibold font-display">Data Import</h1>
          </div>
        </header>

        {/* Step indicator */}
        {step !== "upload" && step !== "done" && (
          <div className="px-8 py-3 border-b border-border/20 bg-muted/20">
            <div className="flex items-center gap-1 max-w-xl">
              {steps.map((s, i) => (
                <div key={s.key} className="flex items-center gap-1">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    i <= currentStepIndex
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground"
                  }`}>
                    {i < currentStepIndex ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <span className="w-4 text-center">{i + 1}</span>
                    )}
                    {s.label}
                  </div>
                  {i < steps.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <main className="flex-1 p-8 overflow-auto">
          <AnimatePresence mode="wait">
            {/* Step: Upload */}
            {step === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-border hover:border-primary/40 rounded-xl p-12 flex flex-col items-center justify-center transition-colors cursor-pointer min-h-[400px] bg-card"
                onClick={() => document.getElementById("csv-input")?.click()}
              >
                <Upload className="w-16 h-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold font-display mb-2">Upload CSV File</h2>
                <p className="text-muted-foreground text-sm mb-4">Drag & drop or click to browse</p>
                <p className="text-xs text-muted-foreground">Supports: CSV files up to 20MB with date and value columns</p>
                <input id="csv-input" type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
                <UploadTrustBadges />
              </motion.div>
            )}

            {/* Step: Autodetect — Schema Intelligence */}
            {step === "autodetect" && (
              <motion.div
                key="autodetect"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                className="space-y-6"
              >
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold font-display">Dataset Structure Detected</h2>
                        <p className="text-xs text-muted-foreground">
                          {file?.name} · {allRows.length.toLocaleString()} rows · {headers.length} columns
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 space-y-2">
                      {detectedSchema.map((det) => (
                        <div key={det.column} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
                          <div className="flex items-center gap-2 w-44 shrink-0">
                            {typeIcon(det.inferredType)}
                            <span className="text-sm font-medium truncate">{det.column}</span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 flex items-center gap-2">
                            <Badge variant="outline" className={`text-xs ${confidenceColor(det.confidence)}`}>
                              {det.inferredType === "skip" ? "Not mapped" : det.inferredType}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{det.reason}</span>
                          </div>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${confidenceColor(det.confidence)}`}>
                            {det.confidence}%
                          </Badge>
                        </div>
                      ))}
                    </div>

                    {/* Year-to-date auto-fix prompt */}
                    {hasYearOnlyDates && !yearAutoFixed && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        className="mt-4 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5"
                      >
                        <div className="flex items-start gap-3">
                          <Wand2 className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">Year-only dates detected</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Your dataset uses year values (e.g., 1990). We can convert them to full dates automatically.
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 font-mono bg-muted/50 px-2 py-1 rounded inline-block">
                              1990 → 1990-01-01
                            </p>
                          </div>
                          <Button size="sm" variant="outline" onClick={applyYearToDateFix} className="shrink-0 gap-1.5">
                            <Zap className="w-3 h-3" /> Convert automatically
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {yearAutoFixed && (
                      <div className="mt-4 p-3 rounded-lg border border-green-500/30 bg-green-500/5 flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-green-700 dark:text-green-400">Year values converted to full dates.</span>
                      </div>
                    )}

                    {/* Data preview mini-table */}
                    <div className="mt-6">
                      <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Sample Data</p>
                      <div className="overflow-x-auto max-h-48 overflow-y-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border bg-muted/50">
                              {headers.map((h) => (
                                <th key={h} className="text-left py-2 px-3 text-muted-foreground font-medium">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.slice(0, 5).map((row, i) => (
                              <tr key={i} className="border-b border-border/50">
                                {row.map((cell, j) => (
                                  <td key={j} className="py-1.5 px-3 text-foreground/80">{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("mapping")} className="gap-2">
                    <Eye className="w-4 h-4" /> Adjust Mapping
                  </Button>
                  <Button onClick={runValidation} className="gap-2">
                    Accept & Continue <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step: Manual Mapping Adjustment */}
            {step === "mapping" && (
              <motion.div
                key="mapping"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                className="space-y-6"
              >
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-lg font-semibold font-display mb-1">Adjust Column Mapping</h2>
                    <p className="text-xs text-muted-foreground mb-6">Fine-tune the auto-detected mapping. Date and Value are required.</p>
                    <div className="space-y-3">
                      {headers.map((h) => (
                        <div key={h} className="flex items-center gap-4">
                          <span className="w-40 text-sm font-medium truncate">{h}</span>
                          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          <select
                            value={mapping[h] || "skip"}
                            onChange={(e) => setMapping((prev) => ({ ...prev, [h]: e.target.value }))}
                            className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          >
                            {COLUMN_TARGETS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          {mapping[h] && mapping[h] !== "skip" && (
                            <Badge variant="outline" className="text-xs">
                              <Check className="w-3 h-3 mr-1" /> Mapped
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-6">
                      <label className="block text-sm font-medium mb-1.5">Dataset Name</label>
                      <input
                        value={datasetName}
                        onChange={(e) => setDatasetName(e.target.value.slice(0, 100))}
                        className="w-full max-w-md px-4 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        maxLength={100}
                      />
                    </div>
                    {!Object.values(mapping).includes("metric_type") && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium mb-1.5">Default Metric Type</label>
                        <select
                          value={defaultMetricType}
                          onChange={(e) => setDefaultMetricType(e.target.value)}
                          className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm"
                        >
                          {METRIC_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Button onClick={runValidation} className="gap-2">
                  Validate Data <ShieldCheck className="w-4 h-4" />
                </Button>
              </motion.div>
            )}

            {/* Step: Validation — Humanized Errors */}
            {step === "validation" && validation && (
              <motion.div
                key="validation"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                className="space-y-6"
              >
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <AlertTriangle className="w-6 h-6 text-yellow-500" />
                      <div>
                        <h2 className="text-lg font-semibold font-display">Data Issues Found</h2>
                        <p className="text-xs text-muted-foreground">
                          {validation.validRows} of {validation.totalRows} rows are valid · {validation.errors.length} issue{validation.errors.length !== 1 ? "s" : ""} detected
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Group errors by type */}
                      {(() => {
                        const grouped = new Map<string, HumanizedError[]>();
                        validation.errors.forEach(err => {
                          const existing = grouped.get(err.friendlyTitle) || [];
                          existing.push(err);
                          grouped.set(err.friendlyTitle, existing);
                        });

                        return Array.from(grouped.entries()).map(([title, errs]) => (
                          <div key={title} className="rounded-lg border border-border overflow-hidden">
                            <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                <span className="text-sm font-medium">{title}</span>
                                <Badge variant="outline" className="text-xs">{errs.length} row{errs.length > 1 ? "s" : ""}</Badge>
                              </div>
                              {errs[0].autoFixable && errs[0].fixType === "year_to_date" && !yearAutoFixed && (
                                <Button size="sm" variant="outline" onClick={applyYearToDateFix} className="gap-1 text-xs h-7">
                                  <Zap className="w-3 h-3" /> Fix automatically
                                </Button>
                              )}
                            </div>
                            <div className="px-4 py-3">
                              <p className="text-xs text-muted-foreground">{errs[0].friendlyDescription}</p>
                              {errs[0].suggestion && (
                                <p className="text-xs text-primary mt-1">{errs[0].suggestion}</p>
                              )}
                              {errs.length > 3 && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Affects rows: {errs.slice(0, 5).map(e => e.row).join(", ")}{errs.length > 5 ? ` and ${errs.length - 5} more` : ""}
                                </p>
                              )}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("mapping")}>
                    Back to Mapping
                  </Button>
                  {validation.validRows > 0 && (
                    <Button onClick={() => {
                      const intel = generateIntelligence(headers, allRows, mapping, validation);
                      setIntelligence(intel);
                      setStep("intelligence");
                    }} className="gap-2">
                      Continue with {validation.validRows} valid rows <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step: Intelligence Preview */}
            {step === "intelligence" && intelligence && validation && (
              <motion.div
                key="intelligence"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                className="space-y-6"
              >
                <Card className="overflow-hidden">
                  <div className="bg-gradient-to-r from-primary/5 to-primary/0 p-6 border-b border-border/30">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold font-display">Dataset Intelligence</h2>
                        <p className="text-xs text-muted-foreground">{datasetName}</p>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    {/* KPI Strip */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{intelligence.recordCount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Records</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{intelligence.dateSpan || "—"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Time Span</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{intelligence.regionCount || "—"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Regions</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <p className={`text-2xl font-bold ${qualityColor(intelligence.qualityScore)}`}>
                          {intelligence.qualityScore}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Quality Score</p>
                        <Badge className={`mt-1 text-[10px] ${
                          intelligence.qualityScore >= 80 ? "bg-green-500/10 text-green-500" :
                          intelligence.qualityScore >= 50 ? "bg-yellow-500/10 text-yellow-500" :
                          "bg-red-500/10 text-red-500"
                        } border-none`}>
                          {intelligence.qualityLabel}
                        </Badge>
                      </div>
                    </div>

                    {/* Regions */}
                    {intelligence.regions.length > 0 && (
                      <div className="mb-5">
                        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Regions</p>
                        <div className="flex flex-wrap gap-1.5">
                          {intelligence.regions.map(r => (
                            <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                          ))}
                          {intelligence.regionCount > 8 && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">+{intelligence.regionCount - 8} more</Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Signals */}
                    {intelligence.signals.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Signals Detected</p>
                        <div className="space-y-2">
                          {intelligence.signals.map((sig, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
                              <span className="text-lg leading-none mt-0.5">{sig.icon}</span>
                              <div>
                                <p className="text-sm font-medium">{sig.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{sig.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Value range */}
                    {validation.valueRange && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4">
                        <BarChart3 className="w-3.5 h-3.5" />
                        Value range: {validation.valueRange.min.toLocaleString()} → {validation.valueRange.max.toLocaleString()}
                      </div>
                    )}

                    {/* Errors summary */}
                    {validation.invalidRows > 0 && (
                      <div className="mt-4 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          {validation.invalidRows} row{validation.invalidRows > 1 ? "s" : ""} will be skipped due to data issues.
                          <button onClick={() => setStep("validation")} className="text-primary ml-1 hover:underline">View details</button>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("mapping")}>
                    Edit Mapping
                  </Button>
                  {validation.validRows > 0 && (
                    <Button onClick={handleImport} className="gap-2">
                      Import {validation.validRows.toLocaleString()} Records <Check className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step: Importing */}
            {step === "importing" && (
              <motion.div
                key="importing"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                className="bg-card border border-border p-12 rounded-xl flex flex-col items-center justify-center min-h-[400px]"
              >
                <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-lg font-semibold font-display">Importing data...</p>
                <p className="text-sm text-muted-foreground mt-1">Processing and generating intelligence signals</p>
              </motion.div>
            )}

            {/* Step: Done */}
            {step === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="bg-card border border-border p-12 rounded-xl flex flex-col items-center justify-center min-h-[400px]"
              >
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-xl font-semibold font-display mb-2">Import Complete</h2>
                <p className="text-muted-foreground text-sm mb-6">{importCount.toLocaleString()} records imported · Intelligence signals generated</p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => {
                    setStep("upload"); setFile(null); setRows([]); setAllRows([]); setHeaders([]);
                    setValidation(null); setDetectedSchema([]); setIntelligence(null); setYearAutoFixed(false);
                  }}>
                    Upload Another
                  </Button>
                  <Button onClick={() => navigate("/dashboard")} className="gap-2">
                    View Dashboard <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default DataUpload;

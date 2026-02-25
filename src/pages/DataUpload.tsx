import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload, FileSpreadsheet, ArrowRight, Check, X,
  AlertTriangle, ShieldCheck, BarChart3, Info,
} from "lucide-react";

type Step = "upload" | "preview" | "mapping" | "validation" | "importing" | "done";

const METRIC_TYPES = ["revenue", "cost", "customers", "churn", "headcount", "marketing_spend"] as const;
const COLUMN_TARGETS = ["date", "value", "region", "segment", "metric_type", "skip"] as const;

interface ValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: { row: number; message: string }[];
  qualityScore: number;
  completeness: number;
  dateRange: { min: string; max: string } | null;
  valueRange: { min: number; max: number } | null;
}

function validateData(
  rows: string[][],
  headers: string[],
  mapping: Record<string, string>,
): ValidationResult {
  const dateCol = Object.entries(mapping).find(([, v]) => v === "date")?.[0];
  const valueCol = Object.entries(mapping).find(([, v]) => v === "value")?.[0];
  const dateIdx = dateCol ? headers.indexOf(dateCol) : -1;
  const valueIdx = valueCol ? headers.indexOf(valueCol) : -1;

  const errors: { row: number; message: string }[] = [];
  let validRows = 0;
  const dates: string[] = [];
  const values: number[] = [];
  let totalCells = 0;
  let filledCells = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let rowValid = true;

    // Count completeness
    row.forEach((cell) => {
      totalCells++;
      if (cell && cell.trim()) filledCells++;
    });

    // Validate date
    if (dateIdx >= 0) {
      const d = row[dateIdx];
      if (!d || !d.trim()) {
        errors.push({ row: i + 2, message: "Missing date value" });
        rowValid = false;
      } else if (isNaN(Date.parse(d))) {
        errors.push({ row: i + 2, message: `Invalid date format: "${d}"` });
        rowValid = false;
      } else {
        dates.push(d);
      }
    }

    // Validate value
    if (valueIdx >= 0) {
      const v = row[valueIdx];
      const num = parseFloat(v);
      if (!v || !v.trim()) {
        errors.push({ row: i + 2, message: "Missing value" });
        rowValid = false;
      } else if (isNaN(num) || !isFinite(num)) {
        errors.push({ row: i + 2, message: `Non-numeric value: "${v}"` });
        rowValid = false;
      } else if (Math.abs(num) > 1e12) {
        errors.push({ row: i + 2, message: `Value exceeds limit: ${num}` });
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

  const parseCSV = useCallback((text: string) => {
    const lines = text.trim().split("\n").map((l) =>
      l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
    );
    if (lines.length < 2) return;
    setHeaders(lines[0]);
    const dataRows = lines.slice(1);
    setAllRows(dataRows);
    setRows(dataRows.slice(0, 100));
    // Auto-map obvious columns
    const autoMap: Record<string, string> = {};
    lines[0].forEach((h) => {
      const lower = h.toLowerCase();
      if (lower.includes("date")) autoMap[h] = "date";
      else if (lower.includes("revenue") || lower.includes("value") || lower.includes("amount")) autoMap[h] = "value";
      else if (lower.includes("region") || lower.includes("country")) autoMap[h] = "region";
      else if (lower.includes("segment") || lower.includes("category")) autoMap[h] = "segment";
      else if (lower.includes("metric") || lower.includes("type")) autoMap[h] = "metric_type";
      else autoMap[h] = "skip";
    });
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
      setStep("preview");
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
      setStep("preview");
    };
    reader.readAsText(f);
  };

  const runValidation = () => {
    const hasMappedDate = Object.values(mapping).includes("date");
    const hasMappedValue = Object.values(mapping).includes("value");
    if (!hasMappedDate || !hasMappedValue) {
      toast({ title: "Date and Value columns required", description: "Please map at least a date and value column.", variant: "destructive" });
      return;
    }
    const result = validateData(allRows, headers, mapping);
    setValidation(result);
    setStep("validation");
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
          const dateVal = cols[dateIdx];
          if (isNaN(val) || !isFinite(val) || Math.abs(val) > 1e12) return null;
          if (!dateVal || isNaN(Date.parse(dateVal))) return null;
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

  const qualityColor = (score: number) =>
    score >= 80 ? "text-green-500" : score >= 50 ? "text-yellow-500" : "text-red-500";

  const qualityLabel = (score: number) =>
    score >= 80 ? "Excellent" : score >= 50 ? "Fair" : "Poor";

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-14 border-b border-border/30 flex items-center px-8 shrink-0 bg-background/60 backdrop-blur-sm">
          <h1 className="text-xl font-semibold font-display">Data Upload</h1>
        </header>
        <main className="flex-1 p-8 overflow-auto">
          {/* Step: Upload */}
          {step === "upload" && (
            <div
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
            </div>
          )}

          {/* Step: Preview */}
          {step === "preview" && (
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <FileSpreadsheet className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold font-display">{file?.name}</h2>
                    <Badge variant="outline">{allRows.length} rows</Badge>
                    <Badge variant="outline">{headers.length} columns</Badge>
                  </div>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          {headers.map((h) => (
                            <th key={h} className="text-left py-2 px-3 text-muted-foreground font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 10).map((row, i) => (
                          <tr key={i} className="border-b border-border/50">
                            {row.map((cell, j) => (
                              <td key={j} className="py-2 px-3 text-foreground/80">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              <button
                onClick={() => setStep("mapping")}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all"
              >
                Continue to Column Mapping <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step: Column Mapping */}
          {step === "mapping" && (
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold font-display mb-1">Map Columns</h2>
                  <p className="text-xs text-muted-foreground mb-6">Map your CSV columns to system fields. Date and Value are required.</p>
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
              <button
                onClick={runValidation}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all"
              >
                Validate Data <ShieldCheck className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step: Validation Report */}
          {step === "validation" && validation && (
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                    <h2 className="text-lg font-semibold font-display">Data Quality Report</h2>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <p className={`text-3xl font-bold ${qualityColor(validation.qualityScore)}`}>
                        {validation.qualityScore}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Quality Score</p>
                      <Badge className={`mt-1 ${validation.qualityScore >= 80 ? "bg-green-500/10 text-green-500" : validation.qualityScore >= 50 ? "bg-yellow-500/10 text-yellow-500" : "bg-red-500/10 text-red-500"} border-none`}>
                        {qualityLabel(validation.qualityScore)}
                      </Badge>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-foreground">{validation.validRows}</p>
                      <p className="text-xs text-muted-foreground mt-1">Valid Rows</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-destructive">{validation.invalidRows}</p>
                      <p className="text-xs text-muted-foreground mt-1">Invalid Rows</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-foreground">{validation.completeness}%</p>
                      <p className="text-xs text-muted-foreground mt-1">Completeness</p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Data Quality</span>
                        <span className={qualityColor(validation.qualityScore)}>{validation.qualityScore}/100</span>
                      </div>
                      <Progress value={validation.qualityScore} className="h-2" />
                    </div>
                  </div>

                  {validation.dateRange && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Info className="w-4 h-4" />
                      Date range: {validation.dateRange.min} → {validation.dateRange.max}
                    </div>
                  )}
                  {validation.valueRange && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <BarChart3 className="w-4 h-4" />
                      Value range: {validation.valueRange.min.toLocaleString()} → {validation.valueRange.max.toLocaleString()}
                    </div>
                  )}

                  {validation.errors.length > 0 && (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="bg-destructive/5 px-4 py-2 border-b border-border flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                        <span className="text-sm font-medium">Validation Errors ({validation.errors.length}{validation.errors.length >= 50 ? "+" : ""})</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-border/50">
                        {validation.errors.map((err, i) => (
                          <div key={i} className="px-4 py-2 text-sm flex items-center gap-3">
                            <span className="text-muted-foreground shrink-0">Row {err.row}</span>
                            <span className="text-foreground/80">{err.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("mapping")}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
                >
                  Back to Mapping
                </button>
                {validation.validRows > 0 && (
                  <button
                    onClick={handleImport}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all"
                  >
                    Import {validation.validRows} Valid Records <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step: Importing */}
          {step === "importing" && (
            <div className="bg-card border border-border p-12 rounded-xl flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-lg font-semibold font-display">Importing data...</p>
              <p className="text-sm text-muted-foreground mt-1">Processing and validating your CSV file</p>
            </div>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="bg-card border border-border p-12 rounded-xl flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold font-display mb-2">Import Complete!</h2>
              <p className="text-muted-foreground text-sm mb-6">{importCount} records imported successfully</p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep("upload"); setFile(null); setRows([]); setAllRows([]); setHeaders([]); setValidation(null); }}
                  className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
                >
                  Upload Another
                </button>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all"
                >
                  View Dashboard
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default DataUpload;

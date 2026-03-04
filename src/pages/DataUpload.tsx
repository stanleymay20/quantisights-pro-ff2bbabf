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
import { Button } from "@/components/ui/button";
import {
  Upload, FileSpreadsheet, ArrowRight, Check, X,
  AlertTriangle, ShieldCheck, BarChart3, Info,
  Sparkles, Wand2, Globe, Calendar, Hash, TrendingUp,
  Zap, Eye, ChevronRight, Layers, Database, Activity,
  Tag,
} from "lucide-react";
import UploadTrustBadges from "@/components/security/UploadTrustBadges";
import { motion, AnimatePresence } from "framer-motion";
import {
  type DetectedSchema, type ValidationResult, type HumanizedError,
  type DatasetIntelligence, type DatasetDiagnostics, type DatasetClassification,
  type ImportMode, type ColumnMapping, type ColumnTarget,
  inferSchema, validateData, generateIntelligence, computeDiagnostics,
  classifyDataset, confidenceColor, qualityColor, humanizeError, parseCSVText,
  slugifyMetric, deduplicateMetricSlugs,
} from "@/lib/data-upload-utils";

type Step = "upload" | "autodetect" | "mapping" | "validation" | "intelligence" | "importing" | "done";

const METRIC_TYPES = ["revenue", "cost", "customers", "churn", "headcount", "marketing_spend"] as const;
const COLUMN_TARGETS = ["date", "value", "region", "region_code", "segment", "metric_type", "skip"] as const;

const typeIcon = (t: string) => {
  switch (t) {
    case "date": return <Calendar className="w-3.5 h-3.5" />;
    case "value": return <Hash className="w-3.5 h-3.5" />;
    case "region": return <Globe className="w-3.5 h-3.5" />;
    case "region_code": return <Tag className="w-3.5 h-3.5" />;
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
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [datasetName, setDatasetName] = useState("");
  const [defaultMetricType, setDefaultMetricType] = useState("revenue");
  const [importCount, setImportCount] = useState(0);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [detectedSchema, setDetectedSchema] = useState<DetectedSchema[]>([]);
  const [intelligence, setIntelligence] = useState<DatasetIntelligence | null>(null);
  const [yearAutoFixed, setYearAutoFixed] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("single");
  const [diagnostics, setDiagnostics] = useState<DatasetDiagnostics | null>(null);
  const [classification, setClassification] = useState<DatasetClassification | null>(null);

  const valueColumnCount = useMemo(() => {
    return Object.values(mapping).filter(v => v === "value").length;
  }, [mapping]);

  const dateColumnCount = useMemo(() => {
    return Object.values(mapping).filter(v => v === "date").length;
  }, [mapping]);

  const handleParse = useCallback((text: string) => {
    const { headers: hdrs, rows: dataRows } = parseCSVText(text);
    if (hdrs.length === 0) return;
    setHeaders(hdrs);
    setAllRows(dataRows);
    setRows(dataRows.slice(0, 100));

    const schema = inferSchema(hdrs, dataRows);
    setDetectedSchema(schema);

    // Build mapping keyed by colIdx
    const autoMap: ColumnMapping = {};
    schema.forEach(s => { autoMap[s.colIdx] = s.inferredType; });
    setMapping(autoMap);

    const valCount = schema.filter(s => s.inferredType === "value").length;
    if (valCount > 1) {
      setImportMode("multi");
    }

    const cls = classifyDataset(hdrs, autoMap);
    setClassification(cls);
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
      handleParse(ev.target?.result as string);
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
      handleParse(ev.target?.result as string);
      setStep("autodetect");
    };
    reader.readAsText(f);
  };

  // Helper: find colIdx mapped to a target type
  const findMappedColIdx = (target: ColumnTarget): number => {
    const entry = Object.entries(mapping).find(([, v]) => v === target);
    return entry ? Number(entry[0]) : -1;
  };

  const findAllMappedColIdx = (target: ColumnTarget): number[] => {
    return Object.entries(mapping)
      .filter(([, v]) => v === target)
      .map(([k]) => Number(k));
  };

  const applyYearToDateFix = () => {
    const dateIdx = findMappedColIdx("date");
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

  const autoSelectBestDate = () => {
    const dateCols = Object.entries(mapping).filter(([, v]) => v === "date");
    if (dateCols.length <= 1) return;
    // Pick the one with best schema confidence
    const best = dateCols.reduce((bestEntry, [colIdxStr]) => {
      const colIdx = Number(colIdxStr);
      const det = detectedSchema.find(d => d.colIdx === colIdx);
      const bestDet = detectedSchema.find(d => d.colIdx === Number(bestEntry[0]));
      return (det?.confidence ?? 0) > (bestDet?.confidence ?? 0) ? [colIdxStr, "date"] : bestEntry;
    }, dateCols[0]);
    const bestColIdx = Number(best[0]);
    const newMapping = { ...mapping };
    dateCols.forEach(([colIdxStr]) => {
      const colIdx = Number(colIdxStr);
      if (colIdx !== bestColIdx) newMapping[colIdx] = "skip";
    });
    setMapping(newMapping);
    const bestHeader = headers[bestColIdx] || `col ${bestColIdx}`;
    toast({ title: "Date column selected", description: `"${bestHeader}" set as primary time dimension.` });
  };

  const hasYearOnlyDates = useMemo(() => {
    return detectedSchema.some(s => s.autoFix === "year_to_date");
  }, [detectedSchema]);

  // Get sample values for each column index from first 3 rows
  const sampleValuesByColIdx = useMemo(() => {
    const map: Record<number, string[]> = {};
    headers.forEach((_, idx) => {
      map[idx] = rows.slice(0, 3).map(r => r[idx] || "").filter(Boolean);
    });
    return map;
  }, [headers, rows]);

  const runValidation = () => {
    if (dateColumnCount > 1) {
      toast({
        title: "Multiple date columns detected",
        description: "Only one column can be mapped as date. Please choose one primary time dimension.",
        variant: "destructive",
      });
      return;
    }
    const hasMappedDate = Object.values(mapping).includes("date");
    const hasMappedValue = Object.values(mapping).includes("value");
    if (!hasMappedDate || !hasMappedValue) {
      toast({ title: "Date and Value columns required", description: "Please map at least a date and value column.", variant: "destructive" });
      return;
    }
    const result = validateData(allRows, headers, mapping, importMode);
    setValidation(result);

    const intel = generateIntelligence(headers, allRows, mapping, result, importMode);
    setIntelligence(intel);

    const diag = computeDiagnostics(allRows, headers, mapping);
    setDiagnostics(diag);

    const cls = classifyDataset(headers, mapping);
    setClassification(cls);

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

      // Convert colIdx mapping to deterministic composite keys for storage
      const storedMapping: Record<string, string> = {};
      Object.entries(mapping).forEach(([colIdxStr, target]) => {
        const colIdx = Number(colIdxStr);
        const headerName = headers[colIdx] || `col_${colIdx}`;
        storedMapping[`${colIdx}:${headerName}`] = target;
      });

      const { data: dataset, error: dsError } = await supabase
        .from("datasets")
        .insert({
          organization_id: currentOrgId,
          name: datasetName,
          file_path: filePath,
          uploaded_by: user.id,
          row_count: allRows.length,
          column_mapping: storedMapping,
          status: "processing",
        })
        .select()
        .single();

      if (dsError) throw dsError;

      const dateIdx = findMappedColIdx("date");
      const regionIdx = findMappedColIdx("region");
      const regionCodeIdx = findMappedColIdx("region_code");
      const segmentIdx = findMappedColIdx("segment");
      const metricTypeIdx = findMappedColIdx("metric_type");
      const valueColIndices = findAllMappedColIdx("value");

      // Pre-compute slugified & deduplicated metric names for multi-metric
      const valueColHeaders = valueColIndices.map(i => headers[i] || `col_${i}`);
      const metricSlugs = deduplicateMetricSlugs(valueColHeaders.map(c => slugifyMetric(c)));

      const metricsToInsert: any[] = [];

      for (const row of allRows) {
        let dateVal = dateIdx >= 0 ? row[dateIdx]?.trim() : undefined;
        if (!dateVal) continue;
        if (/^\d{4}$/.test(dateVal)) dateVal = `${dateVal}-01-01`;
        if (isNaN(Date.parse(dateVal))) continue;

        const regionVal = regionIdx >= 0 ? row[regionIdx] || null : null;
        const regionCodeVal = regionCodeIdx >= 0 ? row[regionCodeIdx] || null : null;
        const effectiveRegion = regionVal || regionCodeVal;
        const segmentVal = segmentIdx >= 0 ? row[segmentIdx] || null : null;

        if (importMode === "multi" && valueColIndices.length > 1) {
          for (let vi = 0; vi < valueColIndices.length; vi++) {
            const valIdx = valueColIndices[vi];
            const val = parseFloat(row[valIdx]);
            if (isNaN(val) || !isFinite(val) || Math.abs(val) > 1e12) continue;
            metricsToInsert.push({
              organization_id: currentOrgId,
              dataset_id: dataset.id,
              metric_type: metricSlugs[vi],
              value: val,
              date: dateVal,
              region: effectiveRegion,
              segment: segmentVal,
            });
          }
        } else {
          const valueIdx = valueColIndices[0];
          if (valueIdx === undefined) continue;
          const val = parseFloat(row[valueIdx]);
          if (isNaN(val) || !isFinite(val) || Math.abs(val) > 1e12) continue;
          metricsToInsert.push({
            organization_id: currentOrgId,
            dataset_id: dataset.id,
            metric_type: metricTypeIdx >= 0 ? row[metricTypeIdx] : defaultMetricType,
            value: val,
            date: dateVal,
            region: effectiveRegion,
            segment: segmentVal,
          });
        }
      }

      let inserted = 0;
      for (let i = 0; i < metricsToInsert.length; i += 500) {
        const batch = metricsToInsert.slice(i, i + 500);
        const { error } = await supabase.from("metrics").insert(batch);
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
        column_mapping: storedMapping,
        change_summary: importMode === "multi" ? `Multi-metric import (${valueColIndices.length} metrics normalized)` : "Initial upload",
        created_by: user.id,
        is_active: true,
      });

      await supabase.functions.invoke("generate-insights", {
        body: { organization_id: currentOrgId },
      }).catch(() => {});

      setImportCount(inserted);
      setStep("done");
      toast({ title: `Imported ${inserted.toLocaleString()} records successfully!` });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
      setStep("mapping");
    }
  };

  // Step indicator
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

        {step !== "upload" && step !== "done" && (
          <div className="px-8 py-3 border-b border-border/20 bg-muted/20">
            <div className="flex items-center gap-1 max-w-xl">
              {steps.map((s, i) => (
                <div key={s.key} className="flex items-center gap-1">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    i <= currentStepIndex ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  }`}>
                    {i < currentStepIndex ? <Check className="w-3 h-3" /> : <span className="w-4 text-center">{i + 1}</span>}
                    {s.label}
                  </div>
                  {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
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

            {/* Step: Autodetect */}
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

                    {/* Dataset Classification Badge */}
                    {classification && classification.confidence > 40 && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        className="mt-4 p-3 rounded-lg border border-primary/20 bg-primary/5"
                      >
                        <div className="flex items-center gap-3">
                          <Database className="w-4 h-4 text-primary shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              Detected domain: <span className="text-primary">{classification.type}</span>
                              {classification.subType && <span className="text-muted-foreground"> · {classification.subType}</span>}
                            </p>
                          </div>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${confidenceColor(classification.confidence)}`}>
                            {classification.confidence}% confidence
                          </Badge>
                        </div>
                        {classification.recommendedWorkflows.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5 ml-7">
                            <span className="text-[10px] text-muted-foreground">Recommended:</span>
                            {classification.recommendedWorkflows.map(w => (
                              <Badge key={w} variant="outline" className="text-[10px] bg-muted/30">{w}</Badge>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Import Mode Toggle */}
                    {valueColumnCount >= 2 && (
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="mt-4 p-4 rounded-lg border border-border bg-muted/20"
                      >
                        <p className="text-sm font-medium mb-3 flex items-center gap-2">
                          <Layers className="w-4 h-4 text-primary" /> Import Mode
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setImportMode("single")}
                            className={`flex-1 p-3 rounded-lg border text-left transition-all ${
                              importMode === "single"
                                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                : "border-border hover:border-primary/30"
                            }`}
                          >
                            <p className="text-sm font-medium">Single Metric</p>
                            <p className="text-xs text-muted-foreground mt-0.5">One value column mapped to a metric type</p>
                          </button>
                          <button
                            onClick={() => setImportMode("multi")}
                            className={`flex-1 p-3 rounded-lg border text-left transition-all ${
                              importMode === "multi"
                                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                : "border-border hover:border-primary/30"
                            }`}
                          >
                            <p className="text-sm font-medium">Multi-Metric Dataset</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Each numeric column becomes a separate metric ({valueColumnCount} detected)
                            </p>
                          </button>
                        </div>
                        {importMode === "multi" && (
                          <p className="text-xs text-primary mt-2 flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            Wide format will be automatically normalized to long format during import.
                          </p>
                        )}
                      </motion.div>
                    )}

                    <div className="mt-6 space-y-2">
                      {detectedSchema.map((det) => (
                        <div key={det.colIdx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
                          <div className="flex items-center gap-2 w-44 shrink-0">
                            {typeIcon(det.inferredType)}
                            <div className="min-w-0">
                              <span className="text-sm font-medium truncate block">
                                {det.column}
                                <span className="text-[9px] text-muted-foreground/50 ml-1">#{det.colIdx}</span>
                              </span>
                              {/* Sample value chips */}
                              <div className="flex gap-1 mt-0.5">
                                {(det.sampleValues || []).slice(0, 3).map((sv, i) => (
                                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground truncate max-w-[80px]">
                                    {sv}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-xs ${confidenceColor(det.confidence)}`}>
                                {det.inferredType === "skip" ? "Not mapped" : det.inferredType}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{det.reason}</span>
                            </div>
                            {/* Rules applied (Why this mapping?) */}
                            {det.rulesApplied && det.rulesApplied.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {det.rulesApplied.map((rule, ri) => (
                                  <span key={ri} className="text-[9px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground font-mono">
                                    {rule}
                                  </span>
                                ))}
                              </div>
                            )}
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
                              {headers.map((h, idx) => (
                                <th key={idx} className="text-left py-2 px-3 text-muted-foreground font-medium">{h}</th>
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
                    <p className="text-xs text-muted-foreground mb-4">Fine-tune the auto-detected mapping. Date and Value are required.</p>

                    {/* Date column warning with auto-fix */}
                    {dateColumnCount > 1 && (
                      <div className="mb-4 p-3 rounded-lg border border-destructive/30 bg-destructive/5 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                        <p className="text-xs text-destructive flex-1">
                          Multiple date columns detected ({dateColumnCount}). Only one column can be mapped as date.
                        </p>
                        <Button size="sm" variant="outline" onClick={autoSelectBestDate} className="gap-1 text-xs h-7 shrink-0">
                          <Zap className="w-3 h-3" /> Auto-select best date
                        </Button>
                      </div>
                    )}

                    {/* Import mode toggle in mapping */}
                    <div className="mb-6 p-3 rounded-lg border border-border bg-muted/20 flex items-center gap-4">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" /> Import Mode:
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setImportMode("single")}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                            importMode === "single"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Single Metric
                        </button>
                        <button
                          onClick={() => setImportMode("multi")}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                            importMode === "multi"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Multi-Metric
                        </button>
                      </div>
                      {importMode === "multi" && valueColumnCount > 1 && (
                        <span className="text-xs text-primary">{valueColumnCount} metrics will be normalized</span>
                      )}
                    </div>

                    <div className="space-y-3">
                      {headers.map((h, colIdx) => (
                        <div key={colIdx} className="flex items-center gap-4">
                          <div className="w-44 shrink-0">
                            <span className="text-sm font-medium truncate block">
                              {h}
                              <span className="text-[9px] text-muted-foreground/50 ml-1">#{colIdx}</span>
                            </span>
                            {/* Sample value chips in mapping */}
                            <div className="flex gap-1 mt-0.5">
                              {(sampleValuesByColIdx[colIdx] || []).slice(0, 3).map((sv, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground truncate max-w-[80px]">
                                  {sv}
                                </span>
                              ))}
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          <select
                            value={mapping[colIdx] || "skip"}
                            onChange={(e) => setMapping((prev) => ({ ...prev, [colIdx]: e.target.value as ColumnTarget }))}
                            className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          >
                            {COLUMN_TARGETS.map((t) => (
                              <option key={t} value={t}>{t === "region_code" ? "region_code (ID/ISO)" : t}</option>
                            ))}
                          </select>
                          {mapping[colIdx] && mapping[colIdx] !== "skip" && (
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
                    {importMode === "single" && !Object.values(mapping).includes("metric_type") && (
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
                          {validation.validRows} of {validation.totalRows} rows valid · {validation.validPoints.toLocaleString()} of {validation.totalPoints.toLocaleString()} data points valid · {validation.errors.length} issue{validation.errors.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
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
                  <Button variant="outline" onClick={() => setStep("mapping")}>Back to Mapping</Button>
                  {validation.validRows > 0 && (
                    <Button onClick={() => {
                      const intel = generateIntelligence(headers, allRows, mapping, validation, importMode);
                      setIntelligence(intel);
                      const diag = computeDiagnostics(allRows, headers, mapping);
                      setDiagnostics(diag);
                      setStep("intelligence");
                    }} className="gap-2">
                      Continue with {validation.validPoints.toLocaleString()} valid points <ArrowRight className="w-4 h-4" />
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
                {/* Dataset Classification */}
                {classification && classification.confidence > 40 && (
                  <Card className="overflow-hidden border-primary/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Database className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Detected Domain</p>
                          <p className="text-lg font-semibold font-display text-foreground">
                            {classification.type}
                            {classification.subType && <span className="text-sm text-muted-foreground font-normal ml-2">· {classification.subType}</span>}
                          </p>
                        </div>
                        <Badge variant="outline" className={`text-xs ${confidenceColor(classification.confidence)}`}>
                          {classification.confidence}% confidence
                        </Badge>
                      </div>
                      {classification.recommendedWorkflows.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5 ml-14">
                          <span className="text-[10px] text-muted-foreground self-center">Recommended workflows:</span>
                          {classification.recommendedWorkflows.map(w => (
                            <Badge key={w} variant="outline" className="text-[10px] bg-primary/5">{w}</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

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
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{intelligence.validPointCount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Valid data points
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{intelligence.dateSpan || "—"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Time Span</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{intelligence.regionCount || "—"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Entities</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{intelligence.metricTypes.length || "—"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Metrics</p>
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

                    {/* Metrics detected */}
                    {intelligence.metricTypes.length > 0 && (
                      <div className="mb-5">
                        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Metrics Detected</p>
                        <div className="flex flex-wrap gap-1.5">
                          {intelligence.metricTypes.map(m => (
                            <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Regions */}
                    {intelligence.regions.length > 0 && (
                      <div className="mb-5">
                        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Entities</p>
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
                      <div className="mb-5">
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
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <BarChart3 className="w-3.5 h-3.5" />
                        Value range: {validation.valueRange.min.toLocaleString()} → {validation.valueRange.max.toLocaleString()}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Data Diagnostics Panel */}
                {diagnostics && (
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <Activity className="w-5 h-5 text-primary" />
                        <h3 className="text-base font-semibold font-display">Data Diagnostics</h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                          <p className={`text-lg font-bold ${diagnostics.missingValuesPct > 5 ? "text-yellow-500" : "text-green-500"}`}>
                            {diagnostics.missingValuesPct}%
                          </p>
                          <p className="text-xs text-muted-foreground">Missing values</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                          <p className={`text-lg font-bold ${diagnostics.outlierCount > 5 ? "text-yellow-500" : "text-green-500"}`}>
                            {diagnostics.outlierCount}
                          </p>
                          <p className="text-xs text-muted-foreground">Outliers detected</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                          <p className={`text-lg font-bold ${diagnostics.duplicateRows > 0 ? "text-yellow-500" : "text-green-500"}`}>
                            {diagnostics.duplicateRows}
                          </p>
                          <p className="text-xs text-muted-foreground">Duplicate rows</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                          <p className={`text-lg font-bold ${diagnostics.dateContinuity === "OK" ? "text-green-500" : diagnostics.dateContinuity === "Gaps detected" ? "text-yellow-500" : "text-muted-foreground"}`}>
                            {diagnostics.dateContinuity}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Date continuity{diagnostics.dateGapCount > 0 ? ` (${diagnostics.dateGapCount} gap${diagnostics.dateGapCount > 1 ? "s" : ""})` : ""}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Errors summary */}
                {validation.invalidRows > 0 && (
                  <div className="p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      {validation.invalidPoints.toLocaleString()} data point{validation.invalidPoints !== 1 ? "s" : ""} will be skipped.
                      <button onClick={() => setStep("validation")} className="text-primary ml-1 hover:underline">View details</button>
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("mapping")}>Edit Mapping</Button>
                  {validation.validPoints > 0 && (
                    <Button onClick={handleImport} className="gap-2">
                      Import {validation.validPoints.toLocaleString()} Data Points <Check className="w-4 h-4" />
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
                <p className="text-sm text-muted-foreground mt-1">
                  {importMode === "multi" ? "Normalizing multi-metric dataset and generating intelligence signals" : "Processing and generating intelligence signals"}
                </p>
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
                <p className="text-muted-foreground text-sm mb-6">
                  {importCount.toLocaleString()} data points imported
                  {importMode === "multi" ? " (multi-metric normalized)" : ""}
                  {" · "}Intelligence signals generated
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => {
                    setStep("upload"); setFile(null); setRows([]); setAllRows([]); setHeaders([]);
                    setValidation(null); setDetectedSchema([]); setIntelligence(null); setYearAutoFixed(false);
                    setDiagnostics(null); setClassification(null); setImportMode("single");
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

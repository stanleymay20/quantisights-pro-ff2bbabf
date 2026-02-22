import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, ArrowRight, Check, X, Lock } from "lucide-react";

type Step = "upload" | "preview" | "mapping" | "importing" | "done";

const METRIC_TYPES = ["revenue", "cost", "customers", "churn"] as const;
const COLUMN_TARGETS = ["date", "value", "region", "segment", "metric_type", "skip"] as const;

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
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [datasetName, setDatasetName] = useState("");
  const [defaultMetricType, setDefaultMetricType] = useState("revenue");
  const [importCount, setImportCount] = useState(0);

  const parseCSV = useCallback((text: string) => {
    const lines = text.trim().split("\n").map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
    if (lines.length < 2) return;
    setHeaders(lines[0]);
    setRows(lines.slice(1, 101)); // preview first 100
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
    setFile(f);
    setDatasetName(f.name.replace(/\.csv$/i, ""));
    const reader = new FileReader();
    reader.onload = (ev) => {
      parseCSV(ev.target?.result as string);
      setStep("preview");
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!currentOrgId || !user || !file) return;

    // Enforce Starter plan: max 1 dataset
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
      // Upload file to storage
      const filePath = `${currentOrgId}/${Date.now()}_${file.name}`;
      await supabase.storage.from("datasets").upload(filePath, file);

      // Create dataset record
      const { data: dataset, error: dsError } = await supabase
        .from("datasets")
        .insert({
          organization_id: currentOrgId,
          name: datasetName,
          file_path: filePath,
          uploaded_by: user.id,
          row_count: rows.length,
          column_mapping: mapping,
          status: "processing",
        })
        .select()
        .single();

      if (dsError) throw dsError;

      // Parse and insert metrics
      const dateCol = Object.entries(mapping).find(([, v]) => v === "date")?.[0];
      const valueCol = Object.entries(mapping).find(([, v]) => v === "value")?.[0];
      const regionCol = Object.entries(mapping).find(([, v]) => v === "region")?.[0];
      const segmentCol = Object.entries(mapping).find(([, v]) => v === "segment")?.[0];
      const metricTypeCol = Object.entries(mapping).find(([, v]) => v === "metric_type")?.[0];

      if (!dateCol || !valueCol) {
        toast({ title: "Date and Value columns required", variant: "destructive" });
        setStep("mapping");
        return;
      }

      const dateIdx = headers.indexOf(dateCol);
      const valueIdx = headers.indexOf(valueCol);
      const regionIdx = regionCol ? headers.indexOf(regionCol) : -1;
      const segmentIdx = segmentCol ? headers.indexOf(segmentCol) : -1;
      const metricTypeIdx = metricTypeCol ? headers.indexOf(metricTypeCol) : -1;

      // Re-read full file for import
      const fullText = await file.text();
      const allLines = fullText.trim().split("\n").slice(1);
      const metricsToInsert = allLines
        .map((line) => {
          const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
          const val = parseFloat(cols[valueIdx]);
          if (isNaN(val)) return null;
          return {
            organization_id: currentOrgId,
            dataset_id: dataset.id,
            metric_type: metricTypeIdx >= 0 ? cols[metricTypeIdx] : defaultMetricType,
            value: val,
            date: cols[dateIdx],
            region: regionIdx >= 0 ? cols[regionIdx] || null : null,
            segment: segmentIdx >= 0 ? cols[segmentIdx] || null : null,
          };
        })
        .filter(Boolean);

      // Insert in batches of 500
      let inserted = 0;
      for (let i = 0; i < metricsToInsert.length; i += 500) {
        const batch = metricsToInsert.slice(i, i + 500);
        const { error } = await supabase.from("metrics").insert(batch as any);
        if (error) throw error;
        inserted += batch.length;
      }

      // Update dataset status
      await supabase.from("datasets").update({ status: "completed", row_count: inserted }).eq("id", dataset.id);

      // Trigger AI insights generation
      await supabase.functions.invoke("generate-insights", {
        body: { organization_id: currentOrgId },
      }).catch(() => {}); // non-blocking

      setImportCount(inserted);
      setStep("done");
      toast({ title: `Imported ${inserted} records successfully!` });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
      setStep("mapping");
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b border-border flex items-center px-8 shrink-0">
          <h1 className="text-xl font-semibold font-display">Data Upload</h1>
        </header>
        <main className="flex-1 p-8 overflow-auto">
          {step === "upload" && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="glass-card p-12 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary/40 transition-colors cursor-pointer min-h-[400px]"
              onClick={() => document.getElementById("csv-input")?.click()}
            >
              <Upload className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold font-display mb-2">Upload CSV File</h2>
              <p className="text-muted-foreground text-sm mb-4">Drag & drop or click to browse</p>
              <p className="text-xs text-muted-foreground">Supports: CSV files with date and value columns</p>
              <input id="csv-input" type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-6">
              <div className="glass-card p-6 rounded-xl">
                <div className="flex items-center gap-3 mb-4">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold font-display">{file?.name}</h2>
                  <span className="text-xs text-muted-foreground">{rows.length} rows preview</span>
                </div>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
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
              </div>
              <button
                onClick={() => setStep("mapping")}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all"
              >
                Continue to Column Mapping <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === "mapping" && (
            <div className="space-y-6">
              <div className="glass-card p-6 rounded-xl">
                <h2 className="text-lg font-semibold font-display mb-1">Map Columns</h2>
                <p className="text-xs text-muted-foreground mb-6">Map your CSV columns to system fields</p>
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
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <label className="block text-sm font-medium mb-1.5">Dataset Name</label>
                  <input
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    className="w-full max-w-md px-4 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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
              </div>
              <button
                onClick={handleImport}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all"
              >
                Import Data <Check className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === "importing" && (
            <div className="glass-card p-12 rounded-xl flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-lg font-semibold font-display">Importing data...</p>
              <p className="text-sm text-muted-foreground mt-1">Processing your CSV file</p>
            </div>
          )}

          {step === "done" && (
            <div className="glass-card p-12 rounded-xl flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-xl font-semibold font-display mb-2">Import Complete!</h2>
              <p className="text-muted-foreground text-sm mb-6">{importCount} records imported successfully</p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep("upload"); setFile(null); setRows([]); setHeaders([]); }}
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

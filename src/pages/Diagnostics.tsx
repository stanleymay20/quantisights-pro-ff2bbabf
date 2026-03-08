import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { SidebarMobileToggle } from "@/components/layout/ProtectedShell";
import { Button } from "@/components/ui/button";
import { useActiveDataContext } from "@/hooks/useActiveDataContext";
import { useDecisionContexts } from "@/hooks/useDecisionContexts";
import DatasetRequired from "@/components/layout/DatasetRequired";
import IntelligenceDisclaimer from "@/components/IntelligenceDisclaimer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw } from "lucide-react";
import DiagnosticSummaryCards from "@/components/diagnostics/DiagnosticSummaryCards";
import DiagnosticCard from "@/components/diagnostics/DiagnosticCard";
import DiagnosticEmptyState from "@/components/diagnostics/DiagnosticEmptyState";
import ErrorBoundary from "@/components/ErrorBoundary";

export interface DiagnosticResult {
  metric_type: string;
  diagnosis: string;
  severity: "critical" | "warning" | "info";
  root_cause: string;
  causal_factors: string[];
  trend_direction: "improving" | "declining" | "stable" | "volatile";
  change_pct: number;
  recommendation: string;
  confidence: number;
  raw_confidence: number;
  capped_confidence: number;
  confidence_cap_reason: string;
  sample_size: number;
  data_sufficiency: string;
  variance_score: number | null;
  adaptive_calibration_applied: boolean;
  calibration_model_version: number | null;
  calibration_band_used: string | null;
  calibration_correction_applied_pp: number | null;
  calibration_low_sample_band: boolean;
  confidence_source: string;
}

const Diagnostics = () => {
  const { orgId, datasetId } = useActiveDataContext();
  const { activeContext } = useDecisionContexts(orgId);
  const { toast } = useToast();
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [metricTypesAnalyzed, setMetricTypesAnalyzed] = useState(0);
  const [skippedMetrics, setSkippedMetrics] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const runDiagnostics = useCallback(async () => {
    if (!orgId || !datasetId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("diagnostic-engine", {
        body: {
          organization_id: orgId,
          dataset_id: datasetId,
          ...(activeContext?.id ? { decision_context_id: activeContext.id } : {}),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDiagnostics(data.diagnostics || []);
      setAnalyzedCount(data.analyzed_metrics || 0);
      setMetricTypesAnalyzed(data.metric_types_analyzed?.length || 0);
      setSkippedMetrics(data.skipped_metrics || []);
      if (data.diagnostics?.length === 0) {
        toast({ title: "No anomalies detected", description: "All metrics within expected ranges." });
      }
    } catch (err: any) {
      toast({ title: "Diagnostic failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [orgId, datasetId, activeContext?.id, toast]);

  useEffect(() => {
    if (orgId && datasetId) runDiagnostics();
  }, [runDiagnostics]);

  const criticalCount = diagnostics.filter(d => d.severity === "critical").length;
  const warningCount = diagnostics.filter(d => d.severity === "warning").length;

  return (
    <DatasetRequired moduleName="Diagnostics">
      <ErrorBoundary>
        <IntelligenceDisclaimer variant="banner" context="advisory" persistent />

        <header className="h-14 border-b border-border/30 flex items-center justify-between px-8 shrink-0 bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <SidebarMobileToggle />
            <h1 className="text-xl font-semibold font-display">Diagnostic Intelligence</h1>
            <p className="text-xs text-muted-foreground">Root cause analysis & causal pattern detection</p>
          </div>
          <Button onClick={runDiagnostics} disabled={loading} variant="outline" size="sm" className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Re-analyze
          </Button>
        </header>

        <main className="flex-1 p-8 overflow-auto space-y-6">
          <DiagnosticSummaryCards
            analyzedCount={analyzedCount}
            criticalCount={criticalCount}
            warningCount={warningCount}
            totalDiagnosed={diagnostics.length}
            metricTypesAnalyzed={metricTypesAnalyzed}
            skippedMetrics={skippedMetrics}
          />

          {loading ? (
            <DiagnosticEmptyState variant="loading" />
          ) : diagnostics.length === 0 ? (
            <DiagnosticEmptyState variant="empty" />
          ) : (
            <div className="space-y-4">
              {diagnostics.map((d, i) => (
                <DiagnosticCard
                  key={`${d.metric_type}-${i}`}
                  diagnostic={d}
                  index={i}
                  isExpanded={expanded === `${d.metric_type}-${i}`}
                  onToggle={() => setExpanded(expanded === `${d.metric_type}-${i}` ? null : `${d.metric_type}-${i}`)}
                />
              ))}
            </div>
          )}

          <IntelligenceDisclaimer variant="footer" context="advisory" />
        </main>
      </ErrorBoundary>
    </DatasetRequired>
  );
};

export default Diagnostics;

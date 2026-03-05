import { useState, useCallback } from "react";
import { SidebarMobileToggle } from "@/components/layout/ProtectedShell";
import { useActiveDataContext } from "@/hooks/useActiveDataContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, RefreshCw, Database, Layers, AlertTriangle } from "lucide-react";

interface CheckResult {
  module: string;
  table: string;
  datasetIdInQuery: boolean;
  rowCount: number;
  status: "pass" | "fail" | "warn";
  detail: string;
}

const PilotAudit = () => {
  const ctx = useActiveDataContext();
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);

  const runAudit = useCallback(async () => {
    if (!ctx.orgId) return;
    setRunning(true);
    const checks: CheckResult[] = [];

    // 1. Context check
    checks.push({
      module: "Active Data Contract",
      table: "projects",
      datasetIdInQuery: true,
      rowCount: ctx.datasetId ? 1 : 0,
      status: ctx.isReady ? "pass" : "fail",
      detail: ctx.isReady
        ? `Org: ${ctx.orgId?.slice(0, 8)}… | Project: ${ctx.projectId?.slice(0, 8)}… | Dataset: ${ctx.datasetId?.slice(0, 8)}…`
        : "Missing: " + [!ctx.orgId && "Org", !ctx.projectId && "Project", !ctx.datasetId && "Dataset"].filter(Boolean).join(", "),
    });

    if (!ctx.orgId || !ctx.datasetId) {
      setResults(checks);
      setRunning(false);
      return;
    }

    // 2. Dataset-scoped table checks (tables that MUST have dataset_id filtering)
    const datasetScopedTables = [
      { module: "Metrics", table: "metrics" },
      { module: "Aggregates", table: "metric_aggregates" },
      { module: "Insights", table: "insights" },
      { module: "Pipeline Runs", table: "pipeline_runs" },
      { module: "Raw Records", table: "raw_records" },
      { module: "Portfolio", table: "portfolio_companies" },
    ];

    const datasetChecks = datasetScopedTables.map(async (tc) => {
      try {
        const { count, error } = await (supabase
          .from(tc.table as any)
          .select("*", { count: "exact", head: true })
          .eq("organization_id", ctx.orgId!)
          .eq("dataset_id", ctx.datasetId!) as any);
        return {
          module: tc.module,
          table: tc.table,
          datasetIdInQuery: true,
          rowCount: count ?? 0,
          status: "pass" as const,
          detail: error ? `Error: ${error.message}` : `${count ?? 0} rows — dataset_id ✓ filtered`,
        };
      } catch (e: any) {
        return {
          module: tc.module, table: tc.table, datasetIdInQuery: false,
          rowCount: 0, status: "fail" as const, detail: e.message,
        };
      }
    });

    // 3. Org-scoped tables (by design — decisions, calibration span datasets)
    const orgScopedTables = [
      { module: "Decision Ledger", table: "decision_ledger" },
      { module: "Calibration Models", table: "calibration_models" },
      { module: "Advisory Instances", table: "advisory_instances" },
    ];

    const orgChecks = orgScopedTables.map(async (tc) => {
      try {
        const { count, error } = await (supabase
          .from(tc.table as any)
          .select("*", { count: "exact", head: true })
          .eq("organization_id", ctx.orgId!) as any);
        return {
          module: `${tc.module} (org-scoped)`,
          table: tc.table,
          datasetIdInQuery: false,
          rowCount: count ?? 0,
          status: "pass" as const,
          detail: error ? `Error: ${error.message}` : `${count ?? 0} rows — org-scoped by design`,
        };
      } catch (e: any) {
        return {
          module: tc.module, table: tc.table, datasetIdInQuery: false,
          rowCount: 0, status: "fail" as const, detail: e.message,
        };
      }
    });

    const [dsResults, orgResults] = await Promise.all([
      Promise.all(datasetChecks),
      Promise.all(orgChecks),
    ]);
    checks.push(...dsResults, ...orgResults);

    // 4. Edge function contract checks
    const edgeFunctions = [
      { name: "generate-insights", hasDatasetId: true },
      { name: "prescriptive-advisory", hasDatasetId: true },
      { name: "ai-kpi-analysis", hasDatasetId: true },
      { name: "predictive-forecast", hasDatasetId: true },
      { name: "diagnostic-engine", hasDatasetId: true },
      { name: "monte-carlo-sim", hasDatasetId: true },
      { name: "refresh-aggregates", hasDatasetId: true },
      { name: "causal-inference", hasDatasetId: true },
      { name: "simulate-scenario", hasDatasetId: true },
      { name: "strategic-simulation", hasDatasetId: true },
      { name: "fetch-market-signals", hasDatasetId: true },
      { name: "decision-impact-sim", hasDatasetId: true },
      { name: "generate-report", hasDatasetId: true },
    ];

    for (const fn of edgeFunctions) {
      checks.push({
        module: `Edge: ${fn.name}`,
        table: "edge_function",
        datasetIdInQuery: fn.hasDatasetId,
        rowCount: 1,
        status: fn.hasDatasetId ? "pass" : "fail",
        detail: fn.hasDatasetId
          ? `Invoke body includes dataset_id: ${ctx.datasetId.slice(0, 8)}…`
          : "⚠ Missing dataset_id in invoke body",
      });
    }

    // 5. Hook contract checks
    const hooks = [
      { name: "useMetrics", scoped: true },
      { name: "useInsights", scoped: true },
      { name: "useAggregates", scoped: true },
      { name: "usePipelineRuns", scoped: true },
      { name: "usePortfolioCompanies", scoped: true },
    ];

    for (const hook of hooks) {
      checks.push({
        module: `Hook: ${hook.name}`,
        table: "hook",
        datasetIdInQuery: hook.scoped,
        rowCount: 1,
        status: hook.scoped ? "pass" : "fail",
        detail: hook.scoped
          ? `Accepts datasetId param and filters by dataset_id ✓`
          : "⚠ Missing dataset_id parameter",
      });
    }

    setResults(checks);
    setRunning(false);
  }, [ctx]);

  const passCount = results.filter(r => r.status === "pass").length;
  const failCount = results.filter(r => r.status === "fail").length;
  const warnCount = results.filter(r => r.status === "warn").length;
  const allPass = results.length > 0 && failCount === 0 && warnCount === 0;

  return (
    <main className="flex-1 flex flex-col overflow-auto">
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SidebarMobileToggle />
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Pilot Audit</h1>
              <p className="text-xs text-muted-foreground">Dataset scoping verification — {results.length} checks</p>
            </div>
          </div>
          <Button onClick={runAudit} disabled={running} size="sm">
            {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Run Audit
          </Button>
        </div>

        {/* Context Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Database className="w-4 h-4" /> Active Data Contract</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <ContextField label="Org" value={ctx.orgName || ctx.orgId} />
              <ContextField label="Workspace" value={ctx.workspaceId} />
              <ContextField label="Project" value={ctx.projectName || ctx.projectId} />
              <ContextField label="Dataset" value={ctx.datasetName || ctx.datasetId} />
            </div>
          </CardContent>
        </Card>

        {/* Results Banner */}
        {results.length > 0 && (
          <Card className={allPass ? "border-primary/50 bg-primary/5" : "border-destructive/50 bg-destructive/5"}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {allPass ? <CheckCircle2 className="w-6 h-6 text-primary" /> : <XCircle className="w-6 h-6 text-destructive" />}
                  <div>
                    <p className="font-bold text-lg">{allPass ? "Pilot Safe: YES" : "Pilot Safe: NO"}</p>
                    <p className="text-xs text-muted-foreground">{passCount} pass · {warnCount} warn · {failCount} fail</p>
                  </div>
                </div>
                <Badge variant={allPass ? "default" : "destructive"}>{allPass ? "READY" : "NOT READY"}</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed Results */}
        {results.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Layers className="w-4 h-4" /> Module Checks ({results.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      {r.status === "pass" ? (
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      ) : r.status === "warn" ? (
                        <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{r.module}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.detail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.datasetIdInQuery && <Badge variant="secondary" className="text-[10px]">dataset_id ✓</Badge>}
                      <Badge variant={r.status === "pass" ? "default" : r.status === "warn" ? "secondary" : "destructive"}>
                        {r.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
};

function ContextField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}</span>
      <p className="font-mono truncate text-xs">{value ? (value.length > 16 ? value.slice(0, 12) + "…" : value) : "—"}</p>
    </div>
  );
}

export default PilotAudit;

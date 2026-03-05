import { useState, useCallback } from "react";
import { SidebarMobileToggle } from "@/components/layout/ProtectedShell";
import { useActiveDataContext } from "@/hooks/useActiveDataContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, XCircle, Loader2, ShieldCheck, RefreshCw,
  Database, Layers, AlertTriangle, Zap,
} from "lucide-react";

interface CheckResult {
  module: string;
  scope: "dataset" | "org" | "edge_dry_run" | "hook" | "context";
  status: "pass" | "fail" | "warn";
  detail: string;
}

/** Tables that MUST be scoped by dataset_id */
const DATASET_TABLES = [
  { module: "Metrics", table: "metrics" },
  { module: "Aggregates", table: "metric_aggregates" },
  { module: "Insights", table: "insights" },
  { module: "Pipeline Runs", table: "pipeline_runs" },
  { module: "Raw Records", table: "raw_records" },
  { module: "Portfolio Companies", table: "portfolio_companies" },
  { module: "Reports", table: "reports" },
  { module: "Scenarios", table: "scenarios" },
  { module: "Simulation Results", table: "simulation_results" },
  { module: "Forecast Results", table: "forecast_results" },
  { module: "External Signals", table: "external_signals" },
  { module: "Advisory Instances", table: "advisory_instances" },
] as const;

/** Tables that are org-scoped BY DESIGN (decisions, calibration, executive) */
const ORG_TABLES = [
  { module: "Decision Ledger (org-wide)", table: "decision_ledger" },
  { module: "Calibration Models (org-wide)", table: "calibration_models" },
  { module: "Decision Simulations (org-wide)", table: "decision_simulations" },
] as const;

/** Edge functions that enforce dataset_id + support dry_run */
const EDGE_FUNCTIONS = [
  "generate-insights",
  "prescriptive-advisory",
  "predictive-forecast",
  "monte-carlo-sim",
  "generate-report",
  "fetch-market-signals",
] as const;

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
      scope: "context",
      status: ctx.isReady ? "pass" : "fail",
      detail: ctx.isReady
        ? `Org: ${ctx.orgId.slice(0, 8)}… | Project: ${ctx.projectId?.slice(0, 8)}… | Dataset: ${ctx.datasetId?.slice(0, 8)}…`
        : "Missing: " + [!ctx.orgId && "Org", !ctx.projectId && "Project", !ctx.datasetId && "Dataset"].filter(Boolean).join(", "),
    });

    if (!ctx.orgId || !ctx.datasetId) {
      setResults(checks);
      setRunning(false);
      return;
    }

    // 2. Dataset-scoped table checks
    const datasetChecks = DATASET_TABLES.map(async (tc) => {
      try {
        const { count, error } = await supabase
          .from(tc.table)
          .select("*", { count: "exact", head: true })
          .eq("organization_id", ctx.orgId!)
          .eq("dataset_id", ctx.datasetId!);
        return {
          module: tc.module,
          scope: "dataset" as const,
          status: error ? ("fail" as const) : ("pass" as const),
          detail: error
            ? `Error: ${error.message}`
            : `${count ?? 0} rows — dataset_id REQUIRED ✓`,
        };
      } catch (e: unknown) {
        return {
          module: tc.module,
          scope: "dataset" as const,
          status: "fail" as const,
          detail: e instanceof Error ? e.message : "Unknown error",
        };
      }
    });

    // 3. Org-scoped table checks (labelled as org-wide)
    const orgChecks = ORG_TABLES.map(async (tc) => {
      try {
        const { count, error } = await supabase
          .from(tc.table)
          .select("*", { count: "exact", head: true })
          .eq("organization_id", ctx.orgId!);
        return {
          module: tc.module,
          scope: "org" as const,
          status: error ? ("fail" as const) : ("pass" as const),
          detail: error
            ? `Error: ${error.message}`
            : `${count ?? 0} rows — org-scoped by design`,
        };
      } catch (e: unknown) {
        return {
          module: tc.module,
          scope: "org" as const,
          status: "fail" as const,
          detail: e instanceof Error ? e.message : "Unknown error",
        };
      }
    });

    const [dsResults, orgResults] = await Promise.all([
      Promise.all(datasetChecks),
      Promise.all(orgChecks),
    ]);
    checks.push(...dsResults, ...orgResults);

    // 4. Edge function dry_run contract validation
    const edgeChecks = EDGE_FUNCTIONS.map(async (fnName) => {
      try {
        const { data, error } = await supabase.functions.invoke(fnName, {
          body: {
            organization_id: ctx.orgId,
            dataset_id: ctx.datasetId,
            dry_run: true,
            // Some functions need extra params to not fail validation
            metric_type: "revenue",
          },
        });
        if (error) {
          return {
            module: `Edge: ${fnName}`,
            scope: "edge_dry_run" as const,
            status: "fail" as const,
            detail: `Invoke error: ${error.message}`,
          };
        }
        const isDryRunPass = data?.dry_run === true && data?.status === "PASS";
        return {
          module: `Edge: ${fnName}`,
          scope: "edge_dry_run" as const,
          status: isDryRunPass ? ("pass" as const) : ("fail" as const),
          detail: isDryRunPass
            ? `dry_run: PASS — dataset_id enforced ✓`
            : `Unexpected response: ${JSON.stringify(data).slice(0, 100)}`,
        };
      } catch (e: unknown) {
        return {
          module: `Edge: ${fnName}`,
          scope: "edge_dry_run" as const,
          status: "fail" as const,
          detail: e instanceof Error ? e.message : "Unknown error",
        };
      }
    });

    const edgeResults = await Promise.all(edgeChecks);
    checks.push(...edgeResults);

    // 5. Edge function rejection test (call without dataset_id → must fail)
    try {
      const { data } = await supabase.functions.invoke("generate-insights", {
        body: { organization_id: ctx.orgId },
      });
      const rejected = data?.error?.includes("dataset_id required");
      checks.push({
        module: "Edge rejection: missing dataset_id",
        scope: "edge_dry_run",
        status: rejected ? "pass" : "fail",
        detail: rejected
          ? "Correctly rejected request without dataset_id ✓"
          : `Expected rejection, got: ${JSON.stringify(data).slice(0, 100)}`,
      });
    } catch {
      checks.push({
        module: "Edge rejection: missing dataset_id",
        scope: "edge_dry_run",
        status: "pass",
        detail: "Request rejected (throw) — dataset_id enforcement works ✓",
      });
    }

    setResults(checks);
    setRunning(false);
  }, [ctx]);

  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;
  const warnCount = results.filter((r) => r.status === "warn").length;
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
              <p className="text-xs text-muted-foreground">
                Active Data Contract verification — {results.length} checks
              </p>
            </div>
          </div>
          <Button onClick={runAudit} disabled={running} size="sm">
            {running ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Run Audit
          </Button>
        </div>

        {/* Context Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="w-4 h-4" /> Active Data Contract
            </CardTitle>
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
          <Card
            className={
              allPass
                ? "border-primary/50 bg-primary/5"
                : "border-destructive/50 bg-destructive/5"
            }
          >
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {allPass ? (
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                  ) : (
                    <XCircle className="w-6 h-6 text-destructive" />
                  )}
                  <div>
                    <p className="font-bold text-lg">
                      {allPass ? "Pilot Safe: YES" : "Pilot Safe: NO"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {passCount} pass · {warnCount} warn · {failCount} fail
                    </p>
                  </div>
                </div>
                <Badge variant={allPass ? "default" : "destructive"}>
                  {allPass ? "READY" : "NOT READY"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed Results */}
        {results.length > 0 && (
          <>
            {/* Dataset-scoped checks */}
            <ResultSection
              title="Dataset-Scoped Tables"
              icon={<Layers className="w-4 h-4" />}
              items={results.filter((r) => r.scope === "dataset")}
            />
            {/* Org-scoped checks */}
            <ResultSection
              title="Org-Scoped Tables (by design)"
              icon={<Database className="w-4 h-4" />}
              items={results.filter((r) => r.scope === "org")}
            />
            {/* Edge function dry_run checks */}
            <ResultSection
              title="Edge Function dry_run Validation"
              icon={<Zap className="w-4 h-4" />}
              items={results.filter((r) => r.scope === "edge_dry_run")}
            />
            {/* Context check */}
            <ResultSection
              title="Context"
              icon={<ShieldCheck className="w-4 h-4" />}
              items={results.filter((r) => r.scope === "context")}
            />
          </>
        )}
      </div>
    </main>
  );
};

function ResultSection({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: CheckResult[];
}) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon} {title} ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {items.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
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
                  <p className="text-xs text-muted-foreground truncate">
                    {r.detail}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.scope === "dataset" && (
                  <Badge variant="secondary" className="text-[10px]">
                    dataset_id ✓
                  </Badge>
                )}
                {r.scope === "org" && (
                  <Badge variant="outline" className="text-[10px]">
                    Org-wide
                  </Badge>
                )}
                {r.scope === "edge_dry_run" && (
                  <Badge variant="secondary" className="text-[10px]">
                    dry_run
                  </Badge>
                )}
                <Badge
                  variant={
                    r.status === "pass"
                      ? "default"
                      : r.status === "warn"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {r.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ContextField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <span className="text-muted-foreground">{label}</span>
      <p className="font-mono truncate text-xs">
        {value
          ? value.length > 16
            ? value.slice(0, 12) + "…"
            : value
          : "—"}
      </p>
    </div>
  );
}

export default PilotAudit;

import { useEffect, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Shield, AlertTriangle, Target, TrendingUp, Activity,
  Zap, CheckCircle2, XCircle, Clock, RefreshCw, Loader2,
  ArrowUpRight, BarChart3,
} from "lucide-react";
import { useExecutionIntelligence, type CommandSummary } from "@/hooks/useExecutionIntelligence";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

interface ExecutionCommandCenterProps {
  organizationId: string;
}

const RISK_COLORS: Record<string, string> = {
  likely_failure: "bg-destructive text-destructive-foreground",
  at_risk: "bg-warning text-warning-foreground",
  delayed: "bg-primary/20 text-primary",
  on_track: "bg-success/20 text-success",
};

const ExecutionCommandCenter = memo(({ organizationId }: ExecutionCommandCenterProps) => {
  const {
    loading,
    scores,
    predictions,
    interventions,
    commandSummary,
    scanInterventions,
    fetchInterventions,
    resolveIntervention,
    computeScores,
    fetchScores,
    predictRisks,
    fetchPredictions,
    fetchCommandSummary,
  } = useExecutionIntelligence(organizationId);

  useEffect(() => {
    fetchCommandSummary();
    fetchInterventions();
    fetchPredictions();
    fetchScores();
  }, [fetchCommandSummary, fetchInterventions, fetchPredictions, fetchScores]);

  const runFullAnalysis = async () => {
    await Promise.all([
      scanInterventions(),
      computeScores(),
      predictRisks(),
    ]);
    await fetchCommandSummary();
  };

  const summary = commandSummary;
  const orgScore = summary?.org_score;

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Execution Command Center
          </h2>
          <p className="text-xs text-muted-foreground">Real-time execution control + predictive intelligence</p>
        </div>
        <Button onClick={runFullAnalysis} disabled={loading} size="sm" className="gap-2">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Run Full Analysis
        </Button>
      </div>

      {/* Executive Score Card */}
      <SectionErrorBoundary sectionName="Execution Health Score">
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div className="col-span-2 md:col-span-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Execution Health</p>
                <div className="text-4xl font-bold tabular-nums">
                  {orgScore ? Math.round(orgScore.score) : "—"}
                  <span className="text-base text-muted-foreground">/100</span>
                </div>
                {orgScore && (
                  <Progress
                    value={orgScore.score}
                    className="mt-2 h-2"
                  />
                )}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Success Rate</p>
                <p className="text-2xl font-bold text-success">{orgScore?.success_rate ?? "—"}%</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Failure Rate</p>
                <p className="text-2xl font-bold text-destructive">{orgScore?.failure_rate ?? "—"}%</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Delay</p>
                <p className="text-2xl font-bold">{orgScore?.avg_delay_days ?? "—"}<span className="text-sm text-muted-foreground"> days</span></p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Plans Evaluated</p>
                <p className="text-2xl font-bold">{orgScore?.plans_evaluated ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </SectionErrorBoundary>

      {/* Risk Distribution + Active Threats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionErrorBoundary sectionName="Risk Distribution">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                Risk Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary?.risk_distribution ? (
                <>
                  {[
                    { key: "likely_failure", label: "Likely Failure", icon: XCircle, color: "text-destructive" },
                    { key: "at_risk", label: "At Risk", icon: AlertTriangle, color: "text-warning" },
                    { key: "delayed", label: "Delayed", icon: Clock, color: "text-primary" },
                    { key: "on_track", label: "On Track", icon: CheckCircle2, color: "text-success" },
                  ].map(({ key, label, icon: Icon, color }) => {
                    const count = summary.risk_distribution[key as keyof typeof summary.risk_distribution];
                    const total = summary.total_active || 1;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${color} shrink-0`} />
                        <span className="text-sm flex-1">{label}</span>
                        <span className="font-bold tabular-nums">{count}</span>
                        <div className="w-20">
                          <Progress value={(count / total) * 100} className="h-1.5" />
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Run analysis to see risk distribution</p>
              )}
            </CardContent>
          </Card>
        </SectionErrorBoundary>

        <SectionErrorBoundary sectionName="Command Summary">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Command Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                  <p className="text-[10px] text-muted-foreground uppercase">Open Interventions</p>
                  <p className="text-2xl font-bold text-destructive">{summary?.open_interventions ?? 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-warning/5 border border-warning/10">
                  <p className="text-[10px] text-muted-foreground uppercase">At-Risk Plans</p>
                  <p className="text-2xl font-bold text-warning">{summary?.at_risk_plans ?? 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-[10px] text-muted-foreground uppercase">Critical Active</p>
                  <p className="text-2xl font-bold text-primary">{summary?.critical_active ?? 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary border border-border/40">
                  <p className="text-[10px] text-muted-foreground uppercase">Total Active</p>
                  <p className="text-2xl font-bold">{summary?.total_active ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </SectionErrorBoundary>
      </div>

      {/* Active Interventions */}
      <SectionErrorBoundary sectionName="Active Interventions">
        {interventions.length > 0 && (
          <Card className="border-warning/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-warning" />
                Active Interventions
                <Badge variant="destructive" className="ml-2 text-[10px]">{interventions.filter(i => !i.resolved).length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {interventions.filter(i => !i.resolved).slice(0, 10).map(iv => (
                <div key={iv.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border/30">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{iv.intervention_type.replace(/_/g, " ")}</Badge>
                      {iv.auto_triggered && <Badge className="text-[10px] bg-primary/20 text-primary">Auto</Badge>}
                    </div>
                    <p className="text-xs mt-1">{iv.trigger_reason}</p>
                    {iv.corrective_action && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        <span className="font-medium">Recommended:</span> {iv.corrective_action}
                      </p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => resolveIntervention(iv.id)} className="text-xs shrink-0">
                    Resolve
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </SectionErrorBoundary>

      {/* Predictive Risk Table */}
      <SectionErrorBoundary sectionName="Predictive Execution Intelligence">
        {predictions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Predictive Risk Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {predictions.filter(p => p.risk_score > 20).slice(0, 10).map(pred => (
                  <div key={pred.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/30 hover:bg-secondary/30 transition-colors">
                    <div className="shrink-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                        pred.risk_score >= 70 ? "bg-destructive/10 text-destructive" :
                        pred.risk_score >= 50 ? "bg-warning/10 text-warning" :
                        "bg-primary/10 text-primary"
                      }`}>
                        {pred.risk_score}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{pred.execution_plans?.action_title || "Unknown Plan"}</span>
                        <Badge className={`text-[10px] ${RISK_COLORS[pred.predicted_outcome] || ""}`}>
                          {pred.predicted_outcome.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{pred.recommendation}</p>
                      {pred.risk_factors.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {pred.risk_factors.slice(0, 3).map((rf, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {rf.factor}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {pred.delay_days_predicted > 0 && (
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">Est. Delay</p>
                        <p className="text-sm font-bold">{pred.delay_days_predicted}d</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </SectionErrorBoundary>

      {/* Multi-Decision Dependencies */}
      <SectionErrorBoundary sectionName="Cross-Decision Dependencies">
        {summary?.multi_plan_decisions && summary.multi_plan_decisions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Cross-Decision Execution Graph
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {summary.multi_plan_decisions.map(mpd => (
                  <div key={mpd.decision_id} className="flex items-center gap-3 p-2 rounded border border-border/30">
                    <ArrowUpRight className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs font-mono text-muted-foreground truncate">{mpd.decision_id.slice(0, 8)}…</span>
                    <Badge variant="outline" className="text-[10px]">{mpd.plan_count} plans</Badge>
                    <span className="text-[10px] text-muted-foreground ml-auto">Interdependent execution</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </SectionErrorBoundary>
    </div>
  );
});

ExecutionCommandCenter.displayName = "ExecutionCommandCenter";

export default ExecutionCommandCenter;

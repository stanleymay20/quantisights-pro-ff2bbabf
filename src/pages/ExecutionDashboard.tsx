import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SidebarMobileToggle } from "@/components/layout/ProtectedShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRight, CheckCircle2, XCircle, Clock, Play,
  TrendingUp, TrendingDown, RotateCcw, Loader2, Activity,
  Target, BarChart3, Zap,
} from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { useDecisionReplay } from "@/hooks/useDecisionReplay";
import { supabase } from "@/integrations/supabase/client";
import DatasetRequired from "@/components/layout/DatasetRequired";
import IntelligenceDisclaimer from "@/components/IntelligenceDisclaimer";

interface ExecutionSummary {
  total_plans: number;
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
  completion_rate: number;
  overdue: number;
}

interface DecisionWithPlans {
  id: string;
  recommended_action: string;
  decision_status: string;
  execution_status: string;
  confidence_at_decision: number | null;
  capped_confidence: number | null;
  prediction_accuracy_score: number | null;
  created_at: string;
  plan_count: number;
  completed_plans: number;
}

const ExecutionDashboard = () => {
  const { currentOrgId } = useOrganization();
  const { driftReport, fetchDriftReport } = useDecisionReplay(currentOrgId);
  const [summary, setSummary] = useState<ExecutionSummary | null>(null);
  const [decisions, setDecisions] = useState<DecisionWithPlans[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrgId) return;

    const fetchData = async () => {
      setLoading(true);

      // Fetch ALL execution plans for this org in a single query (avoids N+1)
      const { data: plans } = await supabase
        .from("execution_plans")
        .select("status, deadline, decision_id")
        .eq("organization_id", currentOrgId);

      if (plans) {
        const now = new Date();
        const pending = plans.filter((p: any) => p.status === "pending").length;
        const inProgress = plans.filter((p: any) => p.status === "in_progress").length;
        const completed = plans.filter((p: any) => p.status === "completed").length;
        const failed = plans.filter((p: any) => p.status === "failed").length;
        const overdue = plans.filter((p: any) =>
          p.deadline && new Date(p.deadline) < now && p.status !== "completed" && p.status !== "cancelled"
        ).length;

        setSummary({
          total_plans: plans.length,
          pending,
          in_progress: inProgress,
          completed,
          failed,
          completion_rate: plans.length > 0 ? completed / plans.length : 0,
          overdue,
        });
      }

      // Fetch decisions
      const { data: ledger } = await supabase
        .from("decision_ledger")
        .select("id, recommended_action, decision_status, execution_status, confidence_at_decision, capped_confidence, prediction_accuracy_score, created_at")
        .eq("organization_id", currentOrgId)
        .in("decision_status", ["approved", "pending"])
        .order("created_at", { ascending: false })
        .limit(20);

      if (ledger && plans) {
        // Build plan counts from the already-fetched plans (batch approach)
        const plansByDecision = new Map<string, { total: number; completed: number }>();
        for (const p of plans) {
          const entry = plansByDecision.get(p.decision_id) || { total: 0, completed: 0 };
          entry.total++;
          if (p.status === "completed") entry.completed++;
          plansByDecision.set(p.decision_id, entry);
        }

        const withPlans = ledger.map((d: any) => {
          const counts = plansByDecision.get(d.id) || { total: 0, completed: 0 };
          return {
            ...d,
            plan_count: counts.total,
            completed_plans: counts.completed,
          };
        });
        setDecisions(withPlans);
      }

      fetchDriftReport();
      setLoading(false);
    };

    fetchData();
  }, [currentOrgId, fetchDriftReport]);

  const STATUS_ICON: Record<string, React.ElementType> = {
    not_started: Clock,
    in_progress: Play,
    completed: CheckCircle2,
    blocked: XCircle,
  };

  return (
    <DatasetRequired moduleName="Execution Dashboard">
      <>
        <header className="h-14 border-b border-border/30 flex items-center px-8 shrink-0 bg-background/60 backdrop-blur-sm">
          <SidebarMobileToggle />
          <h1 className="text-xl font-semibold font-display ml-3">Execution Dashboard</h1>
          <p className="text-xs text-muted-foreground ml-3">Decision → Action → Outcome</p>
        </header>

        <IntelligenceDisclaimer variant="banner" context="advisory" />

        <main className="flex-1 p-8 overflow-auto space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Actions</p>
                    <p className="text-2xl font-bold mt-1">{summary?.total_plans || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</p>
                    <p className="text-2xl font-bold mt-1">{summary?.pending || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Play className="w-3 h-3" /> Active</p>
                    <p className="text-2xl font-bold mt-1 text-primary">{summary?.in_progress || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Done</p>
                    <p className="text-2xl font-bold mt-1 text-success">{summary?.completed || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><XCircle className="w-3 h-3" /> Failed</p>
                    <p className="text-2xl font-bold mt-1 text-destructive">{summary?.failed || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Target className="w-3 h-3" /> Completion</p>
                    <p className="text-2xl font-bold mt-1">{summary ? `${Math.round(summary.completion_rate * 100)}%` : "—"}</p>
                  </CardContent>
                </Card>
                <Card className={summary?.overdue ? "border-destructive/30" : ""}>
                  <CardContent className="p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overdue</p>
                    <p className={`text-2xl font-bold mt-1 ${summary?.overdue ? "text-destructive" : ""}`}>{summary?.overdue || 0}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Decision Replay Drift Report */}
              {driftReport && driftReport.total_replays > 0 && (
                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-primary" />
                      Organizational Decision Drift
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Replays Run</p>
                        <p className="text-lg font-bold">{driftReport.total_replays}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Avg Confidence Drift</p>
                        <p className={`text-lg font-bold ${Math.abs(driftReport.avg_confidence_drift) > 10 ? "text-warning" : "text-success"}`}>
                          {driftReport.avg_confidence_drift > 0 ? "+" : ""}{driftReport.avg_confidence_drift.toFixed(1)}pp
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Recommendations Changed</p>
                        <p className={`text-lg font-bold ${driftReport.recommendations_changed > 0 ? "text-warning" : "text-success"}`}>
                          {driftReport.recommendations_changed}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Stability Rate</p>
                        <p className="text-lg font-bold">{Math.round((1 - driftReport.change_rate) * 100)}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Active Decisions with Execution */}
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Active Decisions
                </h2>
                {decisions.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground text-sm">
                      No active decisions. Log decisions from the Decision Ledger to start executing.
                    </CardContent>
                  </Card>
                )}
                {decisions.map(d => {
                  const ExecIcon = STATUS_ICON[d.execution_status] || Clock;
                  const progress = d.plan_count > 0 ? (d.completed_plans / d.plan_count) * 100 : 0;
                  const conf = d.confidence_at_decision || d.capped_confidence;

                  return (
                    <motion.div
                      key={d.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <Card className="hover:border-primary/20 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <ExecIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span className="font-medium text-sm truncate">{d.recommended_action}</span>
                                <Badge variant="outline" className="text-[10px]">{d.decision_status}</Badge>
                              </div>
                              <div className="flex items-center gap-4 mt-2">
                                {conf !== null && (
                                  <span className="text-[11px] text-muted-foreground">
                                    Confidence: <span className="font-medium text-foreground">{conf.toFixed(0)}%</span>
                                  </span>
                                )}
                                {d.prediction_accuracy_score !== null && (
                                  <span className="text-[11px] text-muted-foreground">
                                    Accuracy: <span className={`font-medium ${d.prediction_accuracy_score > 60 ? "text-success" : "text-warning"}`}>
                                      {d.prediction_accuracy_score.toFixed(0)}/100
                                    </span>
                                  </span>
                                )}
                                <span className="text-[11px] text-muted-foreground">
                                  Actions: {d.completed_plans}/{d.plan_count}
                                </span>
                              </div>
                              {d.plan_count > 0 && (
                                <Progress value={progress} className="mt-2 h-1.5" />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </>
    </DatasetRequired>
  );
};

export default ExecutionDashboard;

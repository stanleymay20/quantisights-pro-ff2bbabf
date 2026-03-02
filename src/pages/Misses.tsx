import { useState, useEffect, useMemo } from "react";
import DashboardSidebar, { SidebarMobileToggle } from "@/components/dashboard/DashboardSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle, TrendingDown, Target, BarChart3, XCircle, CheckCircle2, Activity,
} from "lucide-react";

interface Decision {
  id: string;
  recommended_action: string;
  decision_type: string;
  confidence_at_decision: number | null;
  capped_confidence: number | null;
  calibration_error: number | null;
  prediction_accuracy_score: number | null;
  outcome_delta: number | null;
  actual_value: number | null;
  baseline_value: number | null;
  execution_status: string;
  decided_at: string | null;
  outcome_measured_at: string | null;
  created_at: string;
}

const MissesPage = () => {
  const { currentOrgId } = useOrganization();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrgId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("decision_ledger")
        .select("id, recommended_action, decision_type, confidence_at_decision, capped_confidence, calibration_error, prediction_accuracy_score, outcome_delta, actual_value, baseline_value, execution_status, decided_at, outcome_measured_at, created_at")
        .eq("organization_id", currentOrgId)
        .eq("execution_status", "completed")
        .order("created_at", { ascending: false })
        .limit(200);
      if (data) setDecisions(data as Decision[]);
      setLoading(false);
    })();
  }, [currentOrgId]);

  const { misses, hits, missRate, avgMissCalError, avgHitCalError, worstMiss } = useMemo(() => {
    const measured = decisions.filter(d => d.outcome_delta !== null);
    const misses = measured.filter(d => (d.outcome_delta || 0) < 0);
    const hits = measured.filter(d => (d.outcome_delta || 0) >= 0);
    const missRate = measured.length > 0 ? (misses.length / measured.length * 100) : 0;
    
    const avgMissCalError = misses.length > 0
      ? misses.reduce((s, d) => s + (d.calibration_error || 0), 0) / misses.length
      : 0;
    const avgHitCalError = hits.length > 0
      ? hits.reduce((s, d) => s + (d.calibration_error || 0), 0) / hits.length
      : 0;
    
    const worstMiss = misses.length > 0
      ? misses.reduce((worst, d) => (d.outcome_delta || 0) < (worst.outcome_delta || 0) ? d : worst, misses[0])
      : null;

    return { misses, hits, missRate, avgMissCalError, avgHitCalError, worstMiss };
  }, [decisions]);

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-14 border-b border-border/30 flex items-center px-8 shrink-0 bg-background/60 backdrop-blur-sm">
          <SidebarMobileToggle />
          <div className="ml-3">
            <h1 className="text-xl font-semibold font-display">Prediction Misses</h1>
            <p className="text-xs text-muted-foreground">Where the AI was wrong — transparency builds trust</p>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-auto space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Total Measured</p>
                <p className="text-2xl font-bold mt-1">{misses.length + hits.length}</p>
              </CardContent>
            </Card>
            <Card className="border-destructive/20">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><XCircle className="w-3 h-3" /> Misses</p>
                <p className="text-2xl font-bold mt-1 text-destructive">{misses.length}</p>
              </CardContent>
            </Card>
            <Card className="border-success/20">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" /> Hits</p>
                <p className="text-2xl font-bold mt-1 text-success">{hits.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Miss Rate</p>
                <p className={`text-2xl font-bold mt-1 ${missRate > 50 ? "text-destructive" : missRate > 30 ? "text-warning" : "text-success"}`}>
                  {missRate.toFixed(0)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Activity className="w-3 h-3" /> Avg Cal Error</p>
                <p className="text-2xl font-bold mt-1 text-warning">{avgMissCalError.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground">misses vs {avgHitCalError.toFixed(0)} hits</p>
              </CardContent>
            </Card>
          </div>

          {/* Worst miss */}
          {worstMiss && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Largest Miss
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-foreground">{worstMiss.recommended_action}</p>
                <div className="flex gap-3 text-xs">
                  <Badge variant="destructive">Outcome: {(worstMiss.outcome_delta || 0).toFixed(1)}%</Badge>
                  <Badge variant="outline">Confidence: {worstMiss.confidence_at_decision || worstMiss.capped_confidence || 0}%</Badge>
                  <Badge variant="outline">Cal Error: {(worstMiss.calibration_error || 0).toFixed(0)}</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Misses list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-destructive" />
                All Prediction Misses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : misses.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <Target className="w-10 h-10 mx-auto text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No misses recorded yet.</p>
                  <p className="text-xs text-muted-foreground">Complete decisions with outcome measurement to populate this dashboard.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {misses.map(d => {
                    const conf = d.confidence_at_decision || d.capped_confidence || 0;
                    return (
                      <div key={d.id} className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/30 border">
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="text-sm text-foreground truncate">{d.recommended_action}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {d.decision_type} · {d.outcome_measured_at ? new Date(d.outcome_measured_at).toLocaleDateString() : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Outcome</p>
                            <p className="text-sm font-bold text-destructive tabular-nums">{(d.outcome_delta || 0).toFixed(1)}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Confidence</p>
                            <p className="text-sm font-bold tabular-nums">{conf}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Cal Error</p>
                            <p className="text-sm font-bold text-warning tabular-nums">{(d.calibration_error || 0).toFixed(0)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Insight */}
          <Card className="border-muted">
            <CardContent className="p-5 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-2">Why show misses?</p>
              <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
                Executives trust systems that admit error. Showing where predictions failed — alongside confidence levels at the time — 
                enables genuine calibration improvement and prevents "signal theater." Every miss is a learning signal.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default MissesPage;

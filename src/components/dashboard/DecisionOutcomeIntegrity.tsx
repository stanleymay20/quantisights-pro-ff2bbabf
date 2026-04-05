import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Target, TrendingUp, CheckCircle2, XCircle, Minus, BarChart3 } from "lucide-react";
import { getSeverityStyle } from "@/lib/severity-colors";
import ConfidenceBadge from "@/components/ConfidenceBadge";

interface DecisionOutcome {
  id: string;
  decision_id: string;
  outcome_status: string;
  accuracy_score: number | null;
  actual_outcome: string | null;
  expected_outcome: string | null;
  measured_at: string | null;
  variance_explanation: string | null;
}

interface LedgerDecision {
  id: string;
  title: string;
  decision_type: string;
  execution_status: string;
  capped_confidence: number | null;
  created_at: string;
}

interface Props {
  organizationId: string;
}

const OUTCOME_STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  success: { icon: CheckCircle2, color: "text-success", label: "Success" },
  partial_success: { icon: TrendingUp, color: "text-primary", label: "Partial" },
  no_effect: { icon: Minus, color: "text-muted-foreground", label: "No Effect" },
  negative: { icon: XCircle, color: "text-destructive", label: "Negative" },
  pending: { icon: Target, color: "text-warning", label: "Pending" },
};

/**
 * Decision Outcome Integrity panel — shows expected vs actual
 * with accuracy scores and classification for each decision.
 */
const DecisionOutcomeIntegrity = ({ organizationId }: Props) => {
  const [outcomes, setOutcomes] = useState<(DecisionOutcome & { decision?: LedgerDecision })[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [outcomesRes, decisionsRes] = await Promise.all([
        supabase
          .from("decision_outcomes")
          .select("*")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("decision_ledger")
          .select("id, title, decision_type, execution_status, capped_confidence, created_at")
          .eq("organization_id", organizationId)
          .limit(200),
      ]);

      const decisions = (decisionsRes.data || []) as LedgerDecision[];
      const decMap = new Map(decisions.map(d => [d.id, d]));

      const merged = ((outcomesRes.data || []) as DecisionOutcome[]).map(o => ({
        ...o,
        decision: decMap.get(o.decision_id),
      }));

      setOutcomes(merged);
      setLoading(false);
    };
    fetch();
  }, [organizationId]);

  if (loading) return null;
  if (outcomes.length === 0) return null;

  const evaluated = outcomes.filter(o => o.outcome_status !== "pending");
  const avgAccuracy = evaluated.length > 0
    ? evaluated.reduce((s, o) => s + (o.accuracy_score ?? 0), 0) / evaluated.length
    : null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Decision Outcome Integrity</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {evaluated.length}/{outcomes.length} evaluated
            </Badge>
            {avgAccuracy !== null && (
              <Badge variant="secondary" className="text-[10px]">
                Avg Accuracy: {avgAccuracy.toFixed(1)}%
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {outcomes.slice(0, 10).map((outcome) => {
          const statusCfg = OUTCOME_STATUS_CONFIG[outcome.outcome_status] || OUTCOME_STATUS_CONFIG.pending;
          const StatusIcon = statusCfg.icon;
          const isExpanded = expandedId === outcome.id;

          return (
            <div key={outcome.id} className="rounded-lg border border-border/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <StatusIcon className={`w-4 h-4 shrink-0 ${statusCfg.color}`} />
                  <span className="text-sm font-medium truncate">
                    {outcome.decision?.title || "Decision"}
                  </span>
                  <Badge variant="outline" className={`text-[10px] ${statusCfg.color} shrink-0`}>
                    {statusCfg.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {outcome.accuracy_score !== null && (
                    <span className="text-xs font-bold">
                      {outcome.accuracy_score.toFixed(0)}%
                    </span>
                  )}
                  {outcome.decision?.capped_confidence != null && (
                    <ConfidenceBadge confidence={outcome.decision.capped_confidence} />
                  )}
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setExpandedId(isExpanded ? null : outcome.id)}>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-border/20 space-y-2 text-xs">
                  {outcome.expected_outcome && (
                    <div>
                      <span className="font-semibold text-foreground">Expected: </span>
                      <span className="text-muted-foreground">{outcome.expected_outcome}</span>
                    </div>
                  )}
                  {outcome.actual_outcome && (
                    <div>
                      <span className="font-semibold text-foreground">Actual: </span>
                      <span className="text-muted-foreground">{outcome.actual_outcome}</span>
                    </div>
                  )}
                  {outcome.variance_explanation && (
                    <div>
                      <span className="font-semibold text-foreground">Variance: </span>
                      <span className="text-muted-foreground">{outcome.variance_explanation}</span>
                    </div>
                  )}
                  {outcome.measured_at && (
                    <div className="text-muted-foreground/60">
                      Measured: {new Date(outcome.measured_at).toLocaleDateString("de-DE")}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default DecisionOutcomeIntegrity;

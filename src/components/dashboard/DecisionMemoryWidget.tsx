import { memo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, CheckCircle2, XCircle, Clock, TrendingUp, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface DecisionMemoryWidgetProps {
  organizationId: string;
}

interface RecentDecision {
  id: string;
  recommended_action: string;
  decision_status: string;
  confidence_at_decision: number | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  approved: { icon: CheckCircle2, color: "text-success", label: "Approved" },
  executed: { icon: CheckCircle2, color: "text-success", label: "Executed" },
  dismissed: { icon: XCircle, color: "text-muted-foreground", label: "Dismissed" },
  pending_review: { icon: Clock, color: "text-warning", label: "Pending" },
  modified: { icon: TrendingUp, color: "text-primary", label: "Modified" },
};

const DecisionMemoryWidget = memo(({ organizationId }: DecisionMemoryWidgetProps) => {
  const [decisions, setDecisions] = useState<RecentDecision[]>([]);
  const [calibrationTrend, setCalibrationTrend] = useState<{ current: number | null; previous: number | null }>({ current: null, previous: null });
  const [totalDecisions, setTotalDecisions] = useState(0);

  useEffect(() => {
    if (!organizationId) return;

    const fetchData = async () => {
      const [decRes, calRes, countRes] = await Promise.all([
        supabase
          .from("decision_ledger")
          .select("id, recommended_action, decision_status, confidence_at_decision, created_at")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("calibration_models")
          .select("overall_calibration_score, computed_at")
          .eq("organization_id", organizationId)
          .order("computed_at", { ascending: false })
          .limit(2),
        supabase
          .from("decision_ledger")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", organizationId),
      ]);

      if (decRes.data) setDecisions(decRes.data as unknown as RecentDecision[]);
      if (calRes.data && calRes.data.length > 0) {
        setCalibrationTrend({
          current: calRes.data[0]?.overall_calibration_score ?? null,
          previous: calRes.data[1]?.overall_calibration_score ?? null,
        });
      }
      setTotalDecisions(countRes.count || 0);
    };

    fetchData();
  }, [organizationId]);

  if (decisions.length === 0 && !calibrationTrend.current) return null;

  const calDelta = calibrationTrend.current != null && calibrationTrend.previous != null
    ? calibrationTrend.current - calibrationTrend.previous
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="glass-card rounded-xl p-5 border border-border/30"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold font-display">Decision Memory</h3>
            <p className="text-[10px] text-muted-foreground">System learns from every decision</p>
          </div>
        </div>
        <Link to="/decisions" className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5">
          Full ledger <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Calibration Score */}
      {calibrationTrend.current != null && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 mb-3">
          <div className="flex-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Calibration Score</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-bold font-mono">{calibrationTrend.current}%</span>
              {calDelta != null && calDelta !== 0 && (
                <span className={`text-[11px] font-medium ${calDelta > 0 ? "text-success" : "text-destructive"}`}>
                  {calDelta > 0 ? "+" : ""}{calDelta.toFixed(1)}pp
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Total decisions</p>
            <p className="text-sm font-semibold font-mono">{totalDecisions}</p>
          </div>
        </div>
      )}

      {/* Recent Decisions */}
      {decisions.length > 0 && (
        <div className="space-y-1.5">
          {decisions.slice(0, 4).map((d) => {
            const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            const daysAgo = Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000);

            return (
              <div key={d.id} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-muted/30 transition-colors group">
                <StatusIcon className={`w-3.5 h-3.5 shrink-0 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate">{d.title}</p>
                </div>
                {d.confidence_score != null && (
                  <span className="text-[10px] font-mono text-muted-foreground">{d.confidence_score}%</span>
                )}
                <span className="text-[10px] text-muted-foreground/60 shrink-0">
                  {daysAgo === 0 ? "today" : `${daysAgo}d`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {totalDecisions > 0 && (
        <p className="text-[10px] text-muted-foreground/50 mt-3 text-center italic">
          Calibration improves as more decisions reach outcome measurement
        </p>
      )}
    </motion.div>
  );
});

DecisionMemoryWidget.displayName = "DecisionMemoryWidget";

export default DecisionMemoryWidget;

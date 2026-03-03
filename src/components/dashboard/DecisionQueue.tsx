import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, AlertTriangle, TrendingDown, Clock, ChevronRight, Sparkles, CheckCircle2, XCircle, Pencil, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { Insight } from "@/hooks/useInsights";

export interface QueuedDecision {
  id: string;
  type: "signal" | "advisory" | "pending_outcome" | "proactive";
  urgency: "critical" | "high" | "medium";
  title: string;
  context: string;
  recommendedAction: string;
  confidence?: number;
  source: string;
  sourceId?: string;
  timeframe?: string;
}

interface DecisionQueueProps {
  organizationId: string;
  insights: Insight[];
  churnRate: number;
  revenue: number;
  pendingDecisions: number;
  calibrationScore: number | null;
}

const URGENCY_STYLES = {
  critical: {
    border: "border-destructive/30",
    bg: "bg-destructive/[0.04]",
    badge: "bg-destructive/10 text-destructive",
    icon: AlertTriangle,
  },
  high: {
    border: "border-warning/30",
    bg: "bg-warning/[0.04]",
    badge: "bg-warning/10 text-warning",
    icon: TrendingDown,
  },
  medium: {
    border: "border-primary/30",
    bg: "bg-primary/[0.04]",
    badge: "bg-primary/10 text-primary",
    icon: Brain,
  },
};

const DecisionQueue = ({ organizationId, insights, churnRate, revenue, pendingDecisions, calibrationScore }: DecisionQueueProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [decisions, setDecisions] = useState<QueuedDecision[]>([]);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;
    buildQueue();
  }, [organizationId, insights, churnRate, pendingDecisions]);

  const buildQueue = async () => {
    setLoading(true);
    const queue: QueuedDecision[] = [];

    // 1. Critical signals from insights
    const criticalInsights = insights.filter(i => i.severity === "high");
    criticalInsights.slice(0, 2).forEach(insight => {
      queue.push({
        id: `signal-${insight.id}`,
        type: "signal",
        urgency: "critical",
        title: "Anomaly requires strategic decision",
        context: insight.message?.slice(0, 120) || "Critical signal detected in your data",
        recommendedAction: "Investigate root cause and approve corrective playbook",
        confidence: insight.confidence_score,
        source: "Diagnostic Engine",
        sourceId: insight.id,
      });
    });

    // 2. Open advisories that need approval
    const { data: advisories } = await supabase
      .from("advisory_instances")
      .select("id, title, action, priority, confidence, capped_confidence, category, timeframe")
      .eq("organization_id", organizationId)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(3);

    advisories?.forEach(adv => {
      queue.push({
        id: `advisory-${adv.id}`,
        type: "advisory",
        urgency: adv.priority === "critical" ? "critical" : adv.priority === "high" ? "high" : "medium",
        title: adv.title,
        context: adv.action,
        recommendedAction: adv.action,
        confidence: adv.capped_confidence ?? adv.confidence ?? undefined,
        source: `${adv.category} Advisory`,
        sourceId: adv.id,
        timeframe: adv.timeframe ?? undefined,
      });
    });

    // 3. Pending decisions awaiting outcome
    if (pendingDecisions > 0) {
      const { data: pending } = await supabase
        .from("decision_ledger")
        .select("id, recommended_action, confidence_at_decision, created_at, decision_type")
        .eq("organization_id", organizationId)
        .eq("execution_status", "not_started")
        .order("created_at", { ascending: false })
        .limit(2);

      pending?.forEach(dec => {
        queue.push({
          id: `pending-${dec.id}`,
          type: "pending_outcome",
          urgency: "medium",
          title: dec.recommended_action?.slice(0, 80) || "Decision awaiting outcome",
          context: `Logged ${new Date(dec.created_at).toLocaleDateString()} • ${dec.decision_type} • ${dec.confidence_at_decision ?? "?"}% confidence`,
          recommendedAction: "Record the actual outcome to improve calibration accuracy",
          source: "Decision Ledger",
          sourceId: dec.id,
        });
      });
    }

    // 4. Proactive: churn risk
    if (churnRate > 5 && queue.length < 5) {
      queue.push({
        id: "proactive-churn",
        type: "proactive",
        urgency: "high",
        title: `Retention risk: churn at ${churnRate.toFixed(1)}%`,
        context: "Elevated churn rate detected. AI recommends reviewing customer cohort health and activating retention playbook.",
        recommendedAction: "Approve retention playbook activation",
        source: "Proactive Intelligence",
      });
    }

    // 5. Proactive: calibration improvement
    if (calibrationScore != null && calibrationScore < 65 && queue.length < 5) {
      queue.push({
        id: "proactive-calibration",
        type: "proactive",
        urgency: "medium",
        title: "Calibration below threshold",
        context: `Your team's decision accuracy is ${calibrationScore}%. Log more decision outcomes to strengthen the model.`,
        recommendedAction: "Review and close 3 oldest pending decisions",
        source: "Calibration Engine",
      });
    }

    setDecisions(queue.slice(0, 5));
    setLoading(false);
  };

  const handleApprove = async (decision: QueuedDecision) => {
    setActingOn(decision.id);
    try {
      if (decision.type === "advisory" && decision.sourceId) {
        await supabase
          .from("advisory_instances")
          .update({ status: "in_progress", assigned_to: user?.id })
          .eq("id", decision.sourceId);
      }
      if (decision.type === "signal" && decision.sourceId) {
        await supabase
          .from("insights")
          .update({ is_read: true })
          .eq("id", decision.sourceId);
      }
      // Log as decision
      await supabase.from("decision_ledger").insert({
        organization_id: organizationId,
        recommended_action: decision.recommendedAction,
        chosen_action: decision.recommendedAction,
        decided_by: user?.id,
        decided_at: new Date().toISOString(),
        decision_status: "approved",
        confidence_at_decision: decision.confidence ?? 65,
        decision_type: "strategic",
      } as any);

      setDecisions(prev => prev.filter(d => d.id !== decision.id));
      toast({ title: "Decision approved", description: "Logged and tracking has begun." });
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setActingOn(null);
    }
  };

  const handleDismiss = async (decision: QueuedDecision) => {
    setActingOn(decision.id);
    try {
      if (decision.type === "advisory" && decision.sourceId) {
        await supabase
          .from("advisory_instances")
          .update({ status: "dismissed" })
          .eq("id", decision.sourceId);
      }
      if (decision.type === "signal" && decision.sourceId) {
        await supabase
          .from("insights")
          .update({ is_read: true })
          .eq("id", decision.sourceId);
      }
      setDecisions(prev => prev.filter(d => d.id !== decision.id));
      toast({ title: "Dismissed" });
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setActingOn(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12 px-6"
      >
        <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7 text-success" />
        </div>
        <h3 className="text-lg font-semibold mb-1">All clear</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          No decisions require your attention right now. The system is monitoring continuously and will surface signals when action is needed.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Decisions Awaiting You</h2>
          <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {decisions.length}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          AI-prioritized • Most urgent first
        </span>
      </div>

      <AnimatePresence mode="popLayout">
        {decisions.map((decision, index) => {
          const style = URGENCY_STYLES[decision.urgency];
          const Icon = style.icon;
          const isActing = actingOn === decision.id;

          return (
            <motion.div
              key={decision.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100, height: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-xl border ${style.border} ${style.bg} p-4 transition-all hover:shadow-lg hover:shadow-primary/5`}
            >
              <div className="flex items-start gap-3">
                {/* Left: Icon + Urgency */}
                <div className="flex flex-col items-center gap-1.5 pt-0.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.badge}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${style.badge} px-1.5 py-0.5 rounded`}>
                    {decision.urgency}
                  </span>
                </div>

                {/* Middle: Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight mb-1">{decision.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">{decision.context}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded">
                      {decision.source}
                    </span>
                    {decision.confidence && (
                      <span className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded">
                        {decision.confidence}% confidence
                      </span>
                    )}
                    {decision.timeframe && (
                      <span className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> {decision.timeframe}
                      </span>
                    )}
                  </div>

                  {/* Recommended Action */}
                  <div className="mt-3 p-2.5 rounded-lg bg-background/60 border border-border/30">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      AI Recommendation
                    </p>
                    <p className="text-xs font-medium">{decision.recommendedAction}</p>
                  </div>
                </div>

                {/* Right: Action Buttons */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => handleApprove(decision)}
                    disabled={isActing}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    Approve
                  </button>
                  <button
                    onClick={() => handleDismiss(decision)}
                    disabled={isActing}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3 h-3" />
                    Dismiss
                  </button>
                  <button
                    disabled={isActing}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50"
                  >
                    <Pencil className="w-3 h-3" />
                    Modify
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default DecisionQueue;

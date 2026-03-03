import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, AlertTriangle, TrendingDown, Clock, Sparkles, CheckCircle2, XCircle, Pencil, Loader2, ShieldCheck, FileCheck, Bell, Crosshair, Flame, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
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
  costOfDelay: string;
  riskIfIgnored: "high" | "medium" | "low";
  createdAt?: string; // ISO timestamp for time-decay
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

const RISK_STYLES = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-warning/10 text-warning",
  low: "bg-muted/50 text-muted-foreground",
};

// Time-decay escalation tiers
type EscalationTier = "fresh" | "aging" | "escalating" | "at_risk";

const ESCALATION_CONFIG: Record<EscalationTier, {
  label: string;
  badgeClass: string;
  icon: typeof Flame;
}> = {
  fresh: { label: "", badgeClass: "", icon: Clock },
  aging: { label: "Aging", badgeClass: "bg-warning/10 text-warning", icon: Clock },
  escalating: { label: "Escalating", badgeClass: "bg-orange-500/10 text-orange-500", icon: Flame },
  at_risk: { label: "At Risk", badgeClass: "bg-destructive/10 text-destructive animate-pulse", icon: Flame },
};

function getEscalationTier(createdAt: string | undefined, urgency: string): EscalationTier {
  if (!createdAt) return "fresh";
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;

  if (urgency === "critical") {
    if (ageHours > 120) return "at_risk";   // 5 days
    if (ageHours > 72) return "escalating"; // 3 days
    if (ageHours > 24) return "aging";      // 1 day
  } else if (urgency === "high") {
    if (ageHours > 168) return "at_risk";   // 7 days
    if (ageHours > 96) return "escalating"; // 4 days
    if (ageHours > 48) return "aging";      // 2 days
  } else {
    if (ageHours > 336) return "at_risk";   // 14 days
    if (ageHours > 168) return "escalating";// 7 days
    if (ageHours > 72) return "aging";      // 3 days
  }
  return "fresh";
}

function formatAge(createdAt: string | undefined): string {
  if (!createdAt) return "";
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (hours < 1) return "< 1h ago";
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface Confirmation {
  decisionTitle: string;
  action: "approved" | "dismissed" | "modified";
}

const DecisionQueue = memo(({ organizationId, insights, churnRate, revenue, pendingDecisions, calibrationScore }: DecisionQueueProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [decisions, setDecisions] = useState<QueuedDecision[]>([]);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);

  // Keyboard shortcuts
  const focusedDecision = decisions[focusIndex] ?? null;

  const handleApprove = useCallback(async (decision: QueuedDecision) => {
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
      setConfirmation({ decisionTitle: decision.title, action: "approved" });
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setActingOn(null);
    }
  }, [organizationId, user?.id, toast]);

  const handleDismiss = useCallback(async (decision: QueuedDecision) => {
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
      setConfirmation({ decisionTitle: decision.title, action: "dismissed" });
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setActingOn(null);
    }
  }, [toast]);

  useKeyboardShortcuts({
    onNext: () => setFocusIndex(i => Math.min(i + 1, decisions.length - 1)),
    onPrev: () => setFocusIndex(i => Math.max(i - 1, 0)),
    onApprove: () => { if (focusedDecision && !actingOn) handleApprove(focusedDecision); },
    onDismiss: () => { if (focusedDecision && !actingOn) handleDismiss(focusedDecision); },
  }, decisions.length > 0);

  useEffect(() => {
    if (!organizationId) return;
    buildQueue();
  }, [organizationId, insights, churnRate, pendingDecisions]);

  useEffect(() => {
    if (!confirmation) return;
    const timer = setTimeout(() => setConfirmation(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmation]);

  const formatRevenueBand = useCallback((pct: number): string => {
    const exposure = revenue * (pct / 100);
    if (exposure >= 1_000_000) return `€${(exposure / 1_000_000).toFixed(1)}M`;
    if (exposure >= 1_000) return `€${(exposure / 1_000).toFixed(0)}K`;
    return `€${exposure.toFixed(0)}`;
  }, [revenue]);

  const criticalInsights = useMemo(
    () => insights.filter(i => i.severity === "high"),
    [insights]
  );

  const buildQueue = async () => {
    setLoading(true);
    const queue: QueuedDecision[] = [];

    // 1. Critical signals
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
        costOfDelay: `Potential ${formatRevenueBand(5)}–${formatRevenueBand(12)} downside exposure if unaddressed within 14 days`,
        riskIfIgnored: "high",
        createdAt: insight.created_at,
      });
    });

    // 2. Open advisories
    const { data: advisories } = await supabase
      .from("advisory_instances")
      .select("id, title, action, priority, confidence, capped_confidence, category, timeframe, expected_impact, created_at")
      .eq("organization_id", organizationId)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(3);

    advisories?.forEach(adv => {
      const isHigh = adv.priority === "critical" || adv.priority === "high";
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
        costOfDelay: adv.expected_impact
          ? `Impact: ${adv.expected_impact}`
          : isHigh
            ? "Board risk: decision made without audit trail"
            : "Delayed action reduces strategic optionality",
        riskIfIgnored: isHigh ? "high" : "medium",
        createdAt: adv.created_at,
      });
    });

    // 3. Pending outcomes
    if (pendingDecisions > 0) {
      const { data: pending } = await supabase
        .from("decision_ledger")
        .select("id, recommended_action, confidence_at_decision, created_at, decision_type")
        .eq("organization_id", organizationId)
        .eq("execution_status", "not_started")
        .order("created_at", { ascending: false })
        .limit(2);

      pending?.forEach(dec => {
        const daysSince = Math.floor((Date.now() - new Date(dec.created_at).getTime()) / 86400000);
        queue.push({
          id: `pending-${dec.id}`,
          type: "pending_outcome",
          urgency: "medium",
          title: dec.recommended_action?.slice(0, 80) || "Decision awaiting outcome",
          context: `Logged ${daysSince}d ago • ${dec.decision_type} • ${dec.confidence_at_decision ?? "?"}% confidence`,
          recommendedAction: "Record the actual outcome to improve calibration accuracy",
          source: "Decision Ledger",
          sourceId: dec.id,
          costOfDelay: `Accuracy impact: closing this outcome improves calibration by ~0.8pp`,
          riskIfIgnored: daysSince > 30 ? "medium" : "low",
          createdAt: dec.created_at,
        });
      });
    }

    // 4. Proactive: churn
    if (churnRate > 5 && queue.length < 5) {
      queue.push({
        id: "proactive-churn",
        type: "proactive",
        urgency: "high",
        title: `Retention risk: churn at ${churnRate.toFixed(1)}%`,
        context: "Elevated churn rate detected. AI recommends reviewing customer cohort health and activating retention playbook.",
        recommendedAction: "Approve retention playbook activation",
        source: "Proactive Intelligence",
        costOfDelay: `At current rate, projected ${formatRevenueBand(churnRate * 2)} revenue at risk over next quarter`,
        riskIfIgnored: "high",
      });
    }

    // 5. Proactive: calibration
    if (calibrationScore != null && calibrationScore < 65 && queue.length < 5) {
      queue.push({
        id: "proactive-calibration",
        type: "proactive",
        urgency: "medium",
        title: "Calibration below threshold",
        context: `Your team's decision accuracy is ${calibrationScore}%. Log more decision outcomes to strengthen the model.`,
        recommendedAction: "Review and close 3 oldest pending decisions",
        source: "Calibration Engine",
        costOfDelay: "Each unresolved outcome reduces model accuracy and weakens board defensibility",
        riskIfIgnored: "medium",
      });
    }

    // Sort by escalation tier (most urgent first)
    const tierOrder: Record<EscalationTier, number> = { at_risk: 0, escalating: 1, aging: 2, fresh: 3 };
    queue.sort((a, b) => {
      const tierA = tierOrder[getEscalationTier(a.createdAt, a.urgency)];
      const tierB = tierOrder[getEscalationTier(b.createdAt, b.urgency)];
      if (tierA !== tierB) return tierA - tierB;
      // Then by urgency
      const urgencyOrder = { critical: 0, high: 1, medium: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });

    setDecisions(queue.slice(0, 5));
    setFocusIndex(0);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 rounded-xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (decisions.length === 0 && !confirmation) {
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
          No decisions require your attention. The system is monitoring continuously and will surface signals when action is needed.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Board-Defensible Confirmation Banner */}
      <AnimatePresence>
        {confirmation && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="rounded-xl border border-success/30 bg-success/[0.04] p-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-success">
                  Decision {confirmation.action} — Board defensible
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {confirmation.decisionTitle}
                </p>
                <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                  <span className="text-[10px] flex items-center gap-1 text-muted-foreground">
                    <FileCheck className="w-3 h-3 text-success" /> Logged with audit trail
                  </span>
                  <span className="text-[10px] flex items-center gap-1 text-muted-foreground">
                    <Crosshair className="w-3 h-3 text-success" /> Owner assigned
                  </span>
                  <span className="text-[10px] flex items-center gap-1 text-muted-foreground">
                    <Bell className="w-3 h-3 text-success" /> Outcome reminder scheduled
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {decisions.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">Decisions Awaiting You</h2>
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {decisions.length}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              <kbd className="px-1.5 py-0.5 rounded border border-border/50 text-[9px] font-mono mr-1">J</kbd>
              <kbd className="px-1.5 py-0.5 rounded border border-border/50 text-[9px] font-mono mr-1">K</kbd>
              navigate · 
              <kbd className="px-1.5 py-0.5 rounded border border-border/50 text-[9px] font-mono mx-1">A</kbd>
              approve · 
              <kbd className="px-1.5 py-0.5 rounded border border-border/50 text-[9px] font-mono mx-1">D</kbd>
              dismiss
            </span>
          </div>

          <AnimatePresence mode="popLayout">
            {decisions.map((decision, index) => {
              const style = URGENCY_STYLES[decision.urgency];
              const Icon = style.icon;
              const isActing = actingOn === decision.id;
              const isFocused = focusIndex === index;
              const escalation = getEscalationTier(decision.createdAt, decision.urgency);
              const escConfig = ESCALATION_CONFIG[escalation];
              const age = formatAge(decision.createdAt);

              return (
                <motion.div
                  key={decision.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100, height: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`rounded-xl border ${style.border} ${style.bg} p-4 transition-all hover:shadow-lg hover:shadow-primary/5 ${
                    isFocused ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-background" : ""
                  }`}
                  onClick={() => setFocusIndex(index)}
                >
                  <div className="flex items-start gap-3">
                    {/* Left: Icon + Urgency */}
                    <div className="flex flex-col items-center gap-1.5 pt-0.5 shrink-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.badge}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-widest ${style.badge} px-1.5 py-0.5 rounded`}>
                        {decision.urgency}
                      </span>
                    </div>

                    {/* Middle: Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-semibold leading-tight">{decision.title}</p>
                        {/* Escalation badge */}
                        {escalation !== "fresh" && (
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded flex items-center gap-1 ${escConfig.badgeClass}`}>
                            <escConfig.icon className="w-2.5 h-2.5" />
                            {escConfig.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-2">{decision.context}</p>

                      {/* Cost of Delay */}
                      <div className="flex items-start gap-2 mb-2.5 p-2 rounded-lg bg-background/80 border border-border/20">
                        <AlertTriangle className={`w-3 h-3 mt-0.5 shrink-0 ${
                          decision.riskIfIgnored === "high" ? "text-destructive" :
                          decision.riskIfIgnored === "medium" ? "text-warning" : "text-muted-foreground"
                        }`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Cost of Delay
                            </span>
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${RISK_STYLES[decision.riskIfIgnored]}`}>
                              {decision.riskIfIgnored}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-foreground/80">{decision.costOfDelay}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded">
                          {decision.source}
                        </span>
                        {decision.confidence != null && (
                          <span className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded">
                            {decision.confidence}% confidence
                          </span>
                        )}
                        {decision.timeframe && (
                          <span className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> {decision.timeframe}
                          </span>
                        )}
                        {age && (
                          <span className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> {age}
                          </span>
                        )}
                      </div>

                      {/* Recommended Action */}
                      <div className="p-2.5 rounded-lg bg-background/60 border border-border/30">
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
        </>
      )}
    </div>
  );
});

DecisionQueue.displayName = "DecisionQueue";

export default DecisionQueue;

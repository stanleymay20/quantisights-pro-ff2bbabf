import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, AlertTriangle, TrendingDown, Clock, Sparkles, CheckCircle2, XCircle, Pencil, Loader2, ShieldCheck, FileCheck, Bell, Crosshair, Flame, Zap, User, CalendarDays, Target } from "lucide-react";
import ConfidenceBadge, { resolveConfidence } from "@/components/ConfidenceBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { computeCostOfDelay, type CostOfDelayResult, type CostOfDelayInput } from "@/lib/cost-of-delay";
import { generateRecommendation, type StructuredRecommendation } from "@/lib/decision-recommendation";
import ModifyDecisionDialog from "./ModifyDecisionDialog";
import type { Insight } from "@/hooks/useInsights";

export interface EnrichedDecision {
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
  riskIfIgnored: "high" | "medium" | "low";
  createdAt?: string;
  // Structured enrichments
  costOfDelayResult: CostOfDelayResult;
  recommendation: StructuredRecommendation;
  // Audit fields
  rawConfidence?: number | null;
  cappedConfidence?: number | null;
  confidenceCapReason?: string | null;
  generatedAt: string;
  /** Sample size backing the confidence value */
  sampleSize?: number;
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

const COD_LABEL_STYLES: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  high: "bg-warning/10 text-warning",
  medium: "bg-primary/10 text-primary",
  low: "bg-muted/50 text-muted-foreground",
};

type EscalationTier = "fresh" | "aging" | "escalating" | "at_risk";

const ESCALATION_CONFIG: Record<EscalationTier, { label: string; badgeClass: string; icon: typeof Flame }> = {
  fresh: { label: "", badgeClass: "", icon: Clock },
  aging: { label: "Aging", badgeClass: "bg-warning/10 text-warning", icon: Clock },
  escalating: { label: "Escalating", badgeClass: "bg-destructive/10 text-destructive", icon: Flame },
  at_risk: { label: "At Risk", badgeClass: "bg-destructive/10 text-destructive animate-pulse", icon: Flame },
};

function getEscalationTier(createdAt: string | undefined, urgency: string): EscalationTier {
  if (!createdAt) return "fresh";
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (urgency === "critical") {
    if (ageHours > 120) return "at_risk";
    if (ageHours > 72) return "escalating";
    if (ageHours > 24) return "aging";
  } else if (urgency === "high") {
    if (ageHours > 168) return "at_risk";
    if (ageHours > 96) return "escalating";
    if (ageHours > 48) return "aging";
  } else {
    if (ageHours > 336) return "at_risk";
    if (ageHours > 168) return "escalating";
    if (ageHours > 72) return "aging";
  }
  return "fresh";
}

function formatAge(createdAt: string | undefined): string {
  if (!createdAt) return "";
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (hours < 1) return "< 1h ago";
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ageDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
}

interface Confirmation {
  decisionTitle: string;
  action: "approved" | "dismissed" | "modified";
}

const DecisionQueue = memo(({ organizationId, insights, churnRate, revenue, pendingDecisions, calibrationScore }: DecisionQueueProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [decisions, setDecisions] = useState<EnrichedDecision[]>([]);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [modifyTarget, setModifyTarget] = useState<EnrichedDecision | null>(null);

  const focusedDecision = decisions[focusIndex] ?? null;

  const handleApprove = useCallback(async (decision: EnrichedDecision) => {
    setActingOn(decision.id);
    try {
      if (decision.type === "advisory" && decision.sourceId) {
        await supabase.from("advisory_instances").update({ status: "in_progress", assigned_to: user?.id }).eq("id", decision.sourceId);
      }
      if (decision.type === "signal" && decision.sourceId) {
        await supabase.from("insights").update({ is_read: true }).eq("id", decision.sourceId);
      }
      await supabase.from("decision_ledger").insert({
        organization_id: organizationId,
        recommended_action: decision.recommendation.recommendedAction,
        chosen_action: decision.recommendation.recommendedAction,
        decided_by: user?.id,
        decided_at: new Date().toISOString(),
        decision_status: "approved",
        confidence_at_decision: decision.confidence ?? 50,
        raw_confidence: decision.rawConfidence,
        capped_confidence: decision.cappedConfidence,
        confidence_cap_reason: decision.confidenceCapReason,
        decision_type: "strategic",
        notes: `Owner: ${decision.recommendation.suggestedOwner} | Due: ${decision.costOfDelayResult.recommendedActionWindowDays}d | Metrics: ${decision.recommendation.successMetrics.join(", ")}`,
      });
      setDecisions(prev => prev.filter(d => d.id !== decision.id));
      setConfirmation({ decisionTitle: decision.title, action: "approved" });
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setActingOn(null);
    }
  }, [organizationId, user?.id, toast]);

  const handleDismiss = useCallback(async (decision: EnrichedDecision) => {
    setActingOn(decision.id);
    try {
      if (decision.type === "advisory" && decision.sourceId) {
        await supabase.from("advisory_instances").update({ status: "dismissed" }).eq("id", decision.sourceId);
      }
      if (decision.type === "signal" && decision.sourceId) {
        await supabase.from("insights").update({ is_read: true }).eq("id", decision.sourceId);
      }
      setDecisions(prev => prev.filter(d => d.id !== decision.id));
      setConfirmation({ decisionTitle: decision.title, action: "dismissed" });
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setActingOn(null);
    }
  }, [toast]);

  const handleModifySaved = useCallback((updated: Partial<EnrichedDecision>) => {
    setDecisions(prev => prev.filter(d => d.id !== updated.id));
    setConfirmation({ decisionTitle: updated.title ?? "Decision", action: "modified" });
  }, []);

  useKeyboardShortcuts({
    onNext: () => setFocusIndex(i => Math.min(i + 1, decisions.length - 1)),
    onPrev: () => setFocusIndex(i => Math.max(i - 1, 0)),
    onApprove: () => { if (focusedDecision && !actingOn) handleApprove(focusedDecision); },
    onDismiss: () => { if (focusedDecision && !actingOn) handleDismiss(focusedDecision); },
  }, decisions.length > 0);

  useEffect(() => {
    if (!organizationId) return;
    buildQueue();
  }, [organizationId, insights, churnRate, revenue, pendingDecisions, calibrationScore]);

  useEffect(() => {
    if (!confirmation) return;
    const timer = setTimeout(() => setConfirmation(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmation]);

  const criticalInsights = useMemo(
    () => insights.filter(i => i.severity === "high"),
    [insights]
  );

  const buildQueue = async () => {
    setLoading(true);
    const queue: EnrichedDecision[] = [];
    const now = new Date().toISOString();

    // 1. Critical signals
    criticalInsights.slice(0, 2).forEach(insight => {
      const severity: "critical" | "high" = "critical";
      const age = ageDays(insight.created_at);
      const cat = insight.category?.toLowerCase() ?? "";
      const trendDir = (insight.message?.toLowerCase().includes("decline") || insight.message?.toLowerCase().includes("drop")) ? "down" as const : "stable" as const;

      const codResult = computeCostOfDelay({
        severity,
        confidence: insight.confidence_score ?? null,
        affectedMetricType: insight.category,
        revenue,
        ageDays: age,
        trendAccelerating: insight.message?.toLowerCase().includes("accelerat") ?? false,
      });

      const rec = generateRecommendation({
        signalType: "signal",
        metricType: insight.category,
        trendDirection: trendDir,
        severity,
        confidence: insight.confidence_score ?? null,
        message: insight.message,
        category: insight.category,
      });

      queue.push({
        id: `signal-${insight.id}`,
        type: "signal",
        urgency: codResult.label === "critical" ? "critical" : "high",
        title: rec.whatHappened,
        context: insight.message?.slice(0, 160) || "Critical signal detected",
        recommendedAction: rec.recommendedAction,
        confidence: insight.confidence_score,
        source: insight.category ? `${insight.category} Diagnostics` : "Diagnostic Engine",
        sourceId: insight.id,
        costOfDelayResult: codResult,
        recommendation: rec,
        riskIfIgnored: codResult.label === "critical" || codResult.label === "high" ? "high" : "medium",
        createdAt: insight.created_at,
        rawConfidence: insight.confidence_score ?? null,
        cappedConfidence: null,
        confidenceCapReason: null,
        generatedAt: now,
      });
    });

    // 2. Open advisories
    const { data: advisories } = await supabase
      .from("advisory_instances")
      .select("id, title, action, priority, confidence, capped_confidence, confidence_cap_reason, category, timeframe, expected_impact, created_at, raw_confidence, impact_score")
      .eq("organization_id", organizationId)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(3);

    advisories?.forEach(adv => {
      const sev = adv.priority === "critical" ? "critical" : adv.priority === "high" ? "high" : "medium";
      const age = ageDays(adv.created_at);

      const codResult = computeCostOfDelay({
        severity: sev as CostOfDelayInput["severity"],
        confidence: (adv.capped_confidence ?? adv.confidence) as number | null,
        cappedConfidence: adv.capped_confidence as number | null,
        affectedMetricType: adv.category,
        predictedNetImpact: null,
        revenue,
        ageDays: age,
        expectedImpact: adv.expected_impact,
      });

      const rec = generateRecommendation({
        signalType: "advisory",
        category: adv.category,
        severity: sev,
        confidence: (adv.capped_confidence ?? adv.confidence) as number | null,
        priorAdvisoryAction: adv.action,
        message: adv.title,
      });

      queue.push({
        id: `advisory-${adv.id}`,
        type: "advisory",
        urgency: sev === "critical" ? "critical" : sev === "high" ? "high" : "medium",
        title: adv.title,
        context: adv.action,
        recommendedAction: rec.recommendedAction,
        confidence: (adv.capped_confidence ?? adv.confidence) as number | undefined,
        source: `${adv.category} Advisory`,
        sourceId: adv.id,
        timeframe: adv.timeframe ?? undefined,
        costOfDelayResult: codResult,
        recommendation: rec,
        riskIfIgnored: codResult.label === "critical" || codResult.label === "high" ? "high" : "medium",
        createdAt: adv.created_at,
        rawConfidence: (adv.raw_confidence ?? adv.confidence) as number | null,
        cappedConfidence: adv.capped_confidence as number | null,
        confidenceCapReason: adv.confidence_cap_reason,
        generatedAt: now,
      });
    });

    // 3. Pending outcomes
    if (pendingDecisions > 0) {
      const { data: pending } = await supabase
        .from("decision_ledger")
        .select("id, recommended_action, confidence_at_decision, raw_confidence, capped_confidence, confidence_cap_reason, created_at, decision_type")
        .eq("organization_id", organizationId)
        .eq("execution_status", "not_started")
        .order("created_at", { ascending: false })
        .limit(2);

      pending?.forEach(dec => {
        const days = ageDays(dec.created_at);
        const sev: CostOfDelayInput["severity"] = days > 45 ? "high" : days > 21 ? "medium" : "low";

        const codResult = computeCostOfDelay({
          severity: sev,
          confidence: dec.confidence_at_decision,
          ageDays: days,
          revenue,
        });

        const rec = generateRecommendation({
          signalType: "pending_outcome",
          severity: sev,
          confidence: dec.confidence_at_decision,
          message: dec.recommended_action,
          category: dec.decision_type,
        });

        queue.push({
          id: `pending-${dec.id}`,
          type: "pending_outcome",
          urgency: days > 30 ? "high" : "medium",
          title: dec.recommended_action?.slice(0, 80) || "Decision awaiting outcome",
          context: `Logged ${days}d ago · ${dec.decision_type} · ${dec.confidence_at_decision ?? "?"}% confidence at decision time`,
          recommendedAction: rec.recommendedAction,
          source: "Decision Ledger",
          sourceId: dec.id,
          costOfDelayResult: codResult,
          recommendation: rec,
          riskIfIgnored: days > 45 ? "high" : days > 21 ? "medium" : "low",
          createdAt: dec.created_at,
          rawConfidence: dec.raw_confidence,
          cappedConfidence: dec.capped_confidence,
          confidenceCapReason: dec.confidence_cap_reason,
          generatedAt: now,
        });
      });
    }

    // 4. Proactive: churn (confidence is heuristic — labeled as such)
    if (churnRate > 5 && queue.length < 5) {
      const sev: CostOfDelayInput["severity"] = churnRate > 12 ? "critical" : churnRate > 8 ? "high" : "medium";
      // Proactive signals use heuristic confidence — explicitly capped and labeled
      const heuristicConf = Math.min(60, Math.round(40 + churnRate)); // never exceeds 60% for heuristic

      const codResult = computeCostOfDelay({
        severity: sev,
        confidence: heuristicConf,
        affectedMetricType: "churn",
        revenue,
        trendAccelerating: churnRate > 10,
      });

      const rec = generateRecommendation({
        signalType: "proactive",
        metricType: "churn",
        trendDirection: "up",
        severity: sev,
        confidence: heuristicConf,
        category: "retention",
      });

      queue.push({
        id: "proactive-churn",
        type: "proactive",
        urgency: sev === "critical" ? "critical" : "high",
        title: `Retention risk: ${churnRate.toFixed(1)}% churn rate ${churnRate > 10 ? "— exceeds critical threshold" : "— above target"}`,
        context: `Churn at ${churnRate.toFixed(1)}% erodes customer base and compounds revenue loss. Confidence is heuristic (threshold-based).`,
        recommendedAction: rec.recommendedAction,
        source: "Proactive Intelligence",
        costOfDelayResult: codResult,
        recommendation: rec,
        riskIfIgnored: "high",
        generatedAt: now,
        rawConfidence: heuristicConf,
        cappedConfidence: null,
        confidenceCapReason: "Heuristic confidence: threshold-based proactive signal, not model-derived",
      });
    }

    // 5. Proactive: calibration
    if (calibrationScore != null && calibrationScore < 65 && queue.length < 5) {
      const sev: CostOfDelayInput["severity"] = calibrationScore < 40 ? "high" : "medium";

      const codResult = computeCostOfDelay({
        severity: sev,
        confidence: calibrationScore,
        ageDays: 0,
        revenue,
      });

      const rec = generateRecommendation({
        signalType: "proactive",
        category: "calibration",
        severity: sev,
        confidence: calibrationScore,
        message: `Calibration at ${calibrationScore}% — ${65 - calibrationScore}pp below governance threshold`,
      });

      queue.push({
        id: "proactive-calibration",
        type: "proactive",
        urgency: sev === "high" ? "high" : "medium",
        title: `Decision calibration at ${calibrationScore}% — ${65 - calibrationScore}pp below threshold`,
        context: `Team calibration score is ${calibrationScore}% (target: ≥65%). ${pendingDecisions > 0 ? `${pendingDecisions} outcomes awaiting closure.` : ""}`,
        recommendedAction: rec.recommendedAction,
        source: "Calibration Engine",
        costOfDelayResult: codResult,
        recommendation: rec,
        riskIfIgnored: sev === "high" ? "high" : "medium",
        generatedAt: now,
        rawConfidence: calibrationScore,
        cappedConfidence: null,
        confidenceCapReason: null,
      });
    }

    // Sort by cost-of-delay score (highest first)
    queue.sort((a, b) => {
      if (b.costOfDelayResult.score !== a.costOfDelayResult.score) {
        return b.costOfDelayResult.score - a.costOfDelayResult.score;
      }
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 px-6">
        <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7 text-success" />
        </div>
        <h3 className="text-lg font-semibold mb-1">All clear</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          No decisions require your attention. The system is monitoring continuously.
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
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{confirmation.decisionTitle}</p>
                <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                  <span className="text-[10px] flex items-center gap-1 text-muted-foreground">
                    <FileCheck className="w-3 h-3 text-success" /> Audit trail logged
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
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{decisions.length}</span>
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
              const cod = decision.costOfDelayResult;
              const rec = decision.recommendation;

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
                  <div className="flex flex-col sm:flex-row items-start gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Icon + Urgency */}
                      <div className="flex flex-col items-center gap-1.5 pt-0.5 shrink-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.badge}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${style.badge} px-1.5 py-0.5 rounded`}>
                          {decision.urgency}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-sm font-semibold leading-tight">{decision.title}</p>
                          {escalation !== "fresh" && (
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded flex items-center gap-1 ${escConfig.badgeClass}`}>
                              <escConfig.icon className="w-2.5 h-2.5" />
                              {escConfig.label}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-2">{decision.context}</p>

                        {/* Structured Cost of Delay */}
                        <div className="flex items-start gap-2 mb-2.5 p-2.5 rounded-lg bg-background/80 border border-border/20">
                          <AlertTriangle className={`w-3 h-3 mt-0.5 shrink-0 ${
                            cod.label === "critical" ? "text-destructive" :
                            cod.label === "high" ? "text-warning" : "text-muted-foreground"
                          }`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Cost of Delay
                              </span>
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${COD_LABEL_STYLES[cod.label]}`}>
                                {cod.label}
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {cod.score}/100
                              </span>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-xs font-semibold text-foreground">{cod.estimatedDelayCost}</span>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <CalendarDays className="w-2.5 h-2.5" />
                                Act within {cod.recommendedActionWindowDays}d
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{cod.reason}</p>
                          </div>
                        </div>

                        {/* Metadata badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-3">
                          <span className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded">
                            {decision.source}
                          </span>
                          {decision.confidence != null && (
                            <span className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded flex items-center gap-1">
                              <ConfidenceBadge confidence={decision.confidence} showDetails /> confidence
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

                        {/* Structured Recommendation */}
                        <div className="p-2.5 rounded-lg bg-background/60 border border-border/30 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              AI Recommendation
                            </p>
                            {rec.qualityScore && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                rec.qualityScore.grade === "A" || rec.qualityScore.grade === "B"
                                  ? "bg-success/10 text-success"
                                  : rec.qualityScore.grade === "C"
                                  ? "bg-warning/10 text-warning"
                                  : "bg-destructive/10 text-destructive"
                              }`}>
                                Quality: {rec.qualityScore.grade} ({rec.qualityScore.overall}/100)
                              </span>
                            )}
                          </div>
                          {rec.qualityScore && !rec.qualityScore.isDecisionGrade && (
                            <div className="flex items-center gap-1.5 p-1.5 rounded bg-warning/5 border border-warning/20">
                              <AlertTriangle className="w-3 h-3 text-warning shrink-0" />
                              <p className="text-[9px] text-warning">
                                Below decision-grade threshold. {rec.qualityScore.downgradeReason}
                              </p>
                            </div>
                          )}
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground"><span className="font-semibold text-foreground">What happened:</span> {rec.whatHappened}</p>
                            <p className="text-[10px] text-muted-foreground"><span className="font-semibold text-foreground">Why it matters:</span> {rec.whyItMatters}</p>
                            <p className="text-[10px] text-muted-foreground"><span className="font-semibold text-foreground">Action:</span> {rec.recommendedAction}</p>
                            {rec.assumptions && rec.assumptions.length > 0 && (
                              <p className="text-[10px] text-muted-foreground"><span className="font-semibold text-foreground">Assumptions:</span> {rec.assumptions.slice(0, 2).join("; ")}</p>
                            )}
                            {rec.riskIfWrong && (
                              <p className="text-[10px] text-muted-foreground"><span className="font-semibold text-foreground">Risk if wrong:</span> {rec.riskIfWrong}</p>
                            )}
                            {rec.confidenceBasis && (
                              <p className="text-[10px] text-muted-foreground italic">
                                {rec.confidenceBasis.label}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-4 flex-wrap pt-1 border-t border-border/20">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <User className="w-2.5 h-2.5" /> <span className="font-semibold text-foreground">Owner:</span> {rec.suggestedOwner}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <CalendarDays className="w-2.5 h-2.5" /> {rec.suggestedDeadlineDays}d deadline
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Target className="w-2.5 h-2.5" /> <span className="font-semibold text-foreground">Success:</span> {rec.successMetrics.slice(0, 2).join("; ")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex sm:flex-col gap-1.5 shrink-0 w-full sm:w-auto">
                      <button
                        onClick={() => handleApprove(decision)}
                        disabled={isActing}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleDismiss(decision)}
                        disabled={isActing}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3 h-3" />
                        Dismiss
                      </button>
                      <button
                        onClick={() => setModifyTarget(decision)}
                        disabled={isActing}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50"
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

      <ModifyDecisionDialog
        decision={modifyTarget}
        organizationId={organizationId}
        open={!!modifyTarget}
        onOpenChange={(open) => { if (!open) setModifyTarget(null); }}
        onSaved={handleModifySaved}
      />
    </div>
  );
});

DecisionQueue.displayName = "DecisionQueue";

export default DecisionQueue;

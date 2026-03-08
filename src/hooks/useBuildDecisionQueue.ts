import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeCostOfDelay, type CostOfDelayResult, type CostOfDelayInput } from "@/lib/cost-of-delay";
import { generateRecommendation, type StructuredRecommendation } from "@/lib/decision-recommendation";
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
  costOfDelayResult: CostOfDelayResult;
  recommendation: StructuredRecommendation;
  rawConfidence?: number | null;
  cappedConfidence?: number | null;
  confidenceCapReason?: string | null;
  generatedAt: string;
  sampleSize?: number;
  /** Dataset this decision originated from (for ledger provenance) */
  sourceDatasetId?: string | null;
}

interface UseBuildDecisionQueueArgs {
  organizationId: string;
  insights: Insight[];
  churnRate: number;
  revenue: number;
  pendingDecisions: number;
  calibrationScore: number | null;
  datasetId?: string;
}

function ageDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
}

export function useBuildDecisionQueue({
  organizationId,
  insights,
  churnRate,
  revenue,
  pendingDecisions,
  calibrationScore,
  datasetId,
}: UseBuildDecisionQueueArgs) {
  const [decisions, setDecisions] = useState<EnrichedDecision[]>([]);
  const [loading, setLoading] = useState(true);

  // Debounce ref
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const criticalInsights = useMemo(
    () => insights.filter(i => i.severity === "high"),
    [insights]
  );

  const buildQueue = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const queue: EnrichedDecision[] = [];
    const now = new Date().toISOString();

    // Track advisory source signal IDs for deduplication
    const advisorySourceSignalIds = new Set<string>();

    // 1. Open advisories (fetch first to build dedup set)
    let advisoryQuery = supabase
      .from("advisory_instances")
      .select("id, title, action, priority, confidence, capped_confidence, confidence_cap_reason, category, timeframe, expected_impact, created_at, raw_confidence, impact_score, dataset_id")
      .eq("organization_id", organizationId)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(3);

    if (datasetId) {
      advisoryQuery = advisoryQuery.eq("dataset_id", datasetId);
    }

    const { data: advisories } = await advisoryQuery;

    advisories?.forEach(adv => {
      // Track for dedup (advisory IDs could match signal IDs if spawned from them)
      if (adv.id) advisorySourceSignalIds.add(adv.id);

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
        sampleSize: undefined, // advisories don't carry sample_size directly
        datasetId: adv.dataset_id ?? datasetId,
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
        sourceDatasetId: adv.dataset_id ?? datasetId ?? null,
      });
    });

    // 2. Critical signals (skip if already covered by an advisory)
    criticalInsights
      .filter(insight => !advisorySourceSignalIds.has(insight.id))
      .slice(0, 2)
      .forEach(insight => {
        const severity: "critical" | "high" = "critical";
        const age = ageDays(insight.created_at);

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
          trendDirection: (insight.message?.toLowerCase().includes("decline") || insight.message?.toLowerCase().includes("drop")) ? "down" : "stable",
          severity,
          confidence: insight.confidence_score ?? null,
          message: insight.message,
          category: insight.category,
          sampleSize: (insight as any).sample_size ?? undefined,
          datasetId: datasetId,
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
          sampleSize: (insight as any).sample_size ?? undefined,
        });
      });

    // 3. Pending outcomes (org-scoped by design — institutional memory)
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
          sampleSize: 0,
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

    // 4. Proactive: churn (heuristic — labeled)
    if (churnRate > 5 && queue.length < 5) {
      const sev: CostOfDelayInput["severity"] = churnRate > 12 ? "critical" : churnRate > 8 ? "high" : "medium";
      const heuristicConf = Math.min(60, Math.round(40 + churnRate));

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
        sampleSize: 0,
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
        sampleSize: 0, // No sample — heuristic
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
        sampleSize: 0,
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
        sampleSize: 0, // No sample — calibration metric
      });
    }

    queue.sort((a, b) => {
      if (b.costOfDelayResult.score !== a.costOfDelayResult.score) {
        return b.costOfDelayResult.score - a.costOfDelayResult.score;
      }
      const urgencyOrder = { critical: 0, high: 1, medium: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });

    setDecisions(queue.slice(0, 5));
    setLoading(false);
  }, [organizationId, criticalInsights, churnRate, revenue, pendingDecisions, calibrationScore, datasetId]);

  // Debounced effect — 200ms
  useEffect(() => {
    if (!organizationId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      buildQueue();
    }, 200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [buildQueue]);

  return { decisions, setDecisions, loading };
}

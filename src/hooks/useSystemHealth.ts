import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SystemHealthMetrics {
  totalDecisions: number;
  completedDecisions: number;
  evaluatedOutcomes: number;
  pendingOutcomes: number;
  closedLoopRate: number;
  calibrationScore: number | null;
  calibrationModelVersion: number | null;
  latestCalibrationAt: string | null;
  biasDirection: string | null;
  openAdvisories: number;
  insightsLast24h: number;
  avgConfidence: number | null;
}

export const useSystemHealth = (orgId: string | null) => {
  const [health, setHealth] = useState<SystemHealthMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchHealth = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);

    try {
      // Batch all queries in parallel
      const [
        decisionsRes,
        outcomesRes,
        calibrationRes,
        advisoriesRes,
        insightsRes,
      ] = await Promise.all([
        supabase
          .from("decision_ledger")
          .select("id, execution_status, capped_confidence", { count: "exact", head: false })
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("decision_outcomes")
          .select("id, outcome_status", { count: "exact", head: false })
          .eq("organization_id", orgId)
          .limit(1000),
        supabase
          .from("calibration_models")
          .select("overall_calibration_score, model_version, overall_bias_direction, computed_at")
          .eq("organization_id", orgId)
          .order("computed_at", { ascending: false })
          .limit(1),
        supabase
          .from("advisory_instances")
          .select("id")
          .eq("organization_id", orgId)
          .eq("status", "open"),
        supabase
          .from("insights")
          .select("id")
          .eq("organization_id", orgId)
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const decisions = decisionsRes.data || [];
      const outcomes = outcomesRes.data || [];
      const calModel = calibrationRes.data?.[0];

      const totalDecisions = decisions.length;
      const completedDecisions = decisions.filter(d => d.execution_status === "completed").length;
      const evaluatedOutcomes = outcomes.filter(o => o.outcome_status !== "pending").length;
      const pendingOutcomes = outcomes.filter(o => o.outcome_status === "pending").length;

      const closedLoopRate = totalDecisions > 0
        ? (evaluatedOutcomes / totalDecisions) * 100
        : 0;

      const confidenceValues = decisions
        .map(d => d.capped_confidence)
        .filter((v): v is number => v !== null);
      const avgConfidence = confidenceValues.length > 0
        ? confidenceValues.reduce((s, v) => s + v, 0) / confidenceValues.length
        : null;

      setHealth({
        totalDecisions,
        completedDecisions,
        evaluatedOutcomes,
        pendingOutcomes,
        closedLoopRate: Math.round(closedLoopRate * 10) / 10,
        calibrationScore: calModel?.overall_calibration_score ?? null,
        calibrationModelVersion: calModel?.model_version ?? null,
        latestCalibrationAt: calModel?.computed_at ?? null,
        biasDirection: calModel?.overall_bias_direction ?? null,
        openAdvisories: advisoriesRes.data?.length ?? 0,
        insightsLast24h: insightsRes.data?.length ?? 0,
        avgConfidence: avgConfidence ? Math.round(avgConfidence * 10) / 10 : null,
      });
    } catch (err) {
      console.error("System health fetch error:", err);
    }

    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return { health, loading, refresh: fetchHealth };
};

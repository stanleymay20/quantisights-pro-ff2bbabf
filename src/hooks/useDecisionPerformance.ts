import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MetricBreakdown {
  metric: string;
  total: number;
  successRate: number;
  avgAccuracy: number | null;
}

export interface DecisionPerformance {
  totalDecisions: number;
  evaluableDecisions: number;
  successCount: number;
  successRate: number | null;
  negativeCount: number;
  falsePositiveRate: number | null;
  avgAccuracy: number | null;
  calibrationGap: number | null;
  metricBreakdown: MetricBreakdown[];
  learnings: string[];
}

export const useDecisionPerformance = (orgId: string | null) => {
  const [performance, setPerformance] = useState<DecisionPerformance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      const { data, error: fnErr } = await supabase.functions.invoke("evaluate-outcomes", {
        body: { action: "performance", organization_id: orgId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (fnErr) {
        setError(fnErr.message);
      } else if (data) {
        setPerformance({
          totalDecisions: data.total_decisions ?? 0,
          evaluableDecisions: data.evaluable_decisions ?? 0,
          successCount: data.success_count ?? 0,
          successRate: data.success_rate ?? null,
          negativeCount: data.negative_count ?? 0,
          falsePositiveRate: data.false_positive_rate ?? null,
          avgAccuracy: data.avg_accuracy ?? null,
          calibrationGap: data.calibration_gap ?? null,
          metricBreakdown: data.metric_breakdown ?? [],
          learnings: data.learnings ?? [],
        });
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  return { performance, loading, error, refresh: fetchPerformance };
};

export const scheduleOutcomeEvaluation = async (params: {
  organizationId: string;
  decisionId: string;
  datasetId?: string;
  expectedMetric: string;
  expectedDirection?: string;
  expectedChange?: number;
  evaluationWindowDays?: number;
}) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("evaluate-outcomes", {
    body: {
      action: "schedule",
      organization_id: params.organizationId,
      decision_id: params.decisionId,
      dataset_id: params.datasetId,
      expected_metric: params.expectedMetric,
      expected_direction: params.expectedDirection || "increase",
      expected_change: params.expectedChange,
      evaluation_window_days: params.evaluationWindowDays || 30,
    },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) throw error;
  return data;
};

export const getReliabilityIndex = async (orgId: string, metricType: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("evaluate-outcomes", {
    body: { action: "reliability", organization_id: orgId, metric_type: metricType },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) throw error;
  return data as { metric_type: string; similar_decisions: number; reliability_index: number | null; note: string };
};

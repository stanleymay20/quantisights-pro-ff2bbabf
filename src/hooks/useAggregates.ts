import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MetricAggregate {
  id: string;
  metric_type: string;
  period_type: string;
  period_start: string;
  region: string;
  segment: string;
  agg_sum: number;
  agg_count: number;
  agg_min: number | null;
  agg_max: number | null;
  agg_avg: number | null;
  computed_at: string;
}

/**
 * Hook to read pre-computed metric aggregates — REQUIRES dataset_id (Active Data Contract).
 */
export const useAggregates = (
  orgId: string | null,
  datasetId: string | null,
  periodType: string = "monthly"
) => {
  const [aggregates, setAggregates] = useState<MetricAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAggregates, setHasAggregates] = useState(false);

  const fetchAggregates = useCallback(async () => {
    if (!orgId || !datasetId) {
      setAggregates([]);
      setLoading(false);
      setHasAggregates(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("metric_aggregates")
      .select("*")
      .eq("organization_id", orgId)
      .eq("dataset_id", datasetId)
      .eq("period_type", periodType)
      .order("period_start", { ascending: true });

    if (!error && data) {
      setAggregates(data as MetricAggregate[]);
      setHasAggregates(data.length > 0);
    }
    setLoading(false);
  }, [orgId, datasetId, periodType]);

  useEffect(() => {
    fetchAggregates();
  }, [fetchAggregates]);

  // Derived KPIs from aggregates
  const totalByMetric = (metricType: string) =>
    aggregates
      .filter((a) => a.metric_type === metricType)
      .reduce((sum, a) => sum + Number(a.agg_sum), 0);

  const latestByMetric = (metricType: string) => {
    const sorted = aggregates
      .filter((a) => a.metric_type === metricType)
      .sort((a, b) => b.period_start.localeCompare(a.period_start));
    return sorted[0]?.agg_avg ?? null;
  };

  const timeSeriesByMetric = (metricType: string) =>
    aggregates
      .filter((a) => a.metric_type === metricType)
      .map((a) => ({
        period: a.period_start,
        label: new Date(a.period_start).toLocaleDateString("en", { month: "short", year: "2-digit" }),
        value: Number(a.agg_sum),
        avg: Number(a.agg_avg ?? 0),
        count: a.agg_count,
      }));

  return {
    aggregates,
    loading,
    hasAggregates,
    totalByMetric,
    latestByMetric,
    timeSeriesByMetric,
    refresh: fetchAggregates,
  };
};

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MetricRow {
  id: string;
  metric_type: string;
  value: number;
  date: string;
  region: string | null;
  segment: string | null;
}

export const useMetrics = (orgId: string | null) => {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) {
      setMetrics([]);
      setLoading(false);
      setLastUpdated(null);
      return;
    }

    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("metrics")
        .select("id, metric_type, value, date, region, segment, created_at")
        .eq("organization_id", orgId)
        .order("date", { ascending: true });

      if (!error && data) {
        setMetrics(data);
        // Track most recent metric ingestion timestamp
        const latest = data.reduce((max, m) => {
          const t = (m as any).created_at;
          return t && t > max ? t : max;
        }, "");
        setLastUpdated(latest || null);
      }
      setLoading(false);
    };

    fetch();
  }, [orgId]);

  // Derived KPIs
  const totalRevenue = metrics
    .filter((m) => m.metric_type === "revenue")
    .reduce((s, m) => s + Number(m.value), 0);

  const totalCustomers = metrics
    .filter((m) => m.metric_type === "customers")
    .reduce((s, m) => s + Number(m.value), 0);

  const latestCost = metrics.filter((m) => m.metric_type === "cost").slice(-1)[0]?.value ?? 0;
  const latestChurn = metrics.filter((m) => m.metric_type === "churn").slice(-1)[0]?.value ?? 0;

  const revenueByMonth = metrics
    .filter((m) => m.metric_type === "revenue")
    .map((m) => ({
      month: new Date(m.date).toLocaleDateString("en", { month: "short" }),
      revenue: Number(m.value),
    }));

  const segmentData = metrics
    .filter((m) => m.metric_type === "revenue" && m.segment)
    .reduce<Record<string, number>>((acc, m) => {
      acc[m.segment!] = (acc[m.segment!] || 0) + Number(m.value);
      return acc;
    }, {});

  return {
    metrics,
    loading,
    lastUpdated,
    totalRevenue,
    totalCustomers,
    latestCost,
    latestChurn,
    revenueByMonth,
    segmentData,
    hasData: metrics.length > 0,
  };
};

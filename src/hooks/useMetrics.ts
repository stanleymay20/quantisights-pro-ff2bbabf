import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { TierKey } from "@/lib/stripe-tiers";

export interface MetricRow {
  id: string;
  metric_type: string;
  value: number;
  date: string;
  region: string | null;
  segment: string | null;
}

const REALTIME_TIERS: TierKey[] = ["growth", "enterprise"];

export const useMetrics = (orgId: string | null) => {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const { subscribed, tier } = useSubscription();

  const canStream = subscribed && tier ? REALTIME_TIERS.includes(tier) : false;

  const updateLastUpdated = useCallback((data: any[]) => {
    const latest = data.reduce((max, m) => {
      const t = (m as any).created_at;
      return t && t > max ? t : max;
    }, "");
    setLastUpdated(latest || null);
  }, []);

  // Initial fetch
  useEffect(() => {
    if (!orgId) {
      setMetrics([]);
      setLoading(false);
      setLastUpdated(null);
      return;
    }

    const fetchMetrics = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("metrics")
        .select("id, metric_type, value, date, region, segment, created_at")
        .eq("organization_id", orgId)
        .order("date", { ascending: true });

      if (!error && data) {
        setMetrics(data);
        updateLastUpdated(data);
      }
      setLoading(false);
    };

    fetchMetrics();
  }, [orgId, updateLastUpdated]);

  // Realtime subscription (Growth+ only)
  useEffect(() => {
    if (!orgId || !canStream) {
      setIsStreaming(false);
      return;
    }

    const channel = supabase
      .channel(`metrics-live-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "metrics",
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          const newRow = payload.new as MetricRow & { created_at?: string };
          setMetrics((prev) => {
            const updated = [...prev, newRow].sort(
              (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );
            return updated;
          });
          setLastUpdated(newRow.created_at || new Date().toISOString());
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "metrics",
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          const updated = payload.new as MetricRow;
          setMetrics((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "metrics",
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          const deleted = payload.old as { id: string };
          setMetrics((prev) => prev.filter((m) => m.id !== deleted.id));
        }
      )
      .subscribe((status) => {
        setIsStreaming(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
      setIsStreaming(false);
    };
  }, [orgId, canStream]);

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
    isStreaming,
    canStream,
    totalRevenue,
    totalCustomers,
    latestCost,
    latestChurn,
    revenueByMonth,
    segmentData,
    hasData: metrics.length > 0,
  };
};

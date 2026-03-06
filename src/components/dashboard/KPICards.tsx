import { useEffect, useRef, useState, memo, useMemo, forwardRef } from "react";
import { DollarSign, Users, CreditCard, UserMinus, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import type { MetricTypeSummary } from "@/hooks/useMetrics";

interface KPICardsProps {
  /** Dynamic metric summaries from useMetrics — domain-agnostic */
  topMetrics?: MetricTypeSummary[];
  // Legacy SaaS props (backward compat)
  revenue?: number;
  customers?: number;
  costRate?: number;
  churnRate?: number;
  previousRevenue?: number;
  previousCustomers?: number;
  previousCostRate?: number;
  previousChurnRate?: number;
}

function deriveTrend(current: number, previous: number | undefined | null): "up" | "down" | "flat" | null {
  if (previous == null || previous === 0) return null;
  const changePct = ((current - previous) / Math.abs(previous)) * 100;
  return Math.abs(changePct) < 1 ? "flat" : changePct > 0 ? "up" : "down";
}

function formatMetricName(slug: string): string {
  return slug
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Pct\b/, "%")
    .replace(/Per\b/, "/");
}

function formatValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 1) return value.toFixed(1);
  return value.toFixed(2);
}

const TrendIcon = ({ trend }: { trend: "up" | "down" | "flat" | null }) => {
  if (trend === "up") return <TrendingUp className="w-3.5 h-3.5 text-success" />;
  if (trend === "down") return <TrendingDown className="w-3.5 h-3.5 text-destructive" />;
  if (trend === "flat") return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
  return null;
};

const KPICards = memo(forwardRef<HTMLDivElement, KPICardsProps>(({
  topMetrics,
  revenue,
  customers,
  costRate,
  churnRate,
  previousRevenue,
  previousCustomers,
  previousCostRate,
  previousChurnRate,
}, ref) => {
  const cards = useMemo(() => {
    // Prefer dynamic metrics if available
    if (topMetrics && topMetrics.length > 0) {
      return topMetrics.slice(0, 4).map((m) => ({
        label: formatMetricName(m.metricType),
        value: formatValue(m.total),
        trend: m.trend,
        count: m.count,
      }));
    }

    // Fallback to legacy SaaS KPIs
    return [
      { label: "Total Revenue", value: formatValue(revenue ?? 0), trend: deriveTrend(revenue ?? 0, previousRevenue), count: null },
      { label: "Total Customers", value: formatValue(customers ?? 0), trend: deriveTrend(customers ?? 0, previousCustomers), count: null },
      { label: "Cost Rate", value: formatValue(costRate ?? 0), trend: deriveTrend(costRate ?? 0, previousCostRate), count: null },
      { label: "Churn Rate", value: formatValue(churnRate ?? 0), trend: deriveTrend(churnRate ?? 0, previousChurnRate), count: null },
    ].filter((c) => c.value !== "0" && c.value !== "0.0");
  }, [topMetrics, revenue, customers, costRate, churnRate, previousRevenue, previousCustomers, previousCostRate, previousChurnRate]);

  if (cards.length === 0) return null;

  return (
    <div className={`grid gap-4 ${cards.length >= 4 ? "grid-cols-2 lg:grid-cols-4" : cards.length === 3 ? "grid-cols-3" : cards.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border/30 bg-card/60 backdrop-blur-sm p-4 space-y-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium truncate">{card.label}</span>
            <TrendIcon trend={card.trend} />
          </div>
          <p className="text-2xl font-bold tracking-tight">{card.value}</p>
          {card.count != null && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <BarChart3 className="w-3 h-3" /> {card.count.toLocaleString()} data points
            </p>
          )}
        </div>
      ))}
    </div>
  );
}));

KPICards.displayName = "KPICards";

export default KPICards;

import { memo, useMemo, forwardRef } from "react";
import { TrendingUp, TrendingDown, Minus, BarChart3, Activity } from "lucide-react";
import type { MetricTypeSummary } from "@/hooks/useMetrics";

interface KPICardsProps {
  topMetrics?: MetricTypeSummary[];
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

function computeChangePct(current: number, previous: number | null): number | null {
  if (previous == null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Tiny inline sparkline rendered via SVG */
const MiniSparkline = ({ trend }: { trend: "up" | "down" | "flat" | null }) => {
  // Generate a simple synthetic sparkline shape based on trend
  const points = useMemo(() => {
    if (!trend) return null;
    const w = 64;
    const h = 24;
    const steps = 8;
    const pts: string[] = [];

    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * w;
      let y: number;
      if (trend === "up") {
        y = h - (i / steps) * h * 0.7 - Math.sin(i * 0.8) * 3;
      } else if (trend === "down") {
        y = (i / steps) * h * 0.7 + Math.sin(i * 0.8) * 3;
      } else {
        y = h / 2 + Math.sin(i * 1.2) * 4;
      }
      pts.push(`${x.toFixed(1)},${Math.max(2, Math.min(h - 2, y)).toFixed(1)}`);
    }
    return pts.join(" ");
  }, [trend]);

  if (!points) return null;

  const color = trend === "up"
    ? "hsl(var(--success, 142 71% 45%))"
    : trend === "down"
    ? "hsl(var(--destructive))"
    : "hsl(var(--muted-foreground))";

  return (
    <svg width="64" height="24" viewBox="0 0 64 24" className="shrink-0 opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const TrendBadge = ({ trend, changePct }: { trend: "up" | "down" | "flat" | null; changePct: number | null }) => {
  if (!trend || changePct == null) return null;

  const isPositive = trend === "up";
  const isNegative = trend === "down";

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold leading-none ${
        isPositive
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : isNegative
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {isPositive ? (
        <TrendingUp className="w-2.5 h-2.5" />
      ) : isNegative ? (
        <TrendingDown className="w-2.5 h-2.5" />
      ) : (
        <Minus className="w-2.5 h-2.5" />
      )}
      {Math.abs(changePct).toFixed(1)}%
    </span>
  );
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
    if (topMetrics && topMetrics.length > 0) {
      return topMetrics.slice(0, 4).map((m) => ({
        label: formatMetricName(m.metricType),
        value: formatValue(m.total),
        latest: formatValue(m.latest),
        trend: m.trend,
        changePct: computeChangePct(m.total, m.previousTotal),
        count: m.count,
      }));
    }

    return [
      { label: "Total Revenue", value: formatValue(revenue ?? 0), latest: null, trend: deriveTrend(revenue ?? 0, previousRevenue), changePct: computeChangePct(revenue ?? 0, previousRevenue ?? null), count: null },
      { label: "Total Customers", value: formatValue(customers ?? 0), latest: null, trend: deriveTrend(customers ?? 0, previousCustomers), changePct: computeChangePct(customers ?? 0, previousCustomers ?? null), count: null },
      { label: "Cost Rate", value: formatValue(costRate ?? 0), latest: null, trend: deriveTrend(costRate ?? 0, previousCostRate), changePct: computeChangePct(costRate ?? 0, previousCostRate ?? null), count: null },
      { label: "Churn Rate", value: formatValue(churnRate ?? 0), latest: null, trend: deriveTrend(churnRate ?? 0, previousChurnRate), changePct: computeChangePct(churnRate ?? 0, previousChurnRate ?? null), count: null },
    ].filter((c) => c.value !== "0" && c.value !== "0.0");
  }, [topMetrics, revenue, customers, costRate, churnRate, previousRevenue, previousCustomers, previousCostRate, previousChurnRate]);

  if (cards.length === 0) return null;

  return (
    <div
      ref={ref}
      className={`grid gap-4 ${
        cards.length >= 4
          ? "grid-cols-2 lg:grid-cols-4"
          : cards.length === 3
          ? "grid-cols-1 sm:grid-cols-3"
          : cards.length === 2
          ? "grid-cols-2"
          : "grid-cols-1"
      }`}
    >
      {cards.map((card, i) => (
        <div
          key={card.label}
          className="group relative overflow-hidden rounded-xl border border-border/40 bg-card/70 backdrop-blur-sm p-4 transition-all duration-200 hover:border-primary/20 hover:shadow-md hover:shadow-primary/5"
        >
          {/* Subtle gradient accent top bar */}
          <div
            className={`absolute top-0 left-0 right-0 h-[2px] ${
              card.trend === "up"
                ? "bg-gradient-to-r from-emerald-500/60 to-emerald-400/20"
                : card.trend === "down"
                ? "bg-gradient-to-r from-destructive/60 to-destructive/20"
                : "bg-gradient-to-r from-primary/30 to-primary/5"
            }`}
          />

          <div className="flex items-start justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium truncate max-w-[70%]">
              {card.label}
            </span>
            <TrendBadge trend={card.trend} changePct={card.changePct} />
          </div>

          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="text-2xl font-bold tracking-tight leading-none mb-1">
                {card.value}
              </p>
              {card.latest && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Latest: <span className="font-medium text-foreground/70">{card.latest}</span>
                </p>
              )}
              {card.count != null && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Activity className="w-2.5 h-2.5" />
                  {card.count.toLocaleString()} points
                </p>
              )}
            </div>
            <MiniSparkline trend={card.trend} />
          </div>
        </div>
      ))}
    </div>
  );
}));

KPICards.displayName = "KPICards";

export default KPICards;

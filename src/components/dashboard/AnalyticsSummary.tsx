import { useMemo } from "react";
import { Brain, TrendingDown, TrendingUp, Minus, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  revenueByMonth: { month: string; revenue: number }[];
  metrics: { metric_type: string; value: number }[];
  latestChurn: number;
  latestCost: number;
}

/**
 * Human-readable narrative summary above analytics charts.
 * Translates raw data into CEO-level plain English.
 */
const AnalyticsSummary = ({ revenueByMonth, metrics, latestChurn, latestCost }: Props) => {
  const narrative = useMemo(() => {
    const lines: { icon: typeof TrendingUp; text: string; severity: "ok" | "warn" | "critical" }[] = [];

    // Revenue trend
    if (revenueByMonth.length >= 3) {
      const recent = revenueByMonth.slice(-3);
      const first = recent[0].revenue;
      const last = recent[recent.length - 1].revenue;
      const delta = first > 0 ? ((last - first) / first) * 100 : 0;

      if (delta > 5) {
        lines.push({ icon: TrendingUp, text: `Revenue growing ${delta.toFixed(1)}% over last ${recent.length} periods — positive momentum.`, severity: "ok" });
      } else if (delta < -5) {
        lines.push({ icon: TrendingDown, text: `Revenue declining ${Math.abs(delta).toFixed(1)}% — early warning of weakening demand.`, severity: "critical" });
      } else {
        lines.push({ icon: Minus, text: "Revenue is flat — growth has stalled, investigate pipeline.", severity: "warn" });
      }
    }

    // Profitability
    const totalRevenue = metrics.filter(m => m.metric_type === "revenue").reduce((s, m) => s + Number(m.value), 0);
    const totalCost = metrics.filter(m => m.metric_type === "cost").reduce((s, m) => s + Number(m.value), 0);
    const cogs = metrics.filter(m => m.metric_type === "cogs").reduce((s, m) => s + Number(m.value), 0);
    const opex = metrics.filter(m => m.metric_type === "opex").reduce((s, m) => s + Number(m.value), 0);
    const effectiveCost = totalCost || (cogs + opex);

    if (totalRevenue > 0 && effectiveCost > 0) {
      const margin = ((totalRevenue - effectiveCost) / totalRevenue) * 100;
      const hasSplit = cogs > 0 || opex > 0;

      if (margin > 20) {
        lines.push({ icon: TrendingUp, text: `Profitable at ${margin.toFixed(0)}% margin${!hasSplit ? " — cost breakdown unavailable, margin insights limited" : ""}.`, severity: hasSplit ? "ok" : "warn" });
      } else if (margin > 0) {
        lines.push({ icon: AlertTriangle, text: `Thin margins at ${margin.toFixed(0)}%${!hasSplit ? " — unable to assess whether growth is efficient without cost split" : " — operating leverage needs attention"}.`, severity: "warn" });
      } else {
        lines.push({ icon: TrendingDown, text: `Operating at a loss (${margin.toFixed(0)}% margin) — immediate cost review required.`, severity: "critical" });
      }
    }

    // Churn
    if (latestChurn > 0) {
      if (latestChurn > 0.05) {
        lines.push({ icon: TrendingDown, text: `Churn at ${(latestChurn * 100).toFixed(1)}% — retention is eroding growth gains.`, severity: "critical" });
      } else if (latestChurn > 0.02) {
        lines.push({ icon: AlertTriangle, text: `Churn at ${(latestChurn * 100).toFixed(1)}% — within tolerance but worth monitoring.`, severity: "warn" });
      }
    }

    return lines;
  }, [revenueByMonth, metrics, latestChurn, latestCost]);

  if (narrative.length === 0) return null;

  const severityColor = {
    ok: "text-[hsl(var(--success))]",
    warn: "text-[hsl(var(--warning))]",
    critical: "text-destructive",
  };

  const severityBg = {
    ok: "bg-[hsl(var(--success))]/10",
    warn: "bg-[hsl(var(--warning))]/10",
    critical: "bg-destructive/10",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-border/60 bg-card p-4 space-y-2"
    >
      <div className="flex items-center gap-2 mb-1">
        <Brain className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Intelligence Summary</h3>
      </div>
      {narrative.map((line, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${severityBg[line.severity]}`}>
            <line.icon className={`w-3 h-3 ${severityColor[line.severity]}`} />
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{line.text}</p>
        </div>
      ))}
    </motion.div>
  );
};

export default AnalyticsSummary;

import { useMemo } from "react";
import { Brain, TrendingDown, TrendingUp, Minus, AlertTriangle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/lib/chart-config";

interface Props {
  revenueByMonth: { month: string; revenue: number }[];
  metrics: { metric_type: string; value: number }[];
  latestChurn: number;
  latestCost: number;
}

/**
 * CEO-level narrative summary — "Explain Like a CEO" intelligence block.
 * Translates raw data into plain English with actionable recommendations.
 */
const AnalyticsSummary = ({ revenueByMonth, metrics, latestChurn, latestCost }: Props) => {
  const { narrative, headline, headlineSeverity } = useMemo(() => {
    const lines: { icon: typeof TrendingUp; text: string; severity: "ok" | "warn" | "critical"; action?: { label: string; href: string } }[] = [];

    // Revenue trend
    let revDelta = 0;
    if (revenueByMonth.length >= 3) {
      const recent = revenueByMonth.slice(-3);
      const first = recent[0].revenue;
      const last = recent[recent.length - 1].revenue;
      revDelta = first > 0 ? ((last - first) / first) * 100 : 0;

      if (revDelta > 5) {
        lines.push({
          icon: TrendingUp,
          text: `Revenue is growing ${revDelta.toFixed(1)}% over the last ${recent.length} periods — positive momentum that supports continued investment.`,
          severity: "ok",
        });
      } else if (revDelta < -5) {
        lines.push({
          icon: TrendingDown,
          text: `Revenue has declined ${Math.abs(revDelta).toFixed(1)}% — this signals weakening demand. Investigate whether it's a market shift, pricing issue, or churn problem.`,
          severity: "critical",
          action: { label: "Run scenario analysis →", href: "/scenarios" },
        });
      } else {
        lines.push({
          icon: Minus,
          text: "Revenue is flat — growth has stalled. This typically means either the market is saturated at this price point, or acquisition channels need refreshing.",
          severity: "warn",
          action: { label: "Explore growth scenarios →", href: "/scenarios" },
        });
      }
    }

    // Profitability — human-readable
    const totalRevenue = metrics.filter(m => m.metric_type === "revenue").reduce((s, m) => s + Number(m.value), 0);
    const totalCost = metrics.filter(m => m.metric_type === "cost").reduce((s, m) => s + Number(m.value), 0);
    const cogs = metrics.filter(m => m.metric_type === "cogs").reduce((s, m) => s + Number(m.value), 0);
    const opex = metrics.filter(m => m.metric_type === "opex").reduce((s, m) => s + Number(m.value), 0);
    const effectiveCost = totalCost || (cogs + opex);

    if (totalRevenue > 0 && effectiveCost > 0) {
      const margin = ((totalRevenue - effectiveCost) / totalRevenue) * 100;
      const hasSplit = cogs > 0 || opex > 0;

      if (margin > 20) {
        lines.push({
          icon: TrendingUp,
          text: `The business is profitable at ${margin.toFixed(0)}% margin (${formatCurrency(totalRevenue - effectiveCost)} retained from ${formatCurrency(totalRevenue)} revenue).${!hasSplit ? " Note: costs are not broken down — we cannot tell where money is being spent most." : ""}`,
          severity: hasSplit ? "ok" : "warn",
        });
      } else if (margin > 0) {
        lines.push({
          icon: AlertTriangle,
          text: `Margins are thin at ${margin.toFixed(0)}%.${!hasSplit ? " We cannot identify cost drivers because cost data is not broken down into categories (e.g., production vs operations)." : " Operating leverage needs attention — small revenue dips could erase profitability."}`,
          severity: "warn",
          action: { label: "Review cost structure →", href: "/diagnostics" },
        });
      } else {
        lines.push({
          icon: TrendingDown,
          text: `The business is operating at a loss (${margin.toFixed(0)}% margin). Every ${formatCurrency(100)} earned costs ${formatCurrency(Math.round(100 + Math.abs(margin)))} to produce. Immediate cost reduction or revenue acceleration is required.`,
          severity: "critical",
          action: { label: "Run cost diagnostics →", href: "/diagnostics" },
        });
      }
    }

    // Churn — contextual explanation
    if (latestChurn > 0) {
      if (latestChurn > 5) {
        lines.push({
          icon: TrendingDown,
          text: `Customer churn is ${latestChurn.toFixed(1)}% — this means for every 100 customers, ${Math.round(latestChurn)} leave each period. At this rate, retention is actively eroding growth gains.`,
          severity: "critical",
          action: { label: "Investigate churn drivers →", href: "/diagnostics" },
        });
      } else if (latestChurn > 2) {
        lines.push({
          icon: AlertTriangle,
          text: `Churn at ${latestChurn.toFixed(1)}% is within acceptable range but worth monitoring. If it rises above 5%, it will start negating new customer acquisition.`,
          severity: "warn",
        });
      }
    }

    // Build headline
    const criticalCount = lines.filter(l => l.severity === "critical").length;
    const warnCount = lines.filter(l => l.severity === "warn").length;

    let headline = "";
    let headlineSeverity: "ok" | "warn" | "critical" = "ok";

    if (criticalCount > 0) {
      headline = revDelta < -5
        ? "Revenue is declining while costs remain stable — margin pressure is building."
        : "There are critical metrics that need immediate attention.";
      headlineSeverity = "critical";
    } else if (warnCount > 0) {
      headline = "The business is stable but there are areas that could limit future growth.";
      headlineSeverity = "warn";
    } else if (lines.length > 0) {
      headline = "The business is performing well across key metrics — maintain current trajectory.";
      headlineSeverity = "ok";
    }

    return { narrative: lines, headline, headlineSeverity };
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
      className="rounded-xl border border-border/60 bg-card p-5 space-y-3"
    >
      <div className="flex items-center gap-2 mb-1">
        <Brain className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Executive Intelligence Summary</h3>
      </div>

      {/* Headline — top-line assessment */}
      {headline && (
        <p className={`text-sm font-medium leading-relaxed ${severityColor[headlineSeverity]}`}>
          {headline}
        </p>
      )}

      {/* Detail lines */}
      {narrative.map((line, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${severityBg[line.severity]}`}>
            <line.icon className={`w-3 h-3 ${severityColor[line.severity]}`} />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm text-foreground/90 leading-relaxed">{line.text}</p>
            {line.action && (
              <Link to={line.action.href} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                <ArrowRight className="w-3 h-3" />
                {line.action.label}
              </Link>
            )}
          </div>
        </div>
      ))}
    </motion.div>
  );
};

export default AnalyticsSummary;

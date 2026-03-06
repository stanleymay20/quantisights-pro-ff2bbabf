import { useMemo } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";
import { Shield, AlertTriangle } from "lucide-react";
import { MetricRow } from "@/hooks/useMetrics";
import { Link } from "react-router-dom";

interface Props {
  metrics: MetricRow[];
  latestChurn: number;
  latestCost: number;
}

/**
 * Portfolio Health Radar — DATA-HONEST.
 *
 * Previous implementation used hardcoded fallback scores (85, 70, 60, 50)
 * when data was missing, creating a fabricated health picture.
 *
 * Now: only renders dimensions for which we have REAL data.
 * No fallbacks, no fabrication.
 */
const PortfolioHealthRadar = ({ metrics, latestChurn, latestCost }: Props) => {
  const { data, missingDimensions } = useMemo(() => {
    if (metrics.length === 0) return { data: [], missingDimensions: ["All dimensions"] };

    const revenue = metrics.filter(m => m.metric_type === "revenue");
    const customers = metrics.filter(m => m.metric_type === "customers");

    const dimensions: { dimension: string; score: number; fullMark: number }[] = [];
    const missing: string[] = [];

    // Revenue Growth — only if we have ≥2 revenue data points
    if (revenue.length >= 2) {
      const growth = ((revenue[revenue.length - 1].value / (revenue[0].value || 1)) - 1) * 100;
      dimensions.push({
        dimension: "Revenue Growth",
        score: Math.round(Math.min(100, Math.max(0, growth + 50))),
        fullMark: 100,
      });
    } else {
      missing.push("Revenue Growth (need ≥2 revenue points)");
    }

    // Retention — only if churn data exists and is > 0
    if (latestChurn > 0) {
      dimensions.push({
        dimension: "Retention",
        score: Math.round(Math.max(0, 100 - latestChurn * 10)),
        fullMark: 100,
      });
    } else {
      missing.push("Retention (need churn data)");
    }

    // Cost Efficiency — only if cost data exists and is > 0
    if (latestCost > 0) {
      dimensions.push({
        dimension: "Efficiency",
        score: Math.round(Math.max(0, 100 - latestCost * 100)),
        fullMark: 100,
      });
    } else {
      missing.push("Efficiency (need cost data)");
    }

    // Margin — only if both revenue and cost exist
    if (revenue.length > 0 && latestCost > 0) {
      dimensions.push({
        dimension: "Margin",
        score: Math.round(Math.min(100, Math.max(0, (1 - latestCost) * 100))),
        fullMark: 100,
      });
    } else {
      missing.push("Margin (need revenue + cost)");
    }

    // Customer Growth — only if ≥2 customer data points
    if (customers.length >= 2) {
      const growth = ((customers[customers.length - 1].value / (customers[0].value || 1)) - 1) * 100;
      dimensions.push({
        dimension: "Customer Growth",
        score: Math.round(Math.min(100, Math.max(0, growth + 50))),
        fullMark: 100,
      });
    } else {
      missing.push("Customer Growth (need ≥2 customer points)");
    }

    return { data: dimensions, missingDimensions: missing };
  }, [metrics, latestChurn, latestCost]);

  // Need at least 3 dimensions for a meaningful radar
  if (data.length < 3) {
    return (
      <div className="glass-card p-5 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portfolio Health</h3>
        </div>
        <div className="py-4 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Insufficient dimensions ({data.length}/3 minimum)</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-2">
              The health radar requires at least 3 real data dimensions.
            </p>
            {missingDimensions.length > 0 && (
              <div className="text-left max-w-xs mx-auto space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Missing:</p>
                {missingDimensions.map(d => (
                  <p key={d} className="text-[11px] text-muted-foreground">• {d}</p>
                ))}
              </div>
            )}
          </div>
          <Link to="/data-upload" className="inline-flex text-xs font-semibold text-primary hover:underline">
            Upload Data →
          </Link>
        </div>
      </div>
    );
  }

  const avgScore = Math.round(data.reduce((s, d) => s + d.score, 0) / data.length);

  return (
    <div className="glass-card p-5 rounded-xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portfolio Health</h3>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          avgScore >= 70 ? "bg-success/10 text-success"
            : avgScore >= 50 ? "bg-warning/10 text-warning"
            : "bg-destructive/10 text-destructive"
        }`}>
          Score: {avgScore}/100 ({data.length} dimensions)
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">Based on {data.length} verified data dimensions</p>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.4} />
            <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
            <Tooltip
              contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              formatter={(v: number) => [`${v}/100`, "Score"]}
            />
            <Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PortfolioHealthRadar;

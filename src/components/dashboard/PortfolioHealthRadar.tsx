import { useMemo } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";
import { Shield, AlertTriangle } from "lucide-react";
import { MetricRow } from "@/hooks/useMetrics";
import { Link } from "react-router-dom";
import { tooltipStyle, CHART_HEIGHT } from "@/lib/chart-config";

interface Props {
  metrics: MetricRow[];
  latestChurn: number;
  latestCost: number;
}

/**
 * Portfolio Health Radar — DATA-HONEST.
 * Scoring methodology: heuristic proxies, disclosed per dimension.
 * Minimum 3 real dimensions required.
 */
const PortfolioHealthRadar = ({ metrics, latestChurn, latestCost }: Props) => {
  const { data, missingDimensions, scoringMethodology } = useMemo(() => {
    if (metrics.length === 0) return { data: [], missingDimensions: ["All dimensions"], scoringMethodology: [] };

    const revenue = metrics.filter(m => m.metric_type === "revenue");
    const customers = metrics.filter(m => m.metric_type === "customers");

    const dimensions: { dimension: string; score: number; fullMark: 100; method: string }[] = [];
    const missing: string[] = [];
    const methodology: string[] = [];

    if (revenue.length >= 2) {
      const growth = ((revenue[revenue.length - 1].value / (revenue[0].value || 1)) - 1) * 100;
      const score = Math.round(Math.min(100, Math.max(0, growth + 50)));
      const method = `Growth ${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% → ${score}/100`;
      dimensions.push({ dimension: "Revenue Growth", score, fullMark: 100, method });
      methodology.push(`Revenue Growth: ${method}`);
    } else {
      missing.push("Revenue Growth (need ≥2 points)");
    }

    if (latestChurn > 0) {
      const score = Math.round(Math.max(0, 100 - latestChurn * 10));
      const method = `Churn ${latestChurn.toFixed(1)}% → ${score}/100`;
      dimensions.push({ dimension: "Retention", score, fullMark: 100, method });
      methodology.push(`Retention: ${method}`);
    } else {
      missing.push("Retention (need churn data)");
    }

    if (latestCost > 0) {
      const score = Math.round(Math.max(0, 100 - latestCost * 100));
      const method = `Cost ratio ${(latestCost * 100).toFixed(1)}% → ${score}/100`;
      dimensions.push({ dimension: "Efficiency", score, fullMark: 100, method });
      methodology.push(`Efficiency: ${method}`);
    } else {
      missing.push("Efficiency (need cost data)");
    }

    if (revenue.length > 0 && latestCost > 0) {
      const score = Math.round(Math.min(100, Math.max(0, (1 - latestCost) * 100)));
      const method = `Margin ${((1 - latestCost) * 100).toFixed(1)}% → ${score}/100`;
      dimensions.push({ dimension: "Margin", score, fullMark: 100, method });
      methodology.push(`Margin: ${method}`);
    } else {
      missing.push("Margin (need revenue + cost)");
    }

    if (customers.length >= 2) {
      const growth = ((customers[customers.length - 1].value / (customers[0].value || 1)) - 1) * 100;
      const score = Math.round(Math.min(100, Math.max(0, growth + 50)));
      const method = `Growth ${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% → ${score}/100`;
      dimensions.push({ dimension: "Customer Growth", score, fullMark: 100, method });
      methodology.push(`Customer Growth: ${method}`);
    } else {
      missing.push("Customer Growth (need ≥2 points)");
    }

    return { data: dimensions, missingDimensions: missing, scoringMethodology: methodology };
  }, [metrics, latestChurn, latestCost]);

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
          {avgScore}/100
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">
        {data.length} dimensions · <span className="text-warning font-medium">Heuristic</span>
      </p>

      <div style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.4} />
            <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number, _: any, entry: any) => {
                const dim = data.find(d => d.score === v);
                return [`${v}/100`, dim?.method || "Score"];
              }}
            />
            <Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {scoringMethodology.length > 0 && (
        <details className="mt-2 text-[10px] text-muted-foreground">
          <summary className="cursor-pointer font-semibold hover:text-foreground transition-colors">
            Scoring methodology
          </summary>
          <ul className="mt-1 space-y-0.5 pl-3">
            {scoringMethodology.map((m, i) => <li key={i}>• {m}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
};

export default PortfolioHealthRadar;

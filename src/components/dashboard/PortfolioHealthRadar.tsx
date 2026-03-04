import { useMemo } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";
import { Shield } from "lucide-react";
import { MetricRow } from "@/hooks/useMetrics";

interface Props {
  metrics: MetricRow[];
  latestChurn: number;
  latestCost: number;
}

const PortfolioHealthRadar = ({ metrics, latestChurn, latestCost }: Props) => {
  const data = useMemo(() => {
    if (metrics.length === 0) return [];

    const revenue = metrics.filter(m => m.metric_type === "revenue");
    const customers = metrics.filter(m => m.metric_type === "customers");

    const revenueGrowth = revenue.length >= 2
      ? Math.min(100, Math.max(0, ((revenue[revenue.length - 1].value / (revenue[0].value || 1)) - 1) * 100 + 50))
      : 50;

    const retention = latestChurn > 0 ? Math.max(0, 100 - latestChurn * 10) : 85;
    const costEfficiency = latestCost > 0 ? Math.max(0, 100 - latestCost * 100) : 70;
    const customerGrowth = customers.length >= 2
      ? Math.min(100, Math.max(0, ((customers[customers.length - 1].value / (customers[0].value || 1)) - 1) * 100 + 50))
      : 50;
    const margin = revenue.length > 0 && latestCost > 0
      ? Math.min(100, Math.max(0, (1 - latestCost) * 100))
      : 60;

    return [
      { dimension: "Revenue Growth", score: Math.round(revenueGrowth), fullMark: 100 },
      { dimension: "Retention", score: Math.round(retention), fullMark: 100 },
      { dimension: "Margin", score: Math.round(margin), fullMark: 100 },
      { dimension: "Efficiency", score: Math.round(costEfficiency), fullMark: 100 },
      { dimension: "Customer Growth", score: Math.round(customerGrowth), fullMark: 100 },
    ];
  }, [metrics, latestChurn, latestCost]);

  if (data.length === 0) {
    return (
      <div className="glass-card p-5 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portfolio Health</h3>
        </div>
        <p className="text-xs text-muted-foreground">Upload data to view health radar.</p>
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
          avgScore >= 70 ? "bg-[hsl(var(--severity-success))]/10 text-[hsl(var(--severity-success))]"
            : avgScore >= 50 ? "bg-[hsl(var(--severity-warning))]/10 text-[hsl(var(--severity-warning))]"
            : "bg-destructive/10 text-destructive"
        }`}>
          Score: {avgScore}/100
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">Five-dimensional operating health</p>

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

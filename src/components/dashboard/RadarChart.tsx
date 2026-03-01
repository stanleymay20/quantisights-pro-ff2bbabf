import { useMemo } from "react";
import { RadarChart as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";
import { Hexagon } from "lucide-react";
import { MetricRow } from "@/hooks/useMetrics";

interface RadarChartProps {
  metrics: MetricRow[];
}

const RadarChartComponent = ({ metrics }: RadarChartProps) => {
  const data = useMemo(() => {
    if (metrics.length === 0) return [];

    // Compute balanced scorecard dimensions
    const revenue = metrics.filter(m => m.metric_type === "revenue");
    const customers = metrics.filter(m => m.metric_type === "customers");
    const cost = metrics.filter(m => m.metric_type === "cost");
    const churn = metrics.filter(m => m.metric_type === "churn");

    // Normalize each to 0-100 scale
    const revenueGrowth = revenue.length >= 2
      ? Math.min(100, Math.max(0, ((revenue[revenue.length - 1].value / (revenue[0].value || 1)) - 1) * 100 + 50))
      : 50;

    const customerScore = customers.length > 0
      ? Math.min(100, (customers[customers.length - 1].value / Math.max(...customers.map(c => c.value), 1)) * 100)
      : 0;

    const costEfficiency = cost.length > 0
      ? Math.min(100, Math.max(0, 100 - (cost[cost.length - 1].value * 100)))
      : 50;

    const retention = churn.length > 0
      ? Math.min(100, Math.max(0, 100 - (churn[churn.length - 1].value * 100)))
      : 50;

    const dataVolume = Math.min(100, (metrics.length / 50) * 100);

    return [
      { dimension: "Revenue Growth", value: Math.round(revenueGrowth) },
      { dimension: "Customer Base", value: Math.round(customerScore) },
      { dimension: "Cost Efficiency", value: Math.round(costEfficiency) },
      { dimension: "Retention", value: Math.round(retention) },
      { dimension: "Data Coverage", value: Math.round(dataVolume) },
    ];
  }, [metrics]);

  if (data.length === 0) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Hexagon className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Balanced Scorecard</h3>
        </div>
        <p className="text-xs text-muted-foreground">Upload data to view multi-dimensional health radar.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-1">
        <Hexagon className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Balanced Scorecard</h3>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">Multi-dimensional business health</p>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadar data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.4} />
            <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8 }} />
            <Tooltip
              contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              formatter={(value: number) => [`${value}/100`, "Score"]}
            />
            <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
          </RechartsRadar>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RadarChartComponent;

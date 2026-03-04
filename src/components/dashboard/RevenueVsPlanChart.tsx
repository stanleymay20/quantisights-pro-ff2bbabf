import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ComposedChart } from "recharts";
import { Target } from "lucide-react";

interface Props {
  revenueByMonth: { month: string; revenue: number }[];
}

const RevenueVsPlanChart = ({ revenueByMonth }: Props) => {
  const data = useMemo(() => {
    if (revenueByMonth.length < 2) return null;

    // Generate plan line as 10% growth from first month
    const baseRevenue = revenueByMonth[0]?.revenue ?? 0;
    const monthlyGrowth = 1.08; // 8% monthly plan target

    return revenueByMonth.map((m, i) => ({
      month: m.month,
      actual: m.revenue,
      plan: Math.round(baseRevenue * Math.pow(monthlyGrowth, i)),
      variance: m.revenue - Math.round(baseRevenue * Math.pow(monthlyGrowth, i)),
    }));
  }, [revenueByMonth]);

  if (!data) {
    return (
      <div className="glass-card p-5 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revenue vs Plan</h3>
        </div>
        <p className="text-xs text-muted-foreground">Need at least 2 months of revenue data.</p>
      </div>
    );
  }

  const latestVariance = data[data.length - 1]?.variance ?? 0;
  const variancePct = data[data.length - 1]?.plan ? ((latestVariance / data[data.length - 1].plan) * 100).toFixed(1) : "0";

  return (
    <div className="glass-card p-5 rounded-xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revenue vs Plan</h3>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          latestVariance >= 0
            ? "bg-[hsl(var(--severity-success))]/10 text-[hsl(var(--severity-success))]"
            : "bg-destructive/10 text-destructive"
        }`}>
          {latestVariance >= 0 ? "+" : ""}{variancePct}% to plan
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">Actual revenue vs 8% monthly growth target</p>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false}
              tickFormatter={v => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1e3).toFixed(0)}K`} />
            <Tooltip
              contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              formatter={(v: number, name: string) => [`$${v.toLocaleString()}`, name === "actual" ? "Actual" : "Plan"]}
            />
            <Bar dataKey="actual" fill="hsl(var(--primary))" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="plan" stroke="hsl(var(--severity-warning))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RevenueVsPlanChart;

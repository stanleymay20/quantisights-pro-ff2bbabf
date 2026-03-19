import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency, axisStyle, tooltipStyle, gridStyle, CHART_HEIGHT } from "@/lib/chart-config";

interface RevenueChartProps {
  data: { month: string; revenue: number }[];
}

const RevenueChart = ({ data }: RevenueChartProps) => {
  const trendHint = (() => {
    if (data.length < 3) return null;
    const recent = data.slice(-3);
    const delta = recent[0].revenue > 0 ? ((recent[recent.length - 1].revenue - recent[0].revenue) / recent[0].revenue) * 100 : 0;
    if (delta > 5) return "📈 Growth accelerating";
    if (delta < -5) return "📉 Growth declining — investigate pipeline";
    return "➡️ Revenue flat — growth stalled";
  })();

  return (
    <div className="glass-card p-6 rounded-xl">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Revenue Growth</h3>
      {trendHint && <p className="text-[11px] text-muted-foreground mb-3">{trendHint}</p>}
      {data.length === 0 ? (
        <div style={{ height: CHART_HEIGHT }} className="flex items-center justify-center text-muted-foreground text-sm">No revenue data yet</div>
      ) : (
        <div style={{ height: CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="month" {...axisStyle} />
              <YAxis {...axisStyle} tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [formatCurrency(v, { compact: false }), "Revenue"]}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#revenueGradient)"
                dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: "hsl(var(--background))", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default RevenueChart;

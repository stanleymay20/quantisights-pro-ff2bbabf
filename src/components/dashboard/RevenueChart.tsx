import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency, axisStyle, tooltipStyle, gridStyle, CHART_HEIGHT } from "@/lib/chart-config";

interface RevenueChartProps {
  data: { month: string; revenue: number }[];
}

const RevenueChart = ({ data }: RevenueChartProps) => {
  const { trendIcon: TrendIcon, trendText, trendColor, trendAction, avgRevenue, peakIdx } = useMemo(() => {
    if (data.length < 3) return { trendIcon: Minus, trendText: null, trendColor: "", trendAction: null, avgRevenue: 0, peakIdx: -1 };

    const recent = data.slice(-3);
    const delta = recent[0].revenue > 0
      ? ((recent[recent.length - 1].revenue - recent[0].revenue) / recent[0].revenue) * 100
      : 0;

    const avg = data.reduce((s, d) => s + d.revenue, 0) / data.length;
    const peak = data.reduce((max, d, i) => d.revenue > (data[max]?.revenue ?? 0) ? i : max, 0);

    if (delta > 5) return {
      trendIcon: TrendingUp,
      trendText: `Revenue growing ${delta.toFixed(1)}% over the last ${recent.length} periods — momentum is positive.`,
      trendColor: "text-[hsl(var(--success))]",
      trendAction: null,
      avgRevenue: avg,
      peakIdx: peak,
    };
    if (delta < -5) return {
      trendIcon: TrendingDown,
      trendText: `Revenue declining ${Math.abs(delta).toFixed(1)}% — investigate demand drivers and pipeline health.`,
      trendColor: "text-destructive",
      trendAction: "Review pipeline →",
      avgRevenue: avg,
      peakIdx: peak,
    };
    return {
      trendIcon: Minus,
      trendText: "Revenue is flat — growth has stalled. Consider new acquisition channels or pricing changes.",
      trendColor: "text-[hsl(var(--warning))]",
      trendAction: "Explore scenarios →",
      avgRevenue: avg,
      peakIdx: peak,
    };
  }, [data]);

  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revenue Growth</h3>
        {data.length > 0 && (
          <span className="text-[10px] font-medium text-muted-foreground">{data.length} periods</span>
        )}
      </div>

      {/* Narrative interpretation */}
      {trendText && (
        <div className="flex items-start gap-2 mb-3">
          <TrendIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${trendColor}`} />
          <div>
            <p className="text-[11px] text-foreground/80 leading-relaxed">{trendText}</p>
            {trendAction && (
              <Link to="/scenarios" className="text-[10px] font-semibold text-primary hover:underline mt-0.5 inline-block">
                {trendAction}
              </Link>
            )}
          </div>
        </div>
      )}

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
              {/* Average line annotation */}
              {avgRevenue > 0 && (
                <ReferenceLine
                  y={avgRevenue}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                >
                  <Label
                    value={`Avg ${formatCurrency(avgRevenue)}`}
                    position="insideTopRight"
                    style={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  />
                </ReferenceLine>
              )}
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

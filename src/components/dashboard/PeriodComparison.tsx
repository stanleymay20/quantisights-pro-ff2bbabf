import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { useMemo } from "react";
import { formatCurrency, axisStyle, tooltipStyle, gridStyle, CHART_HEIGHT, CHART_COLORS, CHART_OPACITY } from "@/lib/chart-config";

interface PeriodComparisonProps {
  data: { month: string; revenue: number }[];
}

const PeriodComparison = ({ data }: PeriodComparisonProps) => {
  const comparisonData = useMemo(() => {
    if (data.length < 4) return [];
    const mid = Math.ceil(data.length / 2);
    const current = data.slice(mid);
    const previous = data.slice(0, mid);

    return current.map((c, i) => ({
      period: c.month,
      current: c.revenue,
      previous: previous[i]?.revenue ?? 0,
      delta: previous[i]?.revenue ? ((c.revenue - previous[i].revenue) / previous[i].revenue * 100).toFixed(1) : "—",
    }));
  }, [data]);

  if (comparisonData.length === 0) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Period Comparison</h3>
        <div style={{ height: CHART_HEIGHT }} className="flex items-center justify-center text-muted-foreground text-sm">Needs ≥4 months of data</div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-xl">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Period Comparison</h3>
      {/* Narrative: period-over-period trend */}
      {(() => {
        const improving = comparisonData.filter(d => d.delta !== "—" && Number(d.delta) > 0).length;
        const declining = comparisonData.filter(d => d.delta !== "—" && Number(d.delta) < 0).length;
        return (
          <p className="text-[11px] text-foreground/80 leading-relaxed mb-3">
            {improving > declining
              ? `${improving} of ${comparisonData.length} periods show improvement over prior periods — positive trajectory.`
              : declining > improving
              ? `${declining} of ${comparisonData.length} periods are below prior levels — a concerning trend.`
              : "Performance is roughly consistent across periods."}
          </p>
        );
      })()}
      <div style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={comparisonData} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
            <CartesianGrid {...gridStyle} vertical={false} />
            <XAxis dataKey="period" {...axisStyle} />
            <YAxis {...axisStyle} tickFormatter={(v) => formatCurrency(v)} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(val: number, name: string) => [formatCurrency(val, { compact: false }), name === "previous" ? "Previous Period" : "Current Period"]}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px" }}
              formatter={(value) => value === "previous" ? "Previous Period" : "Current Period"}
            />
            <Bar dataKey="previous" fill={CHART_COLORS.comparison} fillOpacity={CHART_OPACITY.muted} radius={[4, 4, 0, 0]} />
            <Bar dataKey="current" fill={CHART_COLORS.primary} fillOpacity={CHART_OPACITY.full} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PeriodComparison;

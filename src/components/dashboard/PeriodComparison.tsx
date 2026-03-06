import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useMemo } from "react";

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
        <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Needs ≥4 months of data</div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-xl">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Period Comparison</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={comparisonData}>
            <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
              }}
              formatter={(val: number, name: string) => [`€${val.toLocaleString()}`, name === "previous" ? "Previous" : "Current"]}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px" }}
              formatter={(value) => value === "previous" ? "Previous Period" : "Current Period"}
            />
            <Bar dataKey="previous" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="current" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PeriodComparison;

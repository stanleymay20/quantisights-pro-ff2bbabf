import { useMemo } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { CircleDot } from "lucide-react";
import { MetricRow } from "@/hooks/useMetrics";

interface ScatterBubbleChartProps {
  metrics: MetricRow[];
}

const ScatterBubbleChart = ({ metrics }: ScatterBubbleChartProps) => {
  const data = useMemo(() => {
    // Group by month: revenue vs customers, bubble size = cost
    const byMonth = new Map<string, { revenue: number; customers: number; cost: number; month: string }>();

    metrics.forEach(m => {
      const d = new Date(m.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!byMonth.has(key)) {
        byMonth.set(key, { revenue: 0, customers: 0, cost: 0, month: d.toLocaleDateString("en", { month: "short" }) });
      }
      const entry = byMonth.get(key)!;
      if (m.metric_type === "revenue") entry.revenue += Number(m.value);
      if (m.metric_type === "customers") entry.customers += Number(m.value);
      if (m.metric_type === "cost") entry.cost += Number(m.value);
    });

    return [...byMonth.values()].filter(d => d.revenue > 0 || d.customers > 0);
  }, [metrics]);

  if (data.length < 2) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <CircleDot className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scatter Analysis</h3>
        </div>
        <p className="text-xs text-muted-foreground">Upload multi-dimensional data (revenue, customers, cost) to visualize relationships.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-1">
        <CircleDot className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revenue × Customers</h3>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">Bubble size = cost intensity</p>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
            <XAxis type="number" dataKey="revenue" name="Revenue" tick={{ fontSize: 10 }}
              tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
            <YAxis type="number" dataKey="customers" name="Customers" tick={{ fontSize: 10 }} />
            <ZAxis type="number" dataKey="cost" range={[40, 400]} name="Cost" />
            <Tooltip
              contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              formatter={(value: number, name: string) => [
                name === "Revenue" ? `€${value.toLocaleString()}` :
                name === "Cost" ? `€${value.toLocaleString()}` :
                value.toLocaleString(),
                name
              ]}
            />
            <Scatter data={data} fill="hsl(var(--primary))" fillOpacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ScatterBubbleChart;

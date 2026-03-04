import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { ArrowRightLeft } from "lucide-react";
import { MetricRow } from "@/hooks/useMetrics";

interface Props {
  metrics: MetricRow[];
}

const EBITDABridgeChart = ({ metrics }: Props) => {
  const items = useMemo(() => {
    const revenue = metrics.filter(d => d.metric_type === "revenue").reduce((s, d) => s + Number(d.value), 0);
    const cost = metrics.filter(d => d.metric_type === "cost").reduce((s, d) => s + Number(d.value), 0);
    if (revenue === 0) return null;

    const cogs = cost * 0.55;
    const grossProfit = revenue - cogs;
    const opex = cost * 0.35;
    const dna = cost * 0.1;
    const ebitda = grossProfit - opex;

    const steps = [
      { name: "Revenue", value: revenue, start: 0, type: "total" },
      { name: "COGS", value: -cogs, start: revenue, type: "negative" },
      { name: "Gross Profit", value: grossProfit, start: 0, type: "subtotal" },
      { name: "OpEx", value: -opex, start: grossProfit, type: "negative" },
      { name: "EBITDA", value: ebitda, start: 0, type: "total" },
    ];

    return steps.map(s => ({
      ...s,
      bottom: s.type === "total" || s.type === "subtotal" ? 0 : s.start + s.value,
      height: Math.abs(s.value),
    }));
  }, [metrics]);

  const colors: Record<string, string> = {
    total: "hsl(var(--primary))",
    subtotal: "hsl(var(--severity-success))",
    negative: "hsl(var(--destructive))",
  };

  if (!items) {
    return (
      <div className="glass-card p-5 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <ArrowRightLeft className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">EBITDA Bridge</h3>
        </div>
        <p className="text-xs text-muted-foreground">Upload revenue & cost data to view the EBITDA bridge.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 rounded-xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">EBITDA Bridge</h3>
        </div>
        <span className="text-[10px] text-muted-foreground">Revenue → EBITDA</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">How revenue converts to operating earnings</p>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items} barCategoryGap="20%">
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false}
              tickFormatter={v => v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v}`} />
            <Tooltip
              contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              formatter={(v: number) => [`$${Math.abs(v).toLocaleString()}`, "Amount"]}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="bottom" stackId="bridge" fill="transparent" />
            <Bar dataKey="height" stackId="bridge" radius={[4, 4, 0, 0]}>
              {items.map((entry, i) => (
                <Cell key={i} fill={colors[entry.type]} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default EBITDABridgeChart;

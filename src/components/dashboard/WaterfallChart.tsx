import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, CartesianGrid } from "recharts";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency, axisStyle, tooltipStyle, gridStyle, CHART_HEIGHT } from "@/lib/chart-config";

interface WaterfallChartProps {
  data: { metric_type: string; value: number }[];
}

/**
 * P&L Waterfall — DATA-HONEST.
 * Only renders P&L items that have real data. No fabricated values.
 */
const WaterfallChart = ({ data }: WaterfallChartProps) => {
  const analysis = useMemo(() => {
    const revenue = data.filter(d => d.metric_type === "revenue").reduce((s, d) => s + d.value, 0);
    const cost = data.filter(d => d.metric_type === "cost").reduce((s, d) => s + d.value, 0);
    const cogs = data.filter(d => d.metric_type === "cogs").reduce((s, d) => s + d.value, 0);
    const opex = data.filter(d => d.metric_type === "opex").reduce((s, d) => s + d.value, 0);
    const churnRevLoss = data.filter(d => d.metric_type === "churn_revenue_loss").reduce((s, d) => s + d.value, 0);

    if (revenue === 0) return null;

    const items: { name: string; value: number; type: "positive" | "negative" | "total" }[] = [];
    items.push({ name: "Revenue", value: revenue, type: "positive" });

    if (cogs > 0) items.push({ name: "COGS", value: -cogs, type: "negative" });
    if (opex > 0) items.push({ name: "OpEx", value: -opex, type: "negative" });
    if (cogs === 0 && opex === 0 && cost > 0) items.push({ name: "Total Spend", value: -cost, type: "uncertain" });
    if (churnRevLoss > 0) items.push({ name: "Churn Loss", value: -churnRevLoss, type: "negative" });

    const net = items.reduce((s, i) => s + i.value, 0);
    items.push({ name: "Net", value: net, type: "total" });

    let running = 0;
    return items.map(item => {
      if (item.type === "total") return { ...item, bottom: 0, height: Math.abs(item.value) };
      const bottom = item.value >= 0 ? running : running + item.value;
      const height = Math.abs(item.value);
      running += item.value;
      return { ...item, bottom, height };
    });
  }, [data]);

  const hasUncertain = analysis?.some(d => d.type === "uncertain");

  const colors: Record<string, string> = {
    positive: "hsl(var(--success))",
    negative: "hsl(var(--destructive))",
    total: "hsl(var(--primary))",
    uncertain: "hsl(var(--muted-foreground))",
  };

  if (!analysis) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">P&L Waterfall</h3>
        <div className="py-4 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <p className="text-sm font-medium mb-1">Requires revenue data</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Map <strong>revenue</strong> and <strong>cost</strong> (or <strong>cogs</strong> + <strong>opex</strong>) metric types.
          </p>
          <Link to="/data-upload" className="inline-flex text-xs font-semibold text-primary hover:underline">
            Upload Financial Data →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-xl">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {hasUncertain ? "Revenue vs Spend" : "P&L Waterfall"}
      </h3>
      {hasUncertain && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 mb-3 space-y-1">
          <p className="text-[11px] font-medium text-warning flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 shrink-0" /> Unstructured cost data
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Cost is reported as a single total — we cannot attribute spending to production, operations, or growth. The net figure is mathematically correct but not actionable.
          </p>
          <Link to="/data-upload" className="inline-flex text-[11px] font-semibold text-primary hover:underline mt-0.5">
            Upload categorised costs →
          </Link>
        </div>
      )}
      {!hasUncertain && (() => {
        const net = analysis[analysis.length - 1];
        const rev = analysis[0];
        if (!net || !rev) return null;
        return (
          <p className="text-[11px] text-foreground/80 leading-relaxed mb-3">
            {net.value >= 0
              ? `After all deductions, the business retains ${formatCurrency(net.value)} — ${((net.value / rev.value) * 100).toFixed(0)}% of revenue flows to the bottom line.`
              : `The business is spending more than it earns, with a net loss of ${formatCurrency(Math.abs(net.value))}. Cost reduction is critical.`
            }
          </p>
        );
      })()}
      <div style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={analysis} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
            <CartesianGrid {...gridStyle} vertical={false} />
            <XAxis dataKey="name" {...axisStyle} />
            <YAxis {...axisStyle} tickFormatter={(v: number) => formatCurrency(v)} />
            <Tooltip contentStyle={tooltipStyle} formatter={(val: number) => [formatCurrency(Math.abs(val), { compact: false }), "Value"]} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="bottom" stackId="waterfall" fill="transparent" />
            <Bar dataKey="height" stackId="waterfall" radius={[4, 4, 0, 0]}>
              {analysis.map((entry, i) => (
                <Cell key={i} fill={colors[entry.type]} fillOpacity={entry.type === "uncertain" ? 0.45 : 0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WaterfallChart;

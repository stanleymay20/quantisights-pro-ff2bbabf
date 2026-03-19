import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, CartesianGrid } from "recharts";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency, axisStyle, tooltipStyle, gridStyle, CHART_HEIGHT } from "@/lib/chart-config";

interface WaterfallChartProps {
  data: { metric_type: string; value: number }[];
}

/**
 * P&L Waterfall — epistemically honest.
 * Full mode when COGS+OpEx exist; limited-insight mode when only aggregate cost.
 */
const WaterfallChart = ({ data }: WaterfallChartProps) => {
  const analysis = useMemo(() => {
    const revenue = data.filter(d => d.metric_type === "revenue").reduce((s, d) => s + d.value, 0);
    const cost = data.filter(d => d.metric_type === "cost").reduce((s, d) => s + d.value, 0);
    const cogs = data.filter(d => d.metric_type === "cogs").reduce((s, d) => s + d.value, 0);
    const opex = data.filter(d => d.metric_type === "opex").reduce((s, d) => s + d.value, 0);
    const churnRevLoss = data.filter(d => d.metric_type === "churn_revenue_loss").reduce((s, d) => s + d.value, 0);

    if (revenue === 0) return null;

    const hasCostBreakdown = cogs > 0 || opex > 0;
    const items: { name: string; value: number; type: "positive" | "negative" | "total" }[] = [];
    items.push({ name: "Revenue", value: revenue, type: "positive" });

    if (cogs > 0) items.push({ name: "COGS", value: -cogs, type: "negative" });
    if (opex > 0) items.push({ name: "OpEx", value: -opex, type: "negative" });
    if (cogs === 0 && opex === 0 && cost > 0) items.push({ name: "Total Spend", value: -cost, type: "negative" });
    if (churnRevLoss > 0) items.push({ name: "Churn Loss", value: -churnRevLoss, type: "negative" });

    const net = items.reduce((s, i) => s + i.value, 0);
    items.push({ name: "Est. Net", value: net, type: "total" });

    let running = 0;
    const mapped = items.map(item => {
      if (item.type === "total") return { ...item, bottom: 0, height: Math.abs(item.value) };
      const bottom = item.value >= 0 ? running : running + item.value;
      const height = Math.abs(item.value);
      running += item.value;
      return { ...item, bottom, height };
    });

    return { steps: mapped, hasCostBreakdown, net, revenue };
  }, [data]);

  const colors: Record<string, string> = {
    positive: "hsl(var(--success))",
    negative: "hsl(var(--destructive))",
    total: "hsl(var(--primary))",
  };

  if (!analysis) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">P&L Waterfall</h3>
        <div className="py-4 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[hsl(var(--warning))]/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5 text-[hsl(var(--warning))]" />
          </div>
          <p className="text-sm font-medium mb-1">Requires revenue data</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Upload financial data with revenue and cost columns to see how money flows through the business.
          </p>
          <Link to="/data-upload" className="inline-flex text-xs font-semibold text-primary hover:underline">
            Upload Financial Data →
          </Link>
        </div>
      </div>
    );
  }

  const { steps, hasCostBreakdown, net, revenue } = analysis;
  const isLimited = !hasCostBreakdown;
  const marginPct = revenue > 0 ? ((net / revenue) * 100).toFixed(0) : "0";

  return (
    <div className={`glass-card p-6 rounded-xl ${isLimited ? "border border-[hsl(var(--warning))]/30" : ""}`}>
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">P&L Waterfall</h3>
        {isLimited && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10 px-1.5 py-0.5 rounded">
            Limited
          </span>
        )}
      </div>

      {/* Narrative */}
      {hasCostBreakdown ? (
        <p className="text-[11px] text-foreground/80 leading-relaxed mb-3">
          {net >= 0
            ? `After all deductions, the business retains ${formatCurrency(net)} (${marginPct}% of revenue) — cost structure is ${Number(marginPct) > 20 ? "healthy" : "tight"}.`
            : `The business is spending more than it earns, with a net loss of ${formatCurrency(Math.abs(net))}. Cost reduction is critical.`
          }
        </p>
      ) : (
        <div className="rounded-lg bg-[hsl(var(--warning))]/5 border border-[hsl(var(--warning))]/20 p-2.5 mb-3">
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-[hsl(var(--warning))] mt-0.5 shrink-0" />
            <p className="text-[11px] text-foreground/80 leading-relaxed">
              This shows total spend only. Without cost categories (production, operations, marketing), we cannot determine <strong>where money is being spent</strong> or whether spending is efficient. Treat as directional.
            </p>
          </div>
        </div>
      )}

      <div style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={steps} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
            <CartesianGrid {...gridStyle} vertical={false} />
            <XAxis dataKey="name" {...axisStyle} />
            <YAxis {...axisStyle} tickFormatter={(v: number) => formatCurrency(v)} />
            <Tooltip contentStyle={tooltipStyle} formatter={(val: number) => [formatCurrency(Math.abs(val), { compact: false }), "Value"]} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="bottom" stackId="waterfall" fill="transparent" />
            <Bar dataKey="height" stackId="waterfall" radius={[4, 4, 0, 0]}>
              {steps.map((entry, i) => (
                <Cell
                  key={i}
                  fill={colors[entry.type]}
                  fillOpacity={isLimited ? 0.45 : 0.85}
                  stroke={isLimited ? colors[entry.type] : undefined}
                  strokeWidth={isLimited ? 1.5 : 0}
                  strokeDasharray={isLimited ? "4 3" : undefined}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {isLimited && (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground italic">
            Est. net: {formatCurrency(net)} — directional only
          </p>
          <Link to="/data-upload" className="text-[11px] font-semibold text-primary hover:underline shrink-0">
            Upload cost breakdown →
          </Link>
        </div>
      )}
    </div>
  );
};

export default WaterfallChart;

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

interface WaterfallChartProps {
  data: { metric_type: string; value: number }[];
}

/**
 * P&L Waterfall — DATA-HONEST.
 *
 * Previous implementation fabricated "Churn Impact" as churn × revenue × 0.01 —
 * an arbitrary formula that is NOT how churn impacts P&L.
 *
 * A real P&L waterfall shows: Revenue - Cost categories = Net.
 * "Churn impact" requires actual lost revenue data, not a formula guess.
 *
 * Now: Only renders P&L items that have real data.
 * If churn_revenue_loss metric type exists, it will be shown. Otherwise omitted.
 */
const WaterfallChart = ({ data }: WaterfallChartProps) => {
  const analysis = useMemo(() => {
    const revenue = data.filter(d => d.metric_type === "revenue").reduce((s, d) => s + d.value, 0);
    const cost = data.filter(d => d.metric_type === "cost").reduce((s, d) => s + d.value, 0);
    const cogs = data.filter(d => d.metric_type === "cogs").reduce((s, d) => s + d.value, 0);
    const opex = data.filter(d => d.metric_type === "opex").reduce((s, d) => s + d.value, 0);
    // Only include churn revenue loss if explicitly mapped (not fabricated)
    const churnRevLoss = data.filter(d => d.metric_type === "churn_revenue_loss").reduce((s, d) => s + d.value, 0);

    if (revenue === 0) return null;

    const items: { name: string; value: number; type: "positive" | "negative" | "total" }[] = [];
    items.push({ name: "Revenue", value: revenue, type: "positive" });

    // Add cost breakdown if available
    if (cogs > 0) items.push({ name: "COGS", value: -cogs, type: "negative" });
    if (opex > 0) items.push({ name: "OpEx", value: -opex, type: "negative" });
    if (cogs === 0 && opex === 0 && cost > 0) {
      items.push({ name: "Total Cost", value: -cost, type: "negative" });
    }
    if (churnRevLoss > 0) {
      items.push({ name: "Churn Loss", value: -churnRevLoss, type: "negative" });
    }

    // Calculate net from actual items
    const net = items.reduce((s, i) => s + i.value, 0);
    items.push({ name: "Net", value: net, type: "total" });

    // Build waterfall coordinates
    let running = 0;
    return items.map(item => {
      if (item.type === "total") {
        return { ...item, bottom: 0, height: Math.abs(item.value) };
      }
      const bottom = item.value >= 0 ? running : running + item.value;
      const height = Math.abs(item.value);
      running += item.value;
      return { ...item, bottom, height };
    });
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
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">P&L Waterfall</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={analysis}>
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false}
              tickFormatter={(v: number) =>
                v >= 1e6 ? `€${(v / 1e6).toFixed(0)}M` : v >= 1e3 ? `€${(v / 1e3).toFixed(0)}K` : `€${v}`
              }
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
              }}
              formatter={(val: number) => [`€${Math.abs(val).toLocaleString()}`, "Value"]}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="bottom" stackId="waterfall" fill="transparent" />
            <Bar dataKey="height" stackId="waterfall" radius={[4, 4, 0, 0]}>
              {analysis.map((entry, i) => (
                <Cell key={i} fill={colors[entry.type]} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WaterfallChart;

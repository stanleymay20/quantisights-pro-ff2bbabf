import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";

interface WaterfallChartProps {
  data: { metric_type: string; value: number }[];
}

const WaterfallChart = ({ data }: WaterfallChartProps) => {
  // Build waterfall: Start → individual contributions → End
  const revenue = data.filter(d => d.metric_type === "revenue").reduce((s, d) => s + d.value, 0);
  const cost = data.filter(d => d.metric_type === "cost").reduce((s, d) => s + d.value, 0);
  const churn = data.filter(d => d.metric_type === "churn").reduce((s, d) => s + d.value, 0);
  const customers = data.filter(d => d.metric_type === "customers").reduce((s, d) => s + d.value, 0);
  const net = revenue - cost - (churn * revenue * 0.01);

  const items = [
    { name: "Revenue", value: revenue, start: 0, fill: "hsl(142, 71%, 45%)" },
    { name: "Cost", value: -cost, start: revenue, fill: "hsl(0, 72%, 51%)" },
    { name: "Churn Impact", value: -(churn * revenue * 0.01), start: revenue - cost, fill: "hsl(38, 92%, 50%)" },
    { name: "Net", value: net, start: 0, fill: "hsl(199, 89%, 48%)" },
  ].map(item => ({
    ...item,
    bottom: item.name === "Net" ? 0 : item.value >= 0 ? item.start : item.start + item.value,
    height: Math.abs(item.value),
  }));

  if (revenue === 0) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">P&L Waterfall</h3>
        <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Needs revenue & cost data</div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-xl">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">P&L Waterfall</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items}>
            <XAxis dataKey="name" stroke="hsl(215, 20%, 55%)" fontSize={11} />
            <YAxis stroke="hsl(215, 20%, 55%)" fontSize={11} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(216, 45%, 12%)",
                border: "1px solid hsl(216, 30%, 20%)",
                borderRadius: "8px",
                color: "hsl(210, 40%, 95%)",
              }}
              formatter={(val: number) => [`€${Math.abs(val).toLocaleString()}`, "Value"]}
            />
            <ReferenceLine y={0} stroke="hsl(216, 30%, 25%)" />
            {/* Invisible bar for stacking offset */}
            <Bar dataKey="bottom" stackId="waterfall" fill="transparent" />
            <Bar dataKey="height" stackId="waterfall" radius={[4, 4, 0, 0]}>
              {items.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WaterfallChart;

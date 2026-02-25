import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "hsl(199, 89%, 48%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(217, 91%, 60%)",
  "hsl(0, 72%, 51%)",
];

interface CustomerSegmentationProps {
  data: Record<string, number>;
}

const CustomerSegmentation = ({ data }: CustomerSegmentationProps) => {
  const entries = Object.entries(data).map(([name, value], i) => ({
    name,
    value,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="glass-card p-6 rounded-xl">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Customer Segmentation</h3>
      {entries.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">No segment data</div>
      ) : (
        <>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={entries} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {entries.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(216, 45%, 12%)",
                    border: "1px solid hsl(216, 30%, 20%)",
                    borderRadius: "8px",
                    color: "hsl(210, 40%, 95%)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {entries.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name} €{d.value >= 1_000_000 ? `${(d.value / 1_000_000).toFixed(1)}M` : d.value.toLocaleString()}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default CustomerSegmentation;

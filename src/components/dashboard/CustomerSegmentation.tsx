import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const data = [
  { name: "Enterprise", value: 220, color: "hsl(199, 89%, 48%)" },
  { name: "SME", value: 85, color: "hsl(142, 71%, 45%)" },
  { name: "SMMe", value: 85, color: "hsl(38, 92%, 50%)" },
  { name: "Revenue", value: 925, color: "hsl(217, 91%, 60%)" },
];

const CustomerSegmentation = () => (
  <div className="glass-card p-6 rounded-xl">
    <h3 className="text-lg font-semibold font-display mb-4">Customer Segmentation</h3>
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
            {data.map((entry, i) => (
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
      {data.map((d) => (
        <div key={d.name} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
          {d.name} €{d.value}M
        </div>
      ))}
    </div>
  </div>
);

export default CustomerSegmentation;

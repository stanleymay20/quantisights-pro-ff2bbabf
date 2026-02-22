import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface RevenueChartProps {
  data: { month: string; revenue: number }[];
}

const RevenueChart = ({ data }: RevenueChartProps) => (
  <div className="glass-card p-6 rounded-xl">
    <h3 className="text-lg font-semibold font-display mb-4">Revenue Growth</h3>
    {data.length === 0 ? (
      <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">No revenue data yet</div>
    ) : (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(216, 30%, 20%)" />
            <XAxis dataKey="month" stroke="hsl(215, 20%, 55%)" fontSize={12} />
            <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(216, 45%, 12%)",
                border: "1px solid hsl(216, 30%, 20%)",
                borderRadius: "8px",
                color: "hsl(210, 40%, 95%)",
              }}
            />
            <Area type="monotone" dataKey="revenue" stroke="hsl(199, 89%, 48%)" strokeWidth={2} fill="url(#revenueGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

export default RevenueChart;

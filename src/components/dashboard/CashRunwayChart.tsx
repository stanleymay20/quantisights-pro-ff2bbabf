import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Clock } from "lucide-react";

interface Props {
  revenueByMonth: { month: string; revenue: number }[];
  latestCost: number;
}

const CashRunwayChart = ({ revenueByMonth, latestCost }: Props) => {
  const data = useMemo(() => {
    if (revenueByMonth.length < 2) return null;

    const monthlyBurn = latestCost > 0 ? latestCost : revenueByMonth[revenueByMonth.length - 1]?.revenue * 0.8;
    let cashBalance = revenueByMonth.reduce((s, m) => s + m.revenue, 0) * 0.3; // Assume 30% retained

    const projection: { month: string; cash: number; projected: boolean }[] = [];

    // Historical
    let runningCash = cashBalance;
    revenueByMonth.slice(-6).forEach(m => {
      projection.push({ month: m.month, cash: Math.max(0, runningCash), projected: false });
      runningCash += m.revenue - monthlyBurn;
    });

    // Projected 6 months
    const lastRevenue = revenueByMonth[revenueByMonth.length - 1]?.revenue ?? 0;
    for (let i = 1; i <= 6; i++) {
      const projected = lastRevenue * (1 + 0.02 * i) - monthlyBurn;
      runningCash += projected;
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthIdx = (new Date().getMonth() + i) % 12;
      projection.push({
        month: `${monthNames[monthIdx]} (P)`,
        cash: Math.max(0, runningCash),
        projected: true,
      });
    }

    return projection;
  }, [revenueByMonth, latestCost]);

  if (!data) {
    return (
      <div className="glass-card p-5 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cash Runway</h3>
        </div>
        <p className="text-xs text-muted-foreground">Need at least 2 months of revenue data.</p>
      </div>
    );
  }

  const dangerZone = data.some(d => d.cash === 0);

  return (
    <div className="glass-card p-5 rounded-xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cash Runway</h3>
        </div>
        {dangerZone && (
          <span className="text-[10px] font-bold bg-destructive/10 text-destructive px-2 py-0.5 rounded-full animate-pulse">
            ⚠ Cash Zero Projected
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">6-month forward projection based on current burn</p>

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false}
              tickFormatter={v => v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M` : `$${(v / 1e3).toFixed(0)}K`} />
            <Tooltip
              contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              formatter={(v: number) => [`$${v.toLocaleString()}`, "Cash Balance"]}
            />
            <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="cash" stroke="hsl(var(--primary))" fill="url(#cashGradient)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CashRunwayChart;

import { useMemo } from "react";

interface CohortAnalysisProps {
  metrics: { metric_type: string; value: number; date: string; segment?: string | null }[];
}

const CohortAnalysis = ({ metrics }: CohortAnalysisProps) => {
  const cohorts = useMemo(() => {
    // Group customer metrics by month as "cohorts"
    const customerMetrics = metrics.filter(m => m.metric_type === "customers" || m.metric_type === "revenue");
    const byMonth: Record<string, { customers: number; revenue: number }> = {};

    customerMetrics.forEach(m => {
      const month = m.date.slice(0, 7); // YYYY-MM
      if (!byMonth[month]) byMonth[month] = { customers: 0, revenue: 0 };
      if (m.metric_type === "customers") byMonth[month].customers += m.value;
      if (m.metric_type === "revenue") byMonth[month].revenue += m.value;
    });

    const months = Object.keys(byMonth).sort();
    const firstMonth = months[0];

    return months.map((month, idx) => {
      const d = byMonth[month];
      const firstCustomers = byMonth[firstMonth]?.customers || 1;
      const retention = idx === 0 ? 100 : Math.min(100, (d.customers / firstCustomers) * 100);
      return {
        month: new Date(month + "-01").toLocaleDateString("en", { month: "short", year: "2-digit" }),
        customers: d.customers,
        revenue: d.revenue,
        retention: Math.round(retention),
      };
    });
  }, [metrics]);

  if (cohorts.length < 2) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Cohort Retention</h3>
        <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Needs ≥2 months of customer data</div>
      </div>
    );
  }

  const maxRetention = 100;

  return (
    <div className="glass-card p-6 rounded-xl">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Cohort Retention</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left pb-2 text-muted-foreground font-medium">Period</th>
              <th className="text-right pb-2 text-muted-foreground font-medium">Customers</th>
              <th className="text-right pb-2 text-muted-foreground font-medium">Revenue</th>
              <th className="pb-2 text-muted-foreground font-medium pl-4 text-left">Retention</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c) => (
              <tr key={c.month} className="border-t border-border/20">
                <td className="py-2 font-medium">{c.month}</td>
                <td className="py-2 text-right text-muted-foreground">{c.customers.toLocaleString()}</td>
                <td className="py-2 text-right text-muted-foreground">€{c.revenue >= 1000 ? `${(c.revenue / 1000).toFixed(0)}K` : c.revenue.toLocaleString()}</td>
                <td className="py-2 pl-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden max-w-[100px]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(c.retention / maxRetention) * 100}%`,
                          backgroundColor: c.retention >= 80 ? "hsl(142, 71%, 45%)" : c.retention >= 50 ? "hsl(38, 92%, 50%)" : "hsl(0, 72%, 51%)",
                        }}
                      />
                    </div>
                    <span className={`font-mono font-semibold ${c.retention >= 80 ? "text-emerald-400" : c.retention >= 50 ? "text-warning" : "text-destructive"}`}>
                      {c.retention}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CohortAnalysis;

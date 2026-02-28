import { useMemo } from "react";

interface FunnelChartProps {
  metrics: { metric_type: string; value: number }[];
}

const FunnelChart = ({ metrics }: FunnelChartProps) => {
  const stages = useMemo(() => {
    const customers = metrics.filter(m => m.metric_type === "customers").reduce((s, m) => s + m.value, 0);
    const revenue = metrics.filter(m => m.metric_type === "revenue").reduce((s, m) => s + m.value, 0);
    const churn = metrics.filter(m => m.metric_type === "churn").slice(-1)[0]?.value ?? 0;
    const cost = metrics.filter(m => m.metric_type === "cost").reduce((s, m) => s + m.value, 0);

    // Simulate funnel from available metrics
    const leads = Math.round(customers * 3.5); // estimated leads
    const qualified = Math.round(customers * 2.1);
    const active = customers;
    const retained = Math.round(customers * (1 - churn / 100));

    return [
      { label: "Est. Leads", value: leads, color: "hsl(215, 80%, 55%)" },
      { label: "Qualified", value: qualified, color: "hsl(199, 89%, 48%)" },
      { label: "Customers", value: active, color: "hsl(142, 71%, 45%)" },
      { label: "Retained", value: retained, color: "hsl(160, 65%, 40%)" },
    ];
  }, [metrics]);

  const maxValue = stages[0]?.value || 1;

  if (maxValue <= 1) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Acquisition Funnel</h3>
        <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Needs customer data</div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-xl">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Acquisition Funnel</h3>
      <div className="space-y-3 py-2">
        {stages.map((stage, i) => {
          const widthPct = Math.max(20, (stage.value / maxValue) * 100);
          const conversionRate = i > 0 ? ((stage.value / stages[i - 1].value) * 100).toFixed(0) : null;
          return (
            <div key={stage.label}>
              {conversionRate && (
                <div className="flex justify-center mb-1">
                  <span className="text-[10px] font-mono text-muted-foreground">↓ {conversionRate}%</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-20 text-right shrink-0">{stage.label}</span>
                <div className="flex-1 flex justify-center">
                  <div
                    className="h-8 rounded-lg flex items-center justify-center transition-all"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: stage.color,
                      opacity: 0.85,
                    }}
                  >
                    <span className="text-xs font-bold text-white drop-shadow-sm">
                      {stage.value.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FunnelChart;

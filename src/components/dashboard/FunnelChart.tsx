import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { formatNumber } from "@/lib/chart-config";

interface FunnelChartProps {
  metrics: { metric_type: string; value: number }[];
}

/**
 * Acquisition Funnel — DATA-HONEST.
 * Only renders when real funnel stage data exists (≥2 stages).
 */
const FunnelChart = ({ metrics }: FunnelChartProps) => {
  const stages = useMemo(() => {
    const leads = metrics.filter(m => m.metric_type === "leads").reduce((s, m) => s + m.value, 0);
    const qualified = metrics.filter(m => m.metric_type === "qualified_leads" || m.metric_type === "qualified").reduce((s, m) => s + m.value, 0);
    const customers = metrics.filter(m => m.metric_type === "customers").reduce((s, m) => s + m.value, 0);
    const churn = metrics.filter(m => m.metric_type === "churn").slice(-1)[0]?.value ?? 0;

    const realStages: { label: string; value: number }[] = [];
    if (leads > 0) realStages.push({ label: "Leads", value: leads });
    if (qualified > 0) realStages.push({ label: "Qualified", value: qualified });
    if (customers > 0) realStages.push({ label: "Customers", value: customers });
    if (customers > 0 && churn > 0) {
      realStages.push({ label: "Retained", value: Math.round(customers * (1 - churn / 100)) });
    }

    return realStages.length >= 2 ? realStages : null;
  }, [metrics]);

  if (!stages) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Acquisition Funnel</h3>
        <div className="py-4 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Requires funnel stage data</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Map <strong>leads</strong>, <strong>qualified_leads</strong>, and <strong>customers</strong> metric types to enable the funnel.
            </p>
          </div>
          <Link to="/data-upload" className="inline-flex text-xs font-semibold text-primary hover:underline">
            Upload Funnel Data →
          </Link>
        </div>
      </div>
    );
  }

  const maxValue = stages[0]?.value || 1;

  return (
    <div className="glass-card p-6 rounded-xl">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Acquisition Funnel</h3>
      <div className="space-y-3 py-2">
        {stages.map((stage, i) => {
          const widthPct = Math.max(20, (stage.value / maxValue) * 100);
          const conversionRate = i > 0 ? ((stage.value / stages[i - 1].value) * 100).toFixed(1) : null;
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
                    className="h-9 rounded-lg flex items-center justify-center transition-all"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: `hsl(var(--primary) / ${1 - i * 0.15})`,
                    }}
                  >
                    <span className="text-xs font-bold text-primary-foreground drop-shadow-sm">
                      {formatNumber(stage.value)}
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

import { Building2, DollarSign, TrendingUp, AlertTriangle, BarChart3 } from "lucide-react";
import { fmtCurrency } from "@/lib/format-utils";

interface Props {
  companyCount: number;
  totalAUM: number;
  totalRevenue: number;
  avgRisk: number;
  atRiskCount: number;
  avgEbitdaMargin: number;
}

const PortfolioKPIBar = ({ companyCount, totalAUM, totalRevenue, avgRisk, atRiskCount, avgEbitdaMargin }: Props) => {
  const cards = [
    { label: "Portfolio Companies", value: companyCount.toString(), icon: Building2, color: "text-primary" },
    { label: "Total AUM", value: fmtCurrency(totalAUM), icon: DollarSign, color: "text-[hsl(var(--kpi-revenue))]" },
    { label: "Combined Revenue", value: fmtCurrency(totalRevenue), icon: TrendingUp, color: "text-[hsl(var(--kpi-customers))]" },
    { label: "Avg Risk Score", value: avgRisk.toString(), icon: BarChart3, color: avgRisk >= 60 ? "text-destructive" : avgRisk >= 40 ? "text-[hsl(var(--kpi-costs))]" : "text-[hsl(var(--kpi-revenue))]" },
    { label: "At-Risk Portcos", value: atRiskCount.toString(), icon: AlertTriangle, color: atRiskCount > 0 ? "text-destructive" : "text-[hsl(var(--kpi-revenue))]" },
    { label: "Avg EBITDA Margin", value: `${avgEbitdaMargin.toFixed(1)}%`, icon: BarChart3, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <c.icon className={`w-4 h-4 ${c.color}`} />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{c.label}</span>
          </div>
          <span className={`text-2xl font-bold ${c.color}`}>{c.value}</span>
        </div>
      ))}
    </div>
  );
};

export default PortfolioKPIBar;

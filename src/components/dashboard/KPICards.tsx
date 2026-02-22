import { TrendingUp, TrendingDown, DollarSign, Users, CreditCard, UserMinus } from "lucide-react";

interface KPICardsProps {
  revenue: number;
  customers: number;
  costRate: number;
  churnRate: number;
}

const formatValue = (v: number, prefix = "", suffix = "") => {
  if (v >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(1)}M${suffix}`;
  if (v >= 1_000) return `${prefix}${(v / 1_000).toFixed(1)}K${suffix}`;
  return `${prefix}${v.toFixed(1)}${suffix}`;
};

const KPICards = ({ revenue, customers, costRate, churnRate }: KPICardsProps) => {
  const kpis = [
    { label: "Revenue", value: formatValue(revenue, "€"), icon: DollarSign, variant: "kpi-gradient-revenue" },
    { label: "Customers", value: formatValue(customers), icon: Users, variant: "kpi-gradient-customers" },
    { label: "Cost Rate", value: formatValue(costRate, "€"), icon: CreditCard, variant: "kpi-gradient-costs" },
    { label: "Churn Rate", value: `${churnRate}%`, icon: UserMinus, variant: "kpi-gradient-churn" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className={`${kpi.variant} glass-card p-5 rounded-xl`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground font-medium">{kpi.label}</span>
            <kpi.icon className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold font-display">{kpi.value}</p>
        </div>
      ))}
    </div>
  );
};

export default KPICards;

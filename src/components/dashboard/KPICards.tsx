import { TrendingUp, TrendingDown, DollarSign, Users, CreditCard, UserMinus } from "lucide-react";

const kpis = [
  { label: "Revenue", value: "€1,290M", change: "+17.3%", up: true, icon: DollarSign, variant: "kpi-gradient-revenue" },
  { label: "Customers", value: "117,820", change: "+15.8%", up: true, icon: Users, variant: "kpi-gradient-customers" },
  { label: "Cost Rate", value: "€40M", change: "+0.9%", up: true, icon: CreditCard, variant: "kpi-gradient-costs" },
  { label: "Churn Rate", value: "2.1%", change: "-17.7%", up: false, icon: UserMinus, variant: "kpi-gradient-churn" },
];

const KPICards = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {kpis.map((kpi) => (
      <div key={kpi.label} className={`${kpi.variant} glass-card p-5 rounded-xl`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground font-medium">{kpi.label}</span>
          <kpi.icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <p className="text-2xl font-bold font-display">{kpi.value}</p>
        <div className="flex items-center gap-1 mt-1">
          {kpi.up ? (
            <TrendingUp className="w-3.5 h-3.5 text-success" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-destructive" />
          )}
          <span className={`text-xs font-medium ${kpi.up ? "text-success" : "text-destructive"}`}>
            {kpi.change}
          </span>
        </div>
      </div>
    ))}
  </div>
);

export default KPICards;

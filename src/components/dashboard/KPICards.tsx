import { useEffect, useRef, useState } from "react";
import { DollarSign, Users, CreditCard, UserMinus, TrendingUp, TrendingDown } from "lucide-react";

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

const AnimatedValue = ({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) => {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    const start = ref.current;
    const end = value;
    const duration = 800;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setDisplay(current);
      ref.current = current;
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <span>{formatValue(display, prefix, suffix)}</span>;
};

const KPICards = ({ revenue, customers, costRate, churnRate }: KPICardsProps) => {
  const kpis = [
    {
      label: "Revenue",
      value: revenue,
      prefix: "€",
      icon: DollarSign,
      variant: "kpi-gradient-revenue",
      color: "text-emerald-400",
      trend: revenue > 0 ? "up" as const : null,
    },
    {
      label: "Customers",
      value: customers,
      prefix: "",
      icon: Users,
      variant: "kpi-gradient-customers",
      color: "text-primary",
      trend: customers > 0 ? "up" as const : null,
    },
    {
      label: "Cost Rate",
      value: costRate,
      prefix: "€",
      icon: CreditCard,
      variant: "kpi-gradient-costs",
      color: "text-warning",
      trend: null,
    },
    {
      label: "Churn Rate",
      value: churnRate,
      prefix: "",
      suffix: "%",
      icon: UserMinus,
      variant: "kpi-gradient-churn",
      color: "text-destructive",
      trend: churnRate > 5 ? "down" as const : null,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
      {kpis.map((kpi) => {
        const TrendIcon = kpi.trend === "up" ? TrendingUp : kpi.trend === "down" ? TrendingDown : null;
        return (
          <div
            key={kpi.label}
            className={`${kpi.variant} glass-card p-5 rounded-xl group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{kpi.label}</span>
              <div className="flex items-center gap-1.5">
                {TrendIcon && (
                  <TrendIcon className={`w-3.5 h-3.5 ${kpi.trend === "up" ? "text-emerald-400" : "text-destructive"}`} />
                )}
                <kpi.icon className={`w-4 h-4 ${kpi.color} opacity-60`} />
              </div>
            </div>
            <p className="text-2xl font-bold font-display tracking-tight">
              {kpi.suffix ? (
                <>{kpi.value}{kpi.suffix}</>
              ) : (
                <AnimatedValue value={kpi.value} prefix={kpi.prefix} />
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default KPICards;

import { useEffect, useRef, useState } from "react";
import { DollarSign, Users, CreditCard, UserMinus, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardsProps {
  revenue: number;
  customers: number;
  costRate: number;
  churnRate: number;
  /** Previous period values for data-driven trend calculation */
  previousRevenue?: number;
  previousCustomers?: number;
  previousCostRate?: number;
  previousChurnRate?: number;
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

/** Data-driven trend: compare current vs previous period. Returns null if no comparison data. */
function deriveTrend(
  current: number,
  previous: number | undefined,
  invertPositive = false
): "up" | "down" | "flat" | null {
  if (previous == null || previous === 0) return null;
  const changePct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(changePct) < 1) return "flat"; // <1% change = flat
  const isUp = changePct > 0;
  if (invertPositive) return isUp ? "down" : "up"; // for cost/churn, up is bad
  return isUp ? "up" : "down";
}

function trendColor(trend: "up" | "down" | "flat" | null, isNegativeMetric: boolean): string {
  if (!trend || trend === "flat") return "text-muted-foreground";
  if (isNegativeMetric) return trend === "down" ? "text-success" : "text-destructive"; // lower cost/churn = good
  return trend === "up" ? "text-success" : "text-destructive";
}

const KPICards = ({
  revenue, customers, costRate, churnRate,
  previousRevenue, previousCustomers, previousCostRate, previousChurnRate,
}: KPICardsProps) => {
  const revenueTrend = deriveTrend(revenue, previousRevenue);
  const customerTrend = deriveTrend(customers, previousCustomers);
  const costTrend = deriveTrend(costRate, previousCostRate, true);
  const churnTrend = deriveTrend(churnRate, previousChurnRate, true);

  const kpis = [
    {
      label: "Revenue",
      value: revenue,
      prefix: "€",
      icon: DollarSign,
      variant: "kpi-gradient-revenue",
      color: "text-success",
      trend: revenueTrend,
      isNegative: false,
    },
    {
      label: "Customers",
      value: customers,
      prefix: "",
      icon: Users,
      variant: "kpi-gradient-customers",
      color: "text-primary",
      trend: customerTrend,
      isNegative: false,
    },
    {
      label: "Cost Rate",
      value: costRate,
      prefix: "€",
      icon: CreditCard,
      variant: "kpi-gradient-costs",
      color: "text-warning",
      trend: costTrend,
      isNegative: true,
    },
    {
      label: "Churn Rate",
      value: churnRate,
      prefix: "",
      suffix: "%",
      icon: UserMinus,
      variant: "kpi-gradient-churn",
      color: "text-destructive",
      trend: churnTrend,
      isNegative: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 stagger-children">
      {kpis.map((kpi) => {
        const TrendIcon = kpi.trend === "up" ? TrendingUp : kpi.trend === "down" ? TrendingDown : kpi.trend === "flat" ? Minus : null;
        const trendCls = trendColor(kpi.trend, kpi.isNegative);
        return (
          <div
            key={kpi.label}
            className={`${kpi.variant} glass-card p-3.5 sm:p-5 rounded-xl group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{kpi.label}</span>
              <div className="flex items-center gap-1.5">
                {TrendIcon && (
                  <TrendIcon className={`w-3.5 h-3.5 ${trendCls}`} />
                )}
                <kpi.icon className={`w-4 h-4 ${kpi.color} opacity-60`} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold font-display tracking-tight">
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

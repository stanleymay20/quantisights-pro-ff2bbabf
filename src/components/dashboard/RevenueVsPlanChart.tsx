import { Target, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  revenueByMonth: { month: string; revenue: number }[];
}

/**
 * Revenue vs Plan Chart — DATA-HONEST.
 *
 * Previous implementation fabricated an 8% monthly growth "plan" line
 * from the first data point — a fiction presented as a target.
 * No organization's plan was ever loaded.
 *
 * A real Rev vs Plan chart requires an actual budget/plan uploaded
 * or configured by the user.
 *
 * Now: shows honest empty state requiring actual plan data.
 */
const RevenueVsPlanChart = ({ revenueByMonth }: Props) => {
  return (
    <div className="glass-card p-5 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revenue vs Plan</h3>
      </div>
      <div className="py-6 text-center space-y-3">
        <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-5 h-5 text-warning" />
        </div>
        <div>
          <p className="text-sm font-medium mb-1">No plan data loaded</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Revenue vs Plan comparison requires an actual budget or forecast target.
            Map a <strong>revenue_plan</strong> or <strong>budget</strong> metric type in your dataset.
          </p>
        </div>
        <Link
          to="/data-upload"
          className="inline-flex text-xs font-semibold text-primary hover:underline"
        >
          Upload Plan Data →
        </Link>
      </div>
    </div>
  );
};

export default RevenueVsPlanChart;

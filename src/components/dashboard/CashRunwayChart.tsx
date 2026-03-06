import { Clock, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  revenueByMonth: { month: string; revenue: number }[];
  latestCost: number;
}

/**
 * Cash Runway Chart — DATA-HONEST.
 *
 * Previous implementation fabricated cash balances by:
 * - Assuming 30% cash retention ratio (no basis)
 * - Assuming 80% burn-to-revenue ratio (no basis)
 * - Projecting 2% monthly growth (no basis)
 *
 * A real cash runway requires actual cash balance, monthly burn rate, and
 * runway assumptions from the organization — not magic multipliers on revenue.
 *
 * Now: shows honest empty state requiring actual cash/burn data.
 */
const CashRunwayChart = ({ revenueByMonth, latestCost }: Props) => {
  return (
    <div className="glass-card p-5 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cash Runway</h3>
      </div>
      <div className="py-6 text-center space-y-3">
        <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-5 h-5 text-warning" />
        </div>
        <div>
          <p className="text-sm font-medium mb-1">Requires cash & burn data</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Cash runway projections require actual cash balance and monthly burn rate data. 
            Map <strong>cash_balance</strong> and <strong>burn_rate</strong> metric types in your dataset.
          </p>
        </div>
        <Link
          to="/data-upload"
          className="inline-flex text-xs font-semibold text-primary hover:underline"
        >
          Upload Financial Data →
        </Link>
      </div>
    </div>
  );
};

export default CashRunwayChart;

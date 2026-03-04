import { lazy } from "react";
import type { Insight } from "@/hooks/useInsights";

const RevenueChart = lazy(() => import("./RevenueChart"));
const CustomerSegmentation = lazy(() => import("./CustomerSegmentation"));
const AIInsights = lazy(() => import("./AIInsights"));
const AnomalyDetection = lazy(() => import("./AnomalyDetection"));
const WaterfallChart = lazy(() => import("./WaterfallChart"));
const FunnelChart = lazy(() => import("./FunnelChart"));
const PeriodComparison = lazy(() => import("./PeriodComparison"));
const GaugeChart = lazy(() => import("./GaugeChart"));
const EBITDABridgeChart = lazy(() => import("./EBITDABridgeChart"));
const CashRunwayChart = lazy(() => import("./CashRunwayChart"));
const RevenueVsPlanChart = lazy(() => import("./RevenueVsPlanChart"));
const ScenarioImpactChart = lazy(() => import("./ScenarioImpactChart"));
const PortfolioHealthRadar = lazy(() => import("./PortfolioHealthRadar"));

interface AnalyticsPanelProps {
  metrics: any[];
  revenueByMonth: any[];
  segmentData: Record<string, number>;
  insights: Insight[];
  latestChurn: number;
  latestCost: number;
}

const AnalyticsPanel = ({ metrics, revenueByMonth, segmentData, insights, latestChurn, latestCost }: AnalyticsPanelProps) => {
  return (
    <div className="space-y-5">
      {/* Row 1: Core Revenue Intelligence */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <RevenueChart data={revenueByMonth} />
        </div>
        <CustomerSegmentation data={segmentData} />
      </div>

      {/* Row 2: PE-Specific Financial Visuals */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        <EBITDABridgeChart metrics={metrics} />
        <RevenueVsPlanChart revenueByMonth={revenueByMonth} />
        <WaterfallChart data={metrics} />
      </div>

      {/* Row 3: Forward-Looking Intelligence */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        <CashRunwayChart revenueByMonth={revenueByMonth} latestCost={latestCost} />
        <ScenarioImpactChart insights={insights} />
        <PortfolioHealthRadar metrics={metrics} latestChurn={latestChurn} latestCost={latestCost} />
      </div>

      {/* Row 4: Operational Health Gauges */}
      <div className="grid md:grid-cols-3 gap-5">
        <GaugeChart
          value={latestChurn > 0 ? Math.max(0, 100 - latestChurn * 100) : 85}
          label="Retention Health"
        />
        <GaugeChart
          value={latestCost > 0 ? Math.max(0, 100 - latestCost * 100) : 70}
          label="Cost Efficiency"
        />
        <GaugeChart
          value={revenueByMonth.length >= 2
            ? Math.min(100, Math.max(0, ((revenueByMonth[revenueByMonth.length - 1]?.revenue ?? 0) / (revenueByMonth[0]?.revenue || 1) - 1) * 100 + 50))
            : 50}
          label="Growth Momentum"
        />
      </div>

      {/* Row 5: Conversion & Period Analysis */}
      <div className="grid md:grid-cols-2 gap-5">
        <FunnelChart metrics={metrics} />
        <PeriodComparison data={revenueByMonth} />
      </div>

      {/* Row 6: AI Intelligence */}
      <div className="grid lg:grid-cols-2 gap-5">
        <AIInsights insights={insights} />
        <AnomalyDetection insights={insights} />
      </div>
    </div>
  );
};

export default AnalyticsPanel;

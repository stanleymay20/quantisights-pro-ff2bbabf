import { lazy, useMemo } from "react";
import type { Insight } from "@/hooks/useInsights";

const AnalyticsSummary = lazy(() => import("./AnalyticsSummary"));
const RevenueChart = lazy(() => import("./RevenueChart"));
const CustomerSegmentation = lazy(() => import("./CustomerSegmentation"));
const AIInsights = lazy(() => import("./AIInsights"));
const AnomalyDetection = lazy(() => import("./AnomalyDetection"));
const WaterfallChart = lazy(() => import("./WaterfallChart"));
const FunnelChart = lazy(() => import("./FunnelChart"));
const PeriodComparison = lazy(() => import("./PeriodComparison"));
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
  isDemoMode?: boolean;
}

/**
 * Analytics Panel — DATA-HONEST.
 *
 * Removed:
 * - GaugeChart: was fed fabricated values (100 - churn*100, 100 - cost*100,
 *   arbitrary "growth momentum" formula). These are not real gauge metrics.
 *   Gauges require defined targets and actuals — neither existed.
 *
 * Retained: only charts that either use real data or show honest empty states.
 */
const AnalyticsPanel = ({ metrics, revenueByMonth, segmentData, insights, latestChurn, latestCost, isDemoMode }: AnalyticsPanelProps) => {
  const hasSegments = Object.keys(segmentData).length > 0;
  const hasFunnelData = metrics.some(m => m.metric_type === "leads" || m.metric_type === "qualified_leads");

  return (
    <div className="space-y-5">
      {/* Row 1: Core Revenue Intelligence */}
      <div className={`grid ${hasSegments ? "lg:grid-cols-3" : "lg:grid-cols-1"} gap-5`}>
        <div className={hasSegments ? "lg:col-span-2" : ""}>
          <RevenueChart data={revenueByMonth} />
        </div>
        {hasSegments && <CustomerSegmentation data={segmentData} />}
      </div>

      {/* Row 2: Financial Structure — hide empty panels in demo mode */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        <EBITDABridgeChart metrics={metrics} />
        {!isDemoMode && <RevenueVsPlanChart revenueByMonth={revenueByMonth} />}
        <WaterfallChart data={metrics} />
      </div>

      {/* Row 3: Forward-Looking — hide empty panels in demo mode */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {!isDemoMode && <CashRunwayChart revenueByMonth={revenueByMonth} latestCost={latestCost} />}
        {!isDemoMode && <ScenarioImpactChart insights={insights} />}
        <PortfolioHealthRadar metrics={metrics} latestChurn={latestChurn} latestCost={latestCost} />
      </div>

      {/* Row 4: Conversion & Period Analysis */}
      <div className="grid md:grid-cols-2 gap-5">
        {(!isDemoMode || hasFunnelData) && <FunnelChart metrics={metrics} />}
        <PeriodComparison data={revenueByMonth} />
      </div>

      {/* Row 5: AI Intelligence */}
      <div className="grid lg:grid-cols-2 gap-5">
        <AIInsights insights={insights} />
        <AnomalyDetection insights={insights} />
      </div>
    </div>
  );
};

export default AnalyticsPanel;

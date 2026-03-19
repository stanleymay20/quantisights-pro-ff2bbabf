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
 * Industrial-standard layout:
 * - Narrative summary first (CEO-level interpretation)
 * - Core revenue intelligence (area chart + segments)
 * - Financial structure (EBITDA bridge + P&L waterfall)
 * - Portfolio health radar (when ≥3 dimensions)
 * - Conversion & period comparison (when data exists)
 * - AI intelligence layer (insights + anomalies)
 *
 * Empty-state-only panels (CashRunway, RevVsPlan, ScenarioImpact)
 * are excluded — they add clutter without value until real data is mapped.
 */
const AnalyticsPanel = ({ metrics, revenueByMonth, segmentData, insights, latestChurn, latestCost, isDemoMode }: AnalyticsPanelProps) => {
  const hasSegments = Object.keys(segmentData).length > 0;
  const hasFunnelData = metrics.some(m => m.metric_type === "leads" || m.metric_type === "qualified_leads");
  const hasRevenue = metrics.some(m => m.metric_type === "revenue");
  const hasCostData = metrics.some(m => m.metric_type === "cost" || m.metric_type === "cogs");

  return (
    <div className="space-y-5">
      {/* Row 0: Narrative intelligence summary */}
      <AnalyticsSummary
        revenueByMonth={revenueByMonth}
        metrics={metrics}
        latestChurn={latestChurn}
        latestCost={latestCost}
      />

      {/* Row 1: Revenue trend + segmentation */}
      <div className={`grid ${hasSegments ? "lg:grid-cols-3" : "lg:grid-cols-1"} gap-5`}>
        <div className={hasSegments ? "lg:col-span-2" : ""}>
          <RevenueChart data={revenueByMonth} />
        </div>
        {hasSegments && <CustomerSegmentation data={segmentData} />}
      </div>

      {/* Row 2: Financial structure — only show charts that have renderable data */}
      {(hasRevenue || hasCostData) && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          <EBITDABridgeChart metrics={metrics} />
          <WaterfallChart data={metrics} />
          <PortfolioHealthRadar metrics={metrics} latestChurn={latestChurn} latestCost={latestCost} />
        </div>
      )}

      {/* Row 3: Conversion & period analysis */}
      <div className="grid md:grid-cols-2 gap-5">
        {hasFunnelData && <FunnelChart metrics={metrics} />}
        <PeriodComparison data={revenueByMonth} />
      </div>

      {/* Row 4: AI intelligence */}
      <div className="grid lg:grid-cols-2 gap-5">
        <AIInsights insights={insights} />
        <AnomalyDetection insights={insights} />
      </div>
    </div>
  );
};

export default AnalyticsPanel;

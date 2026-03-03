import { lazy, Suspense } from "react";
import { TrendingUp } from "lucide-react";
import type { Insight } from "@/hooks/useInsights";

const RevenueChart = lazy(() => import("./RevenueChart"));
const CustomerSegmentation = lazy(() => import("./CustomerSegmentation"));
const AIInsights = lazy(() => import("./AIInsights"));
const AnomalyDetection = lazy(() => import("./AnomalyDetection"));
const WaterfallChart = lazy(() => import("./WaterfallChart"));
const CohortAnalysis = lazy(() => import("./CohortAnalysis"));
const FunnelChart = lazy(() => import("./FunnelChart"));
const PeriodComparison = lazy(() => import("./PeriodComparison"));
const HeatmapChart = lazy(() => import("./HeatmapChart"));
const TreemapChart = lazy(() => import("./TreemapChart"));
const ScatterBubbleChart = lazy(() => import("./ScatterBubbleChart"));
const RadarChartComponent = lazy(() => import("./RadarChart"));
const GaugeChart = lazy(() => import("./GaugeChart"));
const SankeyChart = lazy(() => import("./SankeyChart"));
const BoxPlotChart = lazy(() => import("./BoxPlotChart"));

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
      {/* Row 1 */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <RevenueChart data={revenueByMonth} />
        </div>
        <CustomerSegmentation data={segmentData} />
      </div>

      {/* Row 2 */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        <WaterfallChart data={metrics} />
        <FunnelChart metrics={metrics} />
        <PeriodComparison data={revenueByMonth} />
      </div>

      <CohortAnalysis metrics={metrics} />

      {/* Row 3 */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        <HeatmapChart metrics={metrics} />
        <TreemapChart metrics={metrics} />
        <RadarChartComponent metrics={metrics} />
      </div>

      {/* Row 4 */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        <ScatterBubbleChart metrics={metrics} />
        <SankeyChart metrics={metrics} />
        <BoxPlotChart metrics={metrics} />
      </div>

      {/* Gauges */}
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

      {/* Intelligence Row */}
      <div className="grid lg:grid-cols-3 gap-5">
        <AIInsights insights={insights} />
        <AnomalyDetection insights={insights} />
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Historical Growth</h3>
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <p className="text-[11px] text-muted-foreground mb-6">Period-over-period change</p>
          <div className="text-center py-4">
            <p className="text-4xl font-bold font-display gradient-text">
              {revenueByMonth.length >= 2
                ? `${(((revenueByMonth[revenueByMonth.length - 1]?.revenue ?? 0) / (revenueByMonth[0]?.revenue || 1) - 1) * 100).toFixed(1)}%`
                : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-3">Growth over data period</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;

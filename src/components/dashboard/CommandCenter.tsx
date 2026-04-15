import { useState, lazy, Suspense, memo, useMemo } from "react";
import { filterCriticalInsights } from "@/lib/insight-filters";
import { BarChart3, ArrowRight } from "lucide-react";
import ProtectionStatus from "./ProtectionStatus";
import DecisionQueue from "./DecisionQueue";
import QuickDecisionLog from "./QuickDecisionLog";
import CalibrationProgress from "./CalibrationProgress";
import KPICards from "./KPICards";
import AnalystInsights from "./AnalystInsights";
import ExecutiveIntelligencePanel from "./ExecutiveIntelligencePanel";
import CrossContextAnalytics from "./CrossContextAnalytics";
import DecisionContextPanel from "./DecisionContextPanel";
import DataQualityScorecard from "./DataQualityScorecard";
import BoardroomBrief from "./BoardroomBrief";
import WhatChangedWidget from "./WhatChangedWidget";
import SUDALOperatingLoop from "./SUDALOperatingLoop";
import { useDecisionContexts, type DecisionContext } from "@/hooks/useDecisionContexts";
import type { Insight } from "@/hooks/useInsights";
import type { MetricTypeSummary, MetricRow } from "@/hooks/useMetrics";

const AnalyticsPanel = lazy(() => import("./AnalyticsPanel"));

interface CommandCenterProps {
  organizationId: string;
  insights: Insight[];
  hasData: boolean;
  churnRate: number;
  revenue: number;
  totalCustomers: number;
  latestCost: number;
  pendingDecisions: number;
  calibrationScore: number | null;
  metrics: MetricRow[];
  revenueByMonth: Array<{ month: string; revenue: number }>;
  segmentData: Record<string, number>;
  onDecisionLogged: () => void;
  /** Dynamic metric summaries — domain-agnostic */
  topMetrics?: MetricTypeSummary[];
  datasetId?: string;
  datasetName?: string | null;
  isDemoMode?: boolean;
}

const CommandCenter = memo(({
  organizationId,
  insights,
  hasData,
  churnRate,
  revenue,
  totalCustomers,
  latestCost,
  pendingDecisions,
  calibrationScore,
  metrics,
  revenueByMonth,
  segmentData,
  onDecisionLogged,
  topMetrics,
  datasetId,
  datasetName,
  isDemoMode,
}: CommandCenterProps) => {
  const [showAnalytics, setShowAnalytics] = useState(false);

  const {
    contexts,
    activeContext,
    setActiveContext,
    createContext,
    archiveContext,
  } = useDecisionContexts(organizationId);

  const criticalInsights = useMemo(
    () => filterCriticalInsights(insights),
    [insights]
  );

  return (
    <section aria-label="Command Center Dashboard" className="space-y-6 max-w-[1400px]">
      <DecisionContextPanel
        activeContext={activeContext}
        onContextChange={setActiveContext}
        contexts={contexts}
        onCreateContext={createContext}
        onArchiveContext={archiveContext}
      />

      <WhatChangedWidget organizationId={organizationId} />

      <SUDALOperatingLoop organizationId={organizationId} />

      <BoardroomBrief
        insights={insights}
        pendingDecisions={pendingDecisions}
        calibrationScore={calibrationScore}
        topMetrics={topMetrics}
      />

      <ProtectionStatus
        organizationId={organizationId}
        calibrationScore={calibrationScore}
        pendingDecisions={pendingDecisions}
        criticalSignals={criticalInsights.length}
      />

      <DecisionQueue
        organizationId={organizationId}
        insights={insights}
        churnRate={churnRate}
        revenue={revenue}
        pendingDecisions={pendingDecisions}
        calibrationScore={calibrationScore}
        datasetId={datasetId}
        activeContextId={activeContext?.id ?? null}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <QuickDecisionLog
          organizationId={organizationId}
          onLogged={onDecisionLogged}
        />
        <CalibrationProgress organizationId={organizationId} />
        <DataQualityScorecard />
      </div>

      <KPICards topMetrics={topMetrics} />

      <ExecutiveIntelligencePanel
        metrics={metrics}
        insights={insights}
        topMetrics={topMetrics ?? []}
        pendingDecisions={pendingDecisions}
        datasetName={datasetName}
      />

      <AnalystInsights
        insights={insights}
        metrics={metrics}
        topMetrics={topMetrics ?? []}
        datasetId={datasetId}
        datasetName={datasetName}
      />

      <CrossContextAnalytics organizationId={organizationId} />

      <div className="flex items-center justify-center">
        <button
          onClick={() => setShowAnalytics(!showAnalytics)}
          aria-expanded={showAnalytics}
          aria-controls="analytics-panel"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/40 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all group touch-target"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          {showAnalytics ? "Hide Analytics" : "View Full Analytics"}
          <ArrowRight className={`w-3 h-3 transition-transform ${showAnalytics ? "rotate-90" : "group-hover:translate-x-0.5"}`} />
        </button>
      </div>

      {showAnalytics && (
        <Suspense fallback={
          <div id="analytics-panel" aria-busy="true" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-muted/30 animate-pulse" aria-hidden="true" />
            ))}
          </div>
        }>
          <div id="analytics-panel">
            <AnalyticsPanel
              metrics={metrics}
              revenueByMonth={revenueByMonth}
              segmentData={segmentData}
              insights={insights}
              latestChurn={churnRate}
              latestCost={latestCost}
              isDemoMode={isDemoMode}
            />
          </div>
        </Suspense>
      )}
    </section>
  );
});

CommandCenter.displayName = "CommandCenter";

export default CommandCenter;

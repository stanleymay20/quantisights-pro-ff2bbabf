import { useState, lazy, Suspense, memo, useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart3, ArrowRight } from "lucide-react";
import ProtectionStatus from "./ProtectionStatus";
import DecisionQueue from "./DecisionQueue";
import QuickDecisionLog from "./QuickDecisionLog";
import CalibrationProgress from "./CalibrationProgress";
import KPICards from "./KPICards";
import type { Insight } from "@/hooks/useInsights";

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
  metrics: any[];
  revenueByMonth: any[];
  segmentData: Record<string, number>;
  onDecisionLogged: () => void;
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
}: CommandCenterProps) => {
  const [showAnalytics, setShowAnalytics] = useState(false);

  const criticalInsights = useMemo(
    () => insights.filter(i => i.severity === "high" || i.severity === "medium"),
    [insights]
  );

  return (
    <div className="space-y-6 max-w-[1400px]">
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
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <QuickDecisionLog
          organizationId={organizationId}
          onLogged={onDecisionLogged}
        />
        <CalibrationProgress organizationId={organizationId} />
      </div>

      <KPICards
        revenue={revenue}
        customers={totalCustomers}
        costRate={latestCost}
        churnRate={churnRate}
      />

      <div className="flex items-center justify-center">
        <button
          onClick={() => setShowAnalytics(!showAnalytics)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/40 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all group"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          {showAnalytics ? "Hide Analytics" : "View Full Analytics"}
          <ArrowRight className={`w-3 h-3 transition-transform ${showAnalytics ? "rotate-90" : "group-hover:translate-x-0.5"}`} />
        </button>
      </div>

      {showAnalytics && (
        <Suspense fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        }>
          <AnalyticsPanel
            metrics={metrics}
            revenueByMonth={revenueByMonth}
            segmentData={segmentData}
            insights={insights}
            latestChurn={churnRate}
            latestCost={latestCost}
          />
        </Suspense>
      )}
    </div>
  );
});

CommandCenter.displayName = "CommandCenter";

export default CommandCenter;

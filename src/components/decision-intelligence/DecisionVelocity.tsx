import { useMemo } from "react";
import { Timer, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { getDecisionIntelligenceConfig } from "@/lib/system-config";

interface Decision {
  id: string;
  created_at: string;
  decided_at: string | null;
  decision_status: string;
  execution_started_at: string | null;
  execution_completed_at: string | null;
}

/**
 * Decision Velocity Tracker.
 * Measures organizational decision-making speed:
 * - Time to Decision (recommendation → approval)
 * - Time to Execution (approval → completion)
 * - Total Cycle Time
 * - Velocity Trend (improving or degrading)
 */
const DecisionVelocity = ({ decisions }: { decisions: Decision[] }) => {
  const metrics = useMemo(() => {
    const decided = decisions.filter(
      (d) => d.decided_at && d.decision_status !== "pending"
    );

    if (decided.length === 0) return null;

    const calcDays = (start: string, end: string) =>
      (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24);

    // Time to Decision
    const ttdValues = decided.map((d) => calcDays(d.created_at, d.decided_at!));
    const avgTTD = ttdValues.reduce((s, v) => s + v, 0) / ttdValues.length;

    // Time to Execution
    const executed = decided.filter(
      (d) => d.execution_completed_at && d.execution_started_at
    );
    const tteValues = executed.map((d) =>
      calcDays(d.execution_started_at!, d.execution_completed_at!)
    );
    const avgTTE = tteValues.length > 0
      ? tteValues.reduce((s, v) => s + v, 0) / tteValues.length
      : null;

    // Total Cycle Time
    const completed = decided.filter((d) => d.execution_completed_at);
    const cycleValues = completed.map((d) =>
      calcDays(d.created_at, d.execution_completed_at!)
    );
    const avgCycle = cycleValues.length > 0
      ? cycleValues.reduce((s, v) => s + v, 0) / cycleValues.length
      : null;

    // Velocity Trend: compare first half vs second half
    let trend: "improving" | "stable" | "degrading" = "stable";
    if (ttdValues.length >= 4) {
      const mid = Math.floor(ttdValues.length / 2);
      const firstHalf = ttdValues.slice(0, mid).reduce((s, v) => s + v, 0) / mid;
      const secondHalf =
        ttdValues.slice(mid).reduce((s, v) => s + v, 0) / (ttdValues.length - mid);
      const config = getDecisionIntelligenceConfig().decisionVelocity;
      if (secondHalf < firstHalf * config.improvingThreshold) trend = "improving";
      else if (secondHalf > firstHalf * config.degradingThreshold) trend = "degrading";
    }

    // Pending decisions aging
    const pending = decisions.filter((d) => d.decision_status === "pending");
    const pendingAges = pending.map((d) =>
      calcDays(d.created_at, new Date().toISOString())
    );
    const avgPendingAge = pendingAges.length > 0
      ? pendingAges.reduce((s, v) => s + v, 0) / pendingAges.length
      : 0;

    return {
      avgTTD,
      avgTTE,
      avgCycle,
      trend,
      totalDecided: decided.length,
      avgPendingAge,
      pendingCount: pending.length,
    };
  }, [decisions]);

  if (!metrics) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Timer className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Decision Velocity</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          No resolved decisions yet. Velocity tracks time from recommendation to action.
        </p>
      </div>
    );
  }

  const TrendIcon =
    metrics.trend === "improving"
      ? TrendingDown
      : metrics.trend === "degrading"
      ? TrendingUp
      : Minus;
  const trendColor =
    metrics.trend === "improving"
      ? "text-emerald-400"
      : metrics.trend === "degrading"
      ? "text-destructive"
      : "text-muted-foreground";
  const trendLabel =
    metrics.trend === "improving"
      ? "Accelerating"
      : metrics.trend === "degrading"
      ? "Slowing"
      : "Stable";

  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-1">
        <Timer className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Decision Velocity</h3>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full ml-auto flex items-center gap-1 ${
            metrics.trend === "improving"
              ? "bg-emerald-500/10 text-emerald-400"
              : metrics.trend === "degrading"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <TrendIcon className="w-3 h-3" />
          {trendLabel}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">
        Organizational speed from recommendation → action → outcome
      </p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center bg-muted/20 rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Avg. Time to Decision
          </p>
          <p className="text-xl font-bold font-display text-primary">
            {metrics.avgTTD.toFixed(1)}d
          </p>
        </div>
        <div className="text-center bg-muted/20 rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Avg. Execution Time
          </p>
          <p className="text-xl font-bold font-display">
            {metrics.avgTTE != null ? `${metrics.avgTTE.toFixed(1)}d` : "—"}
          </p>
        </div>
        <div className="text-center bg-muted/20 rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Total Cycle Time
          </p>
          <p className="text-xl font-bold font-display">
            {metrics.avgCycle != null ? `${metrics.avgCycle.toFixed(1)}d` : "—"}
          </p>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Decisions Resolved</span>
          <span className="font-mono font-semibold">{metrics.totalDecided}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pending Decisions</span>
          <span className="font-mono font-semibold">{metrics.pendingCount}</span>
        </div>
        {metrics.pendingCount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avg. Pending Age</span>
            <span
              className={`font-mono font-semibold ${
                metrics.avgPendingAge > 7 ? "text-warning" : ""
              }`}
            >
              {metrics.avgPendingAge.toFixed(1)}d
            </span>
          </div>
        )}
      </div>

      {metrics.avgTTD > 5 && (
        <div className="mt-3 p-2.5 rounded-lg bg-warning/10 text-warning text-xs font-medium">
          ⚠ Average decision time exceeds 5 days — consider streamlining approval workflows
        </div>
      )}
    </div>
  );
};

export default DecisionVelocity;

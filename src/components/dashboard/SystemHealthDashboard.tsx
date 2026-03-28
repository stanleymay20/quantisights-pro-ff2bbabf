import { useSystemHealth } from "@/hooks/useSystemHealth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  RefreshCw,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Brain,
  Gauge,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props {
  orgId: string | null;
}

const SystemHealthDashboard = ({ orgId }: Props) => {
  const { health, loading, refresh } = useSystemHealth(orgId);

  if (!health) return null;

  const loopStatus = health.closedLoopRate >= 50
    ? "healthy"
    : health.closedLoopRate >= 20
    ? "developing"
    : "nascent";

  const statusColor = {
    healthy: "text-green-500",
    developing: "text-amber-500",
    nascent: "text-red-400",
  }[loopStatus];

  const statusBg = {
    healthy: "bg-green-500/10 border-green-500/20",
    developing: "bg-amber-500/10 border-amber-500/20",
    nascent: "bg-red-400/10 border-red-400/20",
  }[loopStatus];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">System Intelligence</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="h-8"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Closed Loop Rate — The Key Metric */}
      <Card className={`border ${statusBg}`}>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className={`h-4 w-4 ${statusColor}`} />
              <span className="text-sm font-medium text-foreground">Closed-Loop Rate</span>
            </div>
            <Badge variant="outline" className={statusColor}>
              {loopStatus}
            </Badge>
          </div>
          <div className="flex items-end gap-2 mb-2">
            <span className={`text-2xl font-bold ${statusColor}`}>
              {health.closedLoopRate}%
            </span>
            <span className="text-xs text-muted-foreground mb-1">
              {health.evaluatedOutcomes}/{health.totalDecisions} decisions measured
            </span>
          </div>
          <Progress value={health.closedLoopRate} className="h-1.5" />
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border border-border/50">
          <CardContent className="pt-3 pb-2 px-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Brain className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Calibration</span>
            </div>
            <div className="text-lg font-bold text-foreground">
              {health.calibrationScore !== null ? `${health.calibrationScore}%` : "—"}
            </div>
            {health.biasDirection && health.biasDirection !== "neutral" && (
              <span className="text-xs text-amber-500">
                {health.biasDirection === "overconfident" ? "↑ Over" : "↓ Under"}confident
              </span>
            )}
            {health.latestCalibrationAt && (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                v{health.calibrationModelVersion} · {formatDistanceToNow(new Date(health.latestCalibrationAt), { addSuffix: true })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/50">
          <CardContent className="pt-3 pb-2 px-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Gauge className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Avg Confidence</span>
            </div>
            <div className="text-lg font-bold text-foreground">
              {health.avgConfidence !== null ? `${health.avgConfidence}%` : "—"}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50">
          <CardContent className="pt-3 pb-2 px-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs text-muted-foreground">Open Signals</span>
            </div>
            <div className="text-lg font-bold text-foreground">
              {health.openAdvisories}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50">
          <CardContent className="pt-3 pb-2 px-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Insights (24h)</span>
            </div>
            <div className="text-lg font-bold text-foreground">
              {health.insightsLast24h}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Status */}
      <Card className="border border-border/50">
        <CardContent className="pt-3 pb-2 px-3">
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">Decision Pipeline</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Decisions</span>
              <span className="font-medium text-foreground">{health.totalDecisions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Completed</span>
              <span className="font-medium text-foreground">{health.completedDecisions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Outcomes Measured</span>
              <span className="font-medium text-emerald-500">{health.evaluatedOutcomes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pending Evaluation</span>
              <span className="font-medium text-amber-500">{health.pendingOutcomes}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemHealthDashboard;

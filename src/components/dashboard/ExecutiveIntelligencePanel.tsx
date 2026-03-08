import { useMemo } from "react";
import {
  Shield, TrendingUp, TrendingDown, AlertTriangle, Activity, BarChart3,
  Target, Gauge, ArrowUpRight, ArrowDownRight, Minus, Brain, RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import DecisionPerformanceDashboard from "./DecisionPerformanceDashboard";
import type { MetricRow, MetricTypeSummary } from "@/hooks/useMetrics";
import type { Insight } from "@/hooks/useInsights";
import {
  computeStrategicHealth,
  aggregateRiskSignals,
  generateForecast,
  generateExecutiveSummary,
  computePerformanceDrivers,
  type StrategicHealth,
  type RiskSignal,
  type ForecastResult,
} from "@/lib/executive-intelligence";

interface ExecutiveIntelligencePanelProps {
  metrics: MetricRow[];
  insights: Insight[];
  topMetrics: MetricTypeSummary[];
  pendingDecisions: number;
  datasetName?: string | null;
}

const riskColor = (level: string) => {
  switch (level) {
    case "critical": return "text-destructive bg-destructive/10";
    case "high": return "text-destructive bg-destructive/10";
    case "medium": return "text-yellow-600 bg-yellow-500/10";
    default: return "text-primary bg-primary/10";
  }
};

const healthColor = (score: number) => {
  if (score >= 70) return "text-primary";
  if (score >= 45) return "text-yellow-600";
  return "text-destructive";
};

// ── STRATEGIC HEALTH PANEL ──
const StrategicHealthPanel = ({ health }: { health: StrategicHealth | null }) => {
  if (!health) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-6 text-center">
          <Shield className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Insufficient data for strategic health assessment.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" /> Strategic Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Health Score</p>
            <p className={`text-3xl font-bold ${healthColor(health.overallScore)}`}>{health.overallScore}</p>
            <Progress value={health.overallScore} className="h-1 mt-1" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Growth Momentum</p>
            <div className="flex items-center gap-1">
              {health.growthMomentum > 0 ? <ArrowUpRight className="w-4 h-4 text-primary" /> :
               health.growthMomentum < 0 ? <ArrowDownRight className="w-4 h-4 text-destructive" /> :
               <Minus className="w-4 h-4 text-muted-foreground" />}
              <p className="text-2xl font-bold text-foreground">{health.growthMomentum > 0 ? "+" : ""}{health.growthMomentum}%</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Risk Level</p>
            <Badge variant="outline" className={`${riskColor(health.riskLevel)} border-current/20 capitalize`}>
              {health.riskLevel}
            </Badge>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Forecast Confidence</p>
            <ConfidenceBadge confidence={health.forecastConfidence} />
            <p className="text-[10px] text-muted-foreground mt-0.5">{health.dataPoints} data points</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ── RISK RADAR ──
const RiskRadarPanel = ({ risks }: { risks: RiskSignal[] }) => {
  if (risks.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-6 text-center">
          <Target className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No elevated risk signals detected.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Strategic Risk Radar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {risks.slice(0, 6).map((risk, i) => (
          <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg border ${riskColor(risk.level)} border-current/10`}>
            <div className="w-1.5 h-1.5 rounded-full bg-current mt-1.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider">{risk.category}</span>
                <Badge variant="outline" className="text-[9px] capitalize border-current/20">{risk.level}</Badge>
              </div>
              <p className="text-xs leading-relaxed">{risk.description}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// ── FORECAST PANEL ──
const ForecastPanel = ({ forecasts }: { forecasts: ForecastResult[] }) => {
  if (forecasts.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-6 text-center">
          <TrendingUp className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Forecast unavailable due to insufficient data. Requires ≥6 data points per metric.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" /> Forward Projections
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {forecasts.slice(0, 4).map((fc) => (
          <div key={fc.metric} className="p-3 rounded-lg border border-border/30 bg-card/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground capitalize">{fc.metric.replace(/_/g, " ")}</span>
              <ConfidenceBadge confidence={fc.confidence} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { ...fc.downside, color: "text-destructive" },
                { ...fc.baseline, color: "text-foreground" },
                { ...fc.upside, color: "text-primary" },
              ].map((scenario) => (
                <div key={scenario.label}>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{scenario.label}</p>
                  <p className={`text-sm font-bold ${scenario.color}`}>
                    {scenario.values[scenario.values.length - 1]?.toFixed(1)}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Based on {fc.sampleSize} observations · {fc.baseline.label.replace('Baseline ', '').replace(/[()]/g, '')}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// ── PERFORMANCE DRIVERS ──
const PerformanceDriversPanel = ({ drivers }: { drivers: ReturnType<typeof computePerformanceDrivers> }) => {
  if (!drivers || drivers.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-6 text-center">
          <Activity className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Insufficient data for driver analysis. Requires ≥8 data points across ≥2 metrics.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" /> Performance Drivers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {drivers.slice(0, 5).map((d, i) => (
          <div key={d.metric} className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground capitalize">{d.metric.replace(/_/g, " ")}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${d.changePct > 0 ? "text-primary" : "text-destructive"}`}>
                    {d.changePct > 0 ? "+" : ""}{d.changePct.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-muted-foreground">{d.contribution.toFixed(0)}% contribution</span>
                </div>
              </div>
              <Progress value={d.contribution} className="h-1" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// ── MAIN COMPONENT ──
const ExecutiveIntelligencePanel = ({
  metrics,
  insights,
  topMetrics,
  pendingDecisions,
  datasetName,
}: ExecutiveIntelligencePanelProps) => {
  const health = useMemo(() => computeStrategicHealth(metrics), [metrics]);
  const risks = useMemo(() => aggregateRiskSignals(metrics), [metrics]);
  const drivers = useMemo(() => computePerformanceDrivers(metrics), [metrics]);

  const forecasts = useMemo(() => {
    const byType = new Map<string, MetricRow[]>();
    metrics.forEach(m => {
      const list = byType.get(m.metric_type) || [];
      list.push(m);
      byType.set(m.metric_type, list);
    });

    const results: ForecastResult[] = [];
    byType.forEach((rows, type) => {
      const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
      const vals = sorted.map(r => Number(r.value));
      const fc = generateForecast(vals, type);
      if (fc) results.push(fc);
    });
    return results;
  }, [metrics]);

  const summary = useMemo(
    () => generateExecutiveSummary(health, risks, drivers, pendingDecisions, datasetName || undefined),
    [health, risks, drivers, pendingDecisions, datasetName]
  );

  return (
    <div className="space-y-4">
      {/* Executive Summary */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Brain className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">Executive Summary</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{summary}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Row 1: Strategic Health */}
      <StrategicHealthPanel health={health} />

      {/* Row 2: Risk Radar + Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RiskRadarPanel risks={risks} />
        <ForecastPanel forecasts={forecasts} />
      </div>

      {/* Row 3: Performance Drivers + Decision Outcomes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PerformanceDriversPanel drivers={drivers} />
        <DecisionPerformanceDashboard />
      </div>
    </div>
  );
};

export default ExecutiveIntelligencePanel;

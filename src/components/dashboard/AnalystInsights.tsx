import { useMemo } from "react";
import { Brain, TrendingDown, TrendingUp, AlertTriangle, BarChart3, Layers, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import type { Insight } from "@/hooks/useInsights";
import type { MetricRow, MetricTypeSummary } from "@/hooks/useMetrics";

interface AnalystInsightsProps {
  insights: Insight[];
  metrics: MetricRow[];
  topMetrics: MetricTypeSummary[];
  datasetName?: string | null;
}

interface AnalystFinding {
  type: "segmentation" | "correlation" | "anomaly" | "trend" | "driver";
  title: string;
  observation: string;
  inference: string;
  recommendation: string;
  severity: "high" | "medium" | "info";
  confidence: number;
  metricRef: string;
}

const AnalystInsights = ({ insights, metrics, topMetrics, datasetName }: AnalystInsightsProps) => {
  // Derive analyst-grade findings from raw metrics
  const findings = useMemo((): AnalystFinding[] => {
    if (metrics.length === 0) return [];
    const results: AnalystFinding[] = [];

    // Group by metric type
    const byType = new Map<string, MetricRow[]>();
    metrics.forEach(m => {
      const list = byType.get(m.metric_type) || [];
      list.push(m);
      byType.set(m.metric_type, list);
    });

    // TREND DETECTION per metric type
    byType.forEach((rows, type) => {
      if (rows.length < 4) return;
      const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
      const vals = sorted.map(r => Number(r.value));
      const mid = Math.floor(vals.length / 2);
      const earlyAvg = vals.slice(0, mid).reduce((s, v) => s + v, 0) / mid;
      const lateAvg = vals.slice(mid).reduce((s, v) => s + v, 0) / (vals.length - mid);
      const changePct = earlyAvg !== 0 ? ((lateAvg - earlyAvg) / Math.abs(earlyAvg)) * 100 : 0;

      if (Math.abs(changePct) > 10) {
        const direction = changePct > 0 ? "increased" : "decreased";
        results.push({
          type: "trend",
          title: `${type.replace(/_/g, " ")} trend shift`,
          observation: `${type.replace(/_/g, " ")} ${direction} ${Math.abs(changePct).toFixed(1)}% between early and recent periods across ${vals.length} data points.`,
          inference: `Sustained ${direction === "increased" ? "upward" : "downward"} movement detected. Recent average: ${lateAvg.toFixed(2)} vs early average: ${earlyAvg.toFixed(2)}.`,
          recommendation: changePct < -10
            ? `Investigate root causes for ${type.replace(/_/g, " ")} decline. Consider intervention strategies.`
            : `Capitalize on ${type.replace(/_/g, " ")} growth momentum. Monitor sustainability.`,
          severity: Math.abs(changePct) > 20 ? "high" : "medium",
          confidence: Math.min(85, 60 + Math.min(vals.length, 25)),
          metricRef: type,
        });
      }
    });

    // SEGMENTATION ANALYSIS
    byType.forEach((rows, type) => {
      const segments = new Map<string, number[]>();
      rows.forEach(r => {
        if (!r.segment) return;
        const list = segments.get(r.segment) || [];
        list.push(Number(r.value));
        segments.set(r.segment, list);
      });
      if (segments.size < 2) return;

      const segAvgs = [...segments.entries()].map(([seg, vals]) => ({
        segment: seg,
        avg: vals.reduce((s, v) => s + v, 0) / vals.length,
        count: vals.length,
      })).sort((a, b) => b.avg - a.avg);

      const best = segAvgs[0];
      const worst = segAvgs[segAvgs.length - 1];
      const spread = best.avg !== 0 ? ((best.avg - worst.avg) / Math.abs(best.avg)) * 100 : 0;

      if (spread > 15) {
        results.push({
          type: "segmentation",
          title: `${type.replace(/_/g, " ")} segment disparity`,
          observation: `"${best.segment}" leads with avg ${best.avg.toFixed(2)} while "${worst.segment}" trails at ${worst.avg.toFixed(2)} — a ${spread.toFixed(1)}% gap across ${segments.size} segments.`,
          inference: `Significant performance variance between segments suggests different underlying drivers or conditions.`,
          recommendation: `Deep-dive into "${worst.segment}" segment to identify improvement levers. Replicate "${best.segment}" success factors.`,
          severity: spread > 40 ? "high" : "medium",
          confidence: Math.min(80, 55 + segAvgs.reduce((s, a) => s + a.count, 0)),
          metricRef: type,
        });
      }
    });

    // ANOMALY DETECTION (simple z-score)
    byType.forEach((rows, type) => {
      const vals = rows.map(r => Number(r.value));
      if (vals.length < 5) return;
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
      if (std === 0) return;

      const anomalies = rows.filter(r => Math.abs((Number(r.value) - mean) / std) > 2);
      if (anomalies.length > 0 && anomalies.length <= vals.length * 0.1) {
        results.push({
          type: "anomaly",
          title: `${type.replace(/_/g, " ")} anomalies detected`,
          observation: `${anomalies.length} outlier${anomalies.length > 1 ? "s" : ""} found in ${type.replace(/_/g, " ")} (>2σ from mean ${mean.toFixed(2)}). Values: ${anomalies.slice(0, 3).map(a => Number(a.value).toFixed(2)).join(", ")}.`,
          inference: `These data points deviate significantly from the distribution (std dev: ${std.toFixed(2)}).`,
          recommendation: `Validate anomalous ${type.replace(/_/g, " ")} values. Check for data quality issues or genuine exceptional events.`,
          severity: "medium",
          confidence: Math.min(75, 50 + vals.length),
          metricRef: type,
        });
      }
    });

    // CROSS-METRIC CORRELATION (simple Pearson between top 2 metrics)
    const typeKeys = [...byType.keys()];
    if (typeKeys.length >= 2) {
      for (let i = 0; i < Math.min(typeKeys.length, 3); i++) {
        for (let j = i + 1; j < Math.min(typeKeys.length, 3); j++) {
          const aRows = byType.get(typeKeys[i])!;
          const bRows = byType.get(typeKeys[j])!;

          // Align by date
          const dateMap = new Map<string, { a?: number; b?: number }>();
          aRows.forEach(r => { const e = dateMap.get(r.date) || {}; e.a = Number(r.value); dateMap.set(r.date, e); });
          bRows.forEach(r => { const e = dateMap.get(r.date) || {}; e.b = Number(r.value); dateMap.set(r.date, e); });

          const pairs = [...dateMap.values()].filter(v => v.a !== undefined && v.b !== undefined);
          if (pairs.length < 5) continue;

          const aVals = pairs.map(p => p.a!);
          const bVals = pairs.map(p => p.b!);
          const aMean = aVals.reduce((s, v) => s + v, 0) / aVals.length;
          const bMean = bVals.reduce((s, v) => s + v, 0) / bVals.length;

          let num = 0, denA = 0, denB = 0;
          for (let k = 0; k < pairs.length; k++) {
            const da = aVals[k] - aMean;
            const db = bVals[k] - bMean;
            num += da * db;
            denA += da * da;
            denB += db * db;
          }
          const den = Math.sqrt(denA * denB);
          if (den === 0) continue;
          const corr = num / den;

          if (Math.abs(corr) > 0.5) {
            results.push({
              type: "correlation",
              title: `${typeKeys[i].replace(/_/g, " ")} ↔ ${typeKeys[j].replace(/_/g, " ")} correlation`,
              observation: `Pearson correlation between ${typeKeys[i].replace(/_/g, " ")} and ${typeKeys[j].replace(/_/g, " ")} = ${corr.toFixed(2)} across ${pairs.length} aligned observations.`,
              inference: corr > 0
                ? `Strong positive relationship: when ${typeKeys[i].replace(/_/g, " ")} rises, ${typeKeys[j].replace(/_/g, " ")} tends to rise.`
                : `Strong negative relationship: when ${typeKeys[i].replace(/_/g, " ")} rises, ${typeKeys[j].replace(/_/g, " ")} tends to fall.`,
              recommendation: `Use this correlation for predictive modeling. A change in ${typeKeys[i].replace(/_/g, " ")} may predict ${typeKeys[j].replace(/_/g, " ")} movement.`,
              severity: Math.abs(corr) > 0.8 ? "high" : "medium",
              confidence: Math.min(80, 50 + pairs.length * 2),
              metricRef: `${typeKeys[i]}, ${typeKeys[j]}`,
            });
          }
        }
      }
    }

    return results.sort((a, b) => {
      const sev = { high: 0, medium: 1, info: 2 };
      return (sev[a.severity] ?? 2) - (sev[b.severity] ?? 2);
    }).slice(0, 8);
  }, [metrics]);

  const typeIcon = (type: string) => {
    switch (type) {
      case "trend": return <TrendingUp className="w-4 h-4" />;
      case "anomaly": return <AlertTriangle className="w-4 h-4" />;
      case "segmentation": return <Layers className="w-4 h-4" />;
      case "correlation": return <BarChart3 className="w-4 h-4" />;
      case "driver": return <Brain className="w-4 h-4" />;
      default: return <Brain className="w-4 h-4" />;
    }
  };

  const sevColor = (sev: string) => {
    switch (sev) {
      case "high": return "text-destructive bg-destructive/10 border-destructive/20";
      case "medium": return "text-yellow-600 bg-yellow-500/10 border-yellow-500/20";
      default: return "text-primary bg-primary/10 border-primary/20";
    }
  };

  if (metrics.length === 0) {
    return (
      <div className="glass-card p-6 rounded-xl text-center">
        <Brain className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Upload data to enable analyst-grade analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold font-display uppercase tracking-wide text-muted-foreground">
            Analyst Mode
          </h3>
          {datasetName && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              {datasetName}
            </span>
          )}
        </div>
        <Link to="/dataset-explorer" className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5">
          Explore Data <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* AI-generated contextual insights */}
      {insights.length > 0 && (
        <div className="glass-card p-4 rounded-xl border border-primary/10">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-3">AI Intelligence</p>
          <div className="space-y-2">
            {insights.slice(0, 3).map(insight => (
              <div key={insight.id} className="flex items-start gap-3">
                <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${
                  insight.severity === "high" ? "bg-destructive" : insight.severity === "medium" ? "bg-yellow-500" : "bg-primary"
                }`} />
                <div className="flex-1">
                  <p className="text-[13px] text-foreground/80 leading-relaxed">{insight.message}</p>
                  {insight.confidence_score && (
                    <div className="mt-1">
                      <ConfidenceBadge confidence={insight.confidence_score} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistical findings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {findings.map((finding, i) => (
          <div key={i} className={`rounded-xl border p-4 ${sevColor(finding.severity)}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-background/80 flex items-center justify-center">
                {typeIcon(finding.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold capitalize">{finding.title}</p>
                <span className="text-[10px] opacity-70">{finding.type} · {finding.metricRef}</span>
              </div>
              <ConfidenceBadge confidence={finding.confidence} />
            </div>
            <div className="space-y-1.5 ml-9">
              <p className="text-[12px] leading-relaxed">
                <span className="font-semibold">Observed: </span>{finding.observation}
              </p>
              <p className="text-[12px] leading-relaxed opacity-80">
                <span className="font-semibold">Inference: </span>{finding.inference}
              </p>
              <p className="text-[12px] leading-relaxed opacity-70">
                <span className="font-semibold">Action: </span>{finding.recommendation}
              </p>
            </div>
          </div>
        ))}
      </div>

      {findings.length === 0 && (
        <div className="glass-card p-6 rounded-xl text-center">
          <p className="text-xs text-muted-foreground">Insufficient data variance for statistical analysis. Add more data points.</p>
        </div>
      )}
    </div>
  );
};

export default AnalystInsights;

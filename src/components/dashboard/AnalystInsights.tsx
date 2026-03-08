import { useMemo, useState } from "react";
import { Brain, TrendingUp, AlertTriangle, BarChart3, Layers, ArrowRight, FlaskConical, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "react-router-dom";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import type { Insight } from "@/hooks/useInsights";
import type { MetricRow, MetricTypeSummary } from "@/hooks/useMetrics";
import { runFullAnalysis, generateAnalystNote, type AnalystFinding } from "@/lib/analysis-engine";

interface AnalystInsightsProps {
  insights: Insight[];
  metrics: MetricRow[];
  topMetrics: MetricTypeSummary[];
  datasetName?: string | null;
  datasetId?: string;
}

const typeIcon = (type: string) => {
  switch (type) {
    case "trend": return <TrendingUp className="w-4 h-4" />;
    case "anomaly": return <AlertTriangle className="w-4 h-4" />;
    case "segmentation": return <Layers className="w-4 h-4" />;
    case "correlation": return <BarChart3 className="w-4 h-4" />;
    case "driver": return <Activity className="w-4 h-4" />;
    case "hypothesis": return <FlaskConical className="w-4 h-4" />;
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

const FindingCard = ({ finding }: { finding: AnalystFinding }) => {
  const [showExplain, setShowExplain] = useState(false);

  return (
    <div className={`rounded-xl border p-4 ${sevColor(finding.severity)}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-background/80 flex items-center justify-center">
          {typeIcon(finding.type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold capitalize">{finding.title}</p>
          <span className="text-[10px] opacity-70">
            {finding.type} · {finding.metricRef}
            {finding.pValue !== null && ` · p=${finding.pValue.toFixed(4)}`}
          </span>
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
          <span className="font-semibold">Decision relevance: </span>{finding.decisionRelevance}
        </p>
        <p className="text-[12px] leading-relaxed opacity-60">
          <span className="font-semibold">Action: </span>{finding.recommendation}
        </p>

        {/* Explainability toggle */}
        <button
          onClick={() => setShowExplain(!showExplain)}
          className="text-[10px] flex items-center gap-1 mt-1 opacity-50 hover:opacity-80 transition-opacity"
        >
          {showExplain ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showExplain ? "Hide" : "Show"} methodology
        </button>
        {showExplain && (
          <div className="text-[10px] opacity-50 space-y-0.5 border-t border-current/10 pt-1.5 mt-1">
            <p><span className="font-semibold">Method:</span> {finding.explain.method}</p>
            <p><span className="font-semibold">Sample:</span> n={finding.explain.sampleSize}</p>
            <p><span className="font-semibold">Variables:</span> {finding.explain.variables.join(", ")}</p>
            <p><span className="font-semibold">Assumptions:</span> {finding.explain.assumptions.join("; ")}</p>
            <p><span className="font-semibold">Limitations:</span> {finding.explain.limitations.join("; ")}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const AnalystInsights = ({ insights, metrics, topMetrics, datasetName, datasetId }: AnalystInsightsProps) => {
  const findings = useMemo(() => runFullAnalysis(metrics, datasetId), [metrics, datasetId]);
  const analystNote = useMemo(() => generateAnalystNote(findings), [findings]);

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
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {findings.length} findings
          </span>
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
          <FindingCard key={i} finding={finding} />
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

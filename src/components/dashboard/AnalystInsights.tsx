import { useMemo, useState } from "react";
import { Brain, TrendingUp, AlertTriangle, BarChart3, Layers, ArrowRight, FlaskConical, Activity, ChevronDown, ChevronUp, Download, FileText, Table2, Waves, GitBranch, BarChart } from "lucide-react";
import { Link } from "react-router-dom";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import OutputClassificationBadge from "@/components/dashboard/OutputClassificationBadge";
import type { OutputClassification } from "@/components/dashboard/OutputClassificationBadge";
import type { Insight } from "@/hooks/useInsights";
import type { MetricRow, MetricTypeSummary } from "@/hooks/useMetrics";
import { runFullAnalysis, generateAnalystNote, type AnalystFinding } from "@/lib/analysis-engine";
import { exportAndDownload } from "@/lib/executive-export";
import { buildSourceContext, validateAIOutput } from "@/lib/anti-hallucination";
import { profileDistribution, detectSeasonality, detectChangepoints } from "@/lib/advanced-statistics";
import { detectIndustry } from "@/lib/industry-detection";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

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

import { getSeverityStyle } from "@/lib/severity-colors";

const sevColor = (sev: string) => {
  const style = getSeverityStyle(sev);
  return `${style.text} ${style.bg} ${style.border}`;
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
        <OutputClassificationBadge
          classification={finding.type === "anomaly" || finding.type === "trend" ? "STATISTICAL_INFERENCE" : "HEURISTIC_ESTIMATE"}
          compact
        />
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
  const findings = useMemo(() => runFullAnalysis(metrics, datasetId, datasetName || undefined), [metrics, datasetId, datasetName]);
  const analystNote = useMemo(() => generateAnalystNote(findings), [findings]);

  // Industry detection
  const industryProfile = useMemo(() => {
    const metricTypes = [...new Set(metrics.map(m => m.metric_type))];
    const segments = [...new Set(metrics.map(m => m.segment).filter(Boolean))] as string[];
    const regions = [...new Set(metrics.map(m => m.region).filter(Boolean))] as string[];
    return detectIndustry(metricTypes, segments, regions, datasetName || undefined);
  }, [metrics, datasetName]);

  // Advanced statistical profiling summary
  const dataHealth = useMemo(() => {
    const byType = new Map<string, number[]>();
    metrics.forEach(m => {
      const list = byType.get(m.metric_type) || [];
      list.push(Number(m.value));
      byType.set(m.metric_type, list);
    });

    let seasonalCount = 0;
    let nonNormalCount = 0;
    let changepointCount = 0;
    const totalTypes = byType.size;

    byType.forEach((vals) => {
      if (vals.length >= 12) {
        const s = detectSeasonality(vals);
        if (s.detected) seasonalCount++;
      }
      if (vals.length >= 8) {
        const d = profileDistribution(vals);
        if (!d.isNormal) nonNormalCount++;
      }
      if (vals.length >= 10) {
        const sorted = [...vals]; // already numeric
        const cp = detectChangepoints(sorted);
        if (cp.length > 0) changepointCount++;
      }
    });

    return { seasonalCount, nonNormalCount, changepointCount, totalTypes };
  }, [metrics]);

  // Anti-hallucination: validate AI insights against source data
  const sourceContext = useMemo(() => buildSourceContext(
    metrics.map(m => ({ metric_type: m.metric_type, date: m.date, value: Number(m.value), region: m.region, segment: m.segment })),
    datasetName || undefined
  ), [metrics, datasetName]);

  const validatedInsights = useMemo(() => {
    return insights.map(insight => {
      const validation = validateAIOutput(insight.message, sourceContext);
      return { ...insight, _validation: validation };
    });
  }, [insights, sourceContext]);

  if (metrics.length === 0) {
    return (
      <div className="glass-card p-6 rounded-xl text-center">
        <Brain className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Upload data to enable analyst-grade analysis</p>
      </div>
    );
  }

  const handleExport = (format: "csv" | "markdown" | "json") => {
    exportAndDownload(findings, {
      format,
      title: "Analysis Report",
      datasetName: datasetName || undefined,
      organizationName: undefined,
    });
  };

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
          {industryProfile.confidence > 40 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
              {industryProfile.industry}{industryProfile.subIndustry ? ` · ${industryProfile.subIndustry}` : ""}
            </span>
          )}
          {dataHealth.seasonalCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/50 text-accent-foreground flex items-center gap-0.5">
              <Waves className="w-2.5 h-2.5" /> {dataHealth.seasonalCount} seasonal
            </span>
          )}
          {dataHealth.changepointCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive flex items-center gap-0.5">
              <GitBranch className="w-2.5 h-2.5" /> {dataHealth.changepointCount} regime shift{dataHealth.changepointCount > 1 ? "s" : ""}
            </span>
          )}
          {dataHealth.nonNormalCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground flex items-center gap-0.5">
              <BarChart className="w-2.5 h-2.5" /> {dataHealth.nonNormalCount} non-normal
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <Download className="w-3 h-3 mr-1" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("markdown")}>
                <FileText className="w-3 h-3 mr-2" /> Board Report (Markdown)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                <Table2 className="w-3 h-3 mr-2" /> Spreadsheet (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("json")}>
                <Download className="w-3 h-3 mr-2" /> Structured (JSON)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link to="/dataset-explorer" className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5">
            Explore Data <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* AI-generated contextual insights with anti-hallucination validation */}
      {validatedInsights.length > 0 && (
        <div className="glass-card p-4 rounded-xl border border-primary/10">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">AI Intelligence</p>
            <Badge variant="outline" className="text-[9px] h-4">
              Validated against source data
            </Badge>
          </div>
          <div className="space-y-2">
            {validatedInsights.slice(0, 3).map(insight => {
              const v = (insight as Record<string, unknown>)._validation as { sanitized?: string; score?: number; flags?: Array<{ severity: string }> } | undefined;
              const criticalFlags = v?.flags?.filter((f) => f.severity === "critical").length || 0;
              
              // Skip insights with critical hallucination flags
              if (criticalFlags > 0) return null;
              
              return (
                <div key={insight.id} className="flex items-start gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${getSeverityStyle(insight.severity).dot}`} />
                  <div className="flex-1">
                    <p className="text-[13px] text-foreground/80 leading-relaxed">
                      {v?.sanitized || insight.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {insight.confidence_score && <ConfidenceBadge confidence={insight.confidence_score} />}
                      {v && v.score < 80 && (
                        <Badge variant="outline" className="text-[9px] h-4 text-yellow-600 border-yellow-500/30">
                          {v.flags.length} validation note{v.flags.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      {v && v.score >= 80 && (
                        <Badge variant="outline" className="text-[9px] h-4 text-green-600 border-green-500/30">
                          ✓ Verified
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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

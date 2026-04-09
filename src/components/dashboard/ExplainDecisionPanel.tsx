/**
 * ExplainDecisionPanel — "Why this decision?"
 *
 * Collapsible panel that shows the full reasoning chain behind
 * every auto-generated decision, grounded in real data signals.
 */

import { useState } from "react";
import {
  ChevronDown, ChevronUp, Database, TrendingDown, Brain,
  Cpu, Target, ShieldCheck, AlertTriangle, Clock, Tag, Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface ExplanationMetadata {
  source_data?: {
    dataset_name?: string;
    dataset_id?: string;
    time_range?: string;
    rows_analyzed?: number;
    key_metrics?: string[];
  };
  triggering_insight?: {
    pattern_type?: string;
    description?: string;
    metric_name?: string;
    change_value?: string;
    change_direction?: string;
  };
  reasoning?: {
    what_happened?: string;
    why_it_matters?: string;
    why_this_recommendation?: string;
  };
  recommendation_logic?: {
    method?: string;
    description?: string;
  };
  expected_impact?: {
    range?: string;
    basis?: string;
  };
  confidence_explanation?: {
    score?: number;
    meaning?: string;
    capped?: boolean;
    cap_reason?: string;
  };
  assumptions?: string[];
  limitations?: string[];
}

interface Props {
  explanation: ExplanationMetadata | null | undefined;
  sourceInsightSummary?: string | null;
  recommendationLogicType?: string | null;
  decisionOrigin?: string;
  createdAt?: string;
  advisoryInstanceId?: string | null;
  datasetId?: string | null;
  confidenceAtDecision?: number | null;
  cappedConfidence?: number | null;
  rawConfidence?: number | null;
  confidenceCapReason?: string | null;
}

const LOGIC_LABELS: Record<string, string> = {
  trend_detection: "Trend Detection",
  threshold_breach: "Threshold Breach",
  forecast_deviation: "Forecast Deviation",
  anomaly_detection: "Anomaly Detection",
  correlation_analysis: "Correlation Analysis",
  statistical_inference: "Statistical Inference",
};

const ExplainDecisionPanel = ({
  explanation,
  sourceInsightSummary,
  recommendationLogicType,
  decisionOrigin = "ai_generated",
  createdAt,
  advisoryInstanceId,
  datasetId,
  confidenceAtDecision,
  cappedConfidence,
  rawConfidence,
  confidenceCapReason,
}: Props) => {
  const [expanded, setExpanded] = useState(false);

  const meta = explanation ?? {};
  const hasExplanation = explanation || sourceInsightSummary || recommendationLogicType;

  return (
    <div className="border border-border/40 rounded-lg overflow-hidden bg-card/50">
      {/* Origin badge + toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">Why this decision?</span>
          {decisionOrigin === "ai_generated" && (
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
              AI-Generated Recommendation
            </Badge>
          )}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/20 pt-3">
          {/* Decision metadata bar */}
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {createdAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Created {new Date(createdAt).toLocaleString()}
              </span>
            )}
            {advisoryInstanceId && (
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                Source: {advisoryInstanceId.slice(0, 8)}…
              </span>
            )}
            {datasetId && (
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3" />
                Dataset: {datasetId.slice(0, 8)}…
              </span>
            )}
          </div>

          {/* 1. Source Data */}
          {meta.source_data && (
            <Section icon={Database} title="Source Data">
              {meta.source_data.dataset_name && (
                <Bullet label="Dataset">{meta.source_data.dataset_name}</Bullet>
              )}
              {meta.source_data.time_range && (
                <Bullet label="Time range">{meta.source_data.time_range}</Bullet>
              )}
              {meta.source_data.rows_analyzed != null && (
                <Bullet label="Rows analyzed">{meta.source_data.rows_analyzed.toLocaleString()}</Bullet>
              )}
              {meta.source_data.key_metrics && meta.source_data.key_metrics.length > 0 && (
                <Bullet label="Key metrics">{meta.source_data.key_metrics.join(", ")}</Bullet>
              )}
            </Section>
          )}

          {/* 2. Triggering Insight */}
          <Section icon={TrendingDown} title="Triggering Insight">
            {sourceInsightSummary ? (
              <p className="text-sm text-foreground">{sourceInsightSummary}</p>
            ) : meta.triggering_insight?.description ? (
              <p className="text-sm text-foreground">{meta.triggering_insight.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No triggering insight recorded</p>
            )}
            {meta.triggering_insight?.pattern_type && (
              <Badge variant="secondary" className="mt-1 text-[10px]">
                {meta.triggering_insight.pattern_type}
              </Badge>
            )}
          </Section>

          {/* 3. Reasoning */}
          {meta.reasoning && (
            <Section icon={Brain} title="Reasoning">
              {meta.reasoning.what_happened && (
                <Bullet label="What happened">{meta.reasoning.what_happened}</Bullet>
              )}
              {meta.reasoning.why_it_matters && (
                <Bullet label="Why it matters">{meta.reasoning.why_it_matters}</Bullet>
              )}
              {meta.reasoning.why_this_recommendation && (
                <Bullet label="Why this recommendation">{meta.reasoning.why_this_recommendation}</Bullet>
              )}
            </Section>
          )}

          {/* 4. Recommendation Logic */}
          <Section icon={Cpu} title="Recommendation Logic">
            {recommendationLogicType ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {LOGIC_LABELS[recommendationLogicType] ?? recommendationLogicType}
                </Badge>
                {meta.recommendation_logic?.description && (
                  <span className="text-sm text-muted-foreground">{meta.recommendation_logic.description}</span>
                )}
              </div>
            ) : meta.recommendation_logic ? (
              <p className="text-sm text-muted-foreground">
                {meta.recommendation_logic.method ?? "Rule-based analysis"}
                {meta.recommendation_logic.description && ` — ${meta.recommendation_logic.description}`}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Statistical analysis of detected patterns</p>
            )}
          </Section>

          {/* 5. Expected Impact */}
          {meta.expected_impact && (
            <Section icon={Target} title="Expected Impact">
              {meta.expected_impact.range && (
                <Bullet label="Estimated range">{meta.expected_impact.range}</Bullet>
              )}
              {meta.expected_impact.basis && (
                <Bullet label="Based on">{meta.expected_impact.basis}</Bullet>
              )}
            </Section>
          )}

          {/* 6. Confidence Score */}
          <Section icon={ShieldCheck} title="Confidence Score">
            <div className="flex items-center gap-3">
              {(confidenceAtDecision ?? cappedConfidence ?? rawConfidence) != null && (
                <span className="text-lg font-bold text-foreground">
                  {confidenceAtDecision ?? cappedConfidence ?? rawConfidence}%
                </span>
              )}
              {rawConfidence != null && cappedConfidence != null && rawConfidence !== cappedConfidence && (
                <span className="text-[11px] text-muted-foreground">
                  (Raw: {rawConfidence}% → Capped: {cappedConfidence}%)
                </span>
              )}
            </div>
            {meta.confidence_explanation?.meaning && (
              <p className="text-sm text-muted-foreground mt-1">{meta.confidence_explanation.meaning}</p>
            )}
            {(confidenceCapReason || meta.confidence_explanation?.cap_reason) && (
              <p className="text-[11px] text-warning mt-1">
                Capped because: {confidenceCapReason ?? meta.confidence_explanation?.cap_reason}
              </p>
            )}
          </Section>

          {/* 7. Assumptions */}
          {meta.assumptions && meta.assumptions.length > 0 && (
            <Section icon={AlertTriangle} title="Assumptions" iconColor="text-warning">
              <ul className="space-y-1">
                {meta.assumptions.map((a, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-warning mt-0.5">•</span> {a}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Limitations */}
          {meta.limitations && meta.limitations.length > 0 && (
            <Section icon={AlertTriangle} title="Limitations" iconColor="text-destructive">
              <ul className="space-y-1">
                {meta.limitations.map((l, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-destructive mt-0.5">•</span> {l}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Fallback if no metadata at all */}
          {!hasExplanation && (
            <p className="text-sm text-muted-foreground italic">
              Detailed explanation metadata is not available for this decision.
              It may have been created before the explainability system was active.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/* ----- helpers ----- */

function Section({
  icon: Icon,
  title,
  iconColor = "text-muted-foreground",
  children,
}: {
  icon: typeof Database;
  title: string;
  iconColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">{title}</span>
      </div>
      <div className="pl-5.5">{children}</div>
    </div>
  );
}

function Bullet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span> {children}
    </p>
  );
}

export default ExplainDecisionPanel;

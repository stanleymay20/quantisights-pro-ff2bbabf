import { memo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, TrendingUp, TrendingDown, Target, History, AlertTriangle, CheckCircle2, Loader2, Info, ShieldQuestion, Sparkles } from "lucide-react";
import { useSimilarDecisions, type RetrievalQuality } from "@/hooks/useSimilarDecisions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SimilarDecisionsPanelProps {
  organizationId: string;
  queryText: string;
  onConfidenceAdjustment?: (adjustment: number, rationale: string) => void;
}

const TIER_STYLES = {
  strong: { bg: "bg-success/10", text: "text-success", label: "Strong" },
  moderate: { bg: "bg-warning/10", text: "text-warning", label: "Moderate" },
  weak: { bg: "bg-muted/20", text: "text-muted-foreground", label: "Weak" },
} as const;

const QUALITY_CONFIG: Record<RetrievalQuality, { icon: typeof Sparkles; color: string; label: string; description: string }> = {
  high: { icon: Sparkles, color: "text-success", label: "High confidence retrieval", description: "Strong semantic matches found — historical context is highly relevant." },
  moderate: { icon: CheckCircle2, color: "text-warning", label: "Moderate retrieval", description: "Partial matches found — context is directionally useful but may not be directly comparable." },
  low: { icon: ShieldQuestion, color: "text-muted-foreground", label: "Weak retrieval", description: "Only weak matches found — this appears to be a novel decision domain. Use historical context with caution." },
  none: { icon: Info, color: "text-muted-foreground", label: "No precedent", description: "No similar past decisions found. This is a novel decision for your organization." },
};

const SimilarDecisionsPanel = memo(({ organizationId, queryText, onConfidenceAdjustment }: SimilarDecisionsPanelProps) => {
  const {
    similar, loading, error, historicalSuccessRate, avgAccuracy,
    confidenceAdjustment, retrievalQuality, queryCategory, matchSummary, fetch,
  } = useSimilarDecisions(organizationId);

  useEffect(() => {
    if (queryText && queryText.length > 10) {
      fetch(queryText);
    }
  }, [queryText, fetch]);

  useEffect(() => {
    if (confidenceAdjustment !== 0 && onConfidenceAdjustment) {
      const strength = retrievalQuality === "high" ? "strong" : "moderate";
      const rationale = confidenceAdjustment > 0
        ? `Historical accuracy of similar decisions is ${strength} (avg ${avgAccuracy}%), confidence boosted by ${confidenceAdjustment}pp.`
        : `Historical accuracy of similar decisions is low (avg ${avgAccuracy}%), confidence reduced by ${Math.abs(confidenceAdjustment)}pp. (${strength} evidence)`;
      onConfidenceAdjustment(confidenceAdjustment, rationale);
    }
  }, [confidenceAdjustment, avgAccuracy, onConfidenceAdjustment, retrievalQuality]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/20 border border-border/20">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">Searching institutional memory...</span>
      </div>
    );
  }

  if (error) return null;

  const qualityConfig = QUALITY_CONFIG[retrievalQuality];
  const QualityIcon = qualityConfig.icon;
  const outcomes = similar.filter(s => s.entity_type === "outcome");

  // Show panel even with no results (to communicate "novel decision")
  if (retrievalQuality === "none" && similar.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border/20 bg-muted/5 p-3"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-muted/20 flex items-center justify-center">
            <Info className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div>
            <h4 className="text-xs font-semibold font-display text-muted-foreground">Novel Decision</h4>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              No similar past decisions found{queryCategory ? ` in ${queryCategory}` : ""}. This decision will establish a new precedent.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border/30 bg-muted/10 p-3 sm:p-4"
    >
      {/* Header with retrieval quality */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
          <History className="w-3.5 h-3.5 text-primary" />
        </div>
        <h4 className="text-xs font-semibold font-display">Institutional Memory</h4>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1 ml-auto px-1.5 py-0.5 rounded-full ${retrievalQuality === "high" ? "bg-success/10" : retrievalQuality === "moderate" ? "bg-warning/10" : "bg-muted/20"}`}>
              <QualityIcon className={`w-3 h-3 ${qualityConfig.color}`} />
              <span className={`text-[9px] font-semibold ${qualityConfig.color}`}>{qualityConfig.label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px]">
            <p className="text-xs">{qualityConfig.description}</p>
            {matchSummary && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {matchSummary.strong} strong · {matchSummary.moderate} moderate · {matchSummary.weak} weak of {matchSummary.total_candidates} candidates
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Low-quality warning banner */}
      {retrievalQuality === "low" && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-warning/5 border border-warning/10 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
          <p className="text-[10px] text-warning/80 leading-relaxed">
            Only weak matches found{queryCategory ? ` for "${queryCategory}" decisions` : ""}. Historical context may not be directly comparable. Confidence adjustments are reduced.
          </p>
        </div>
      )}

      {/* Historical performance summary */}
      {(historicalSuccessRate != null || avgAccuracy != null) && (
        <div className="flex flex-wrap items-center gap-3 p-2.5 rounded-lg bg-muted/30 mb-3">
          {historicalSuccessRate != null && (
            <div className="flex items-center gap-1.5">
              <Target className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Success rate:</span>
              <span className={`text-xs font-bold font-mono ${historicalSuccessRate >= 60 ? "text-success" : historicalSuccessRate >= 40 ? "text-warning" : "text-destructive"}`}>
                {historicalSuccessRate}%
              </span>
            </div>
          )}
          {avgAccuracy != null && (
            <div className="flex items-center gap-1.5">
              <Brain className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Avg accuracy:</span>
              <span className={`text-xs font-bold font-mono ${avgAccuracy >= 70 ? "text-success" : avgAccuracy >= 40 ? "text-warning" : "text-destructive"}`}>
                {avgAccuracy}%
              </span>
            </div>
          )}
          {confidenceAdjustment !== 0 && (
            <div className="flex items-center gap-1.5">
              {confidenceAdjustment > 0 ? (
                <CheckCircle2 className="w-3 h-3 text-success" />
              ) : (
                <AlertTriangle className="w-3 h-3 text-warning" />
              )}
              <span className="text-[10px] font-medium">
                Confidence {confidenceAdjustment > 0 ? "+" : ""}{confidenceAdjustment}pp
              </span>
            </div>
          )}
        </div>
      )}

      {/* Similar decisions list with match tiers */}
      <div className="space-y-1.5 max-h-52 overflow-y-auto">
        <AnimatePresence>
          {similar.slice(0, 6).map((item, i) => {
            const meta = item.metadata as any;
            const isOutcome = item.entity_type === "outcome";
            const relevance = Math.round(item.similarity * 100);
            const tierStyle = TIER_STYLES[item.match_tier] || TIER_STYLES.weak;

            return (
              <motion.div
                key={item.entity_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="py-1.5 px-2 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    isOutcome ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                  }`}>
                    {item.entity_type}
                  </span>
                  <span className={`text-[8px] font-semibold px-1 py-0.5 rounded ${tierStyle.bg} ${tierStyle.text}`}>
                    {tierStyle.label}
                  </span>
                  <p className="text-[11px] flex-1 truncate">{item.content_text.slice(0, 100)}</p>
                  <span className="text-[9px] text-muted-foreground font-mono shrink-0">{relevance}%</span>
                </div>

                {/* Match rationale */}
                {item.match_rationale && (
                  <p className="mt-0.5 ml-[72px] text-[9px] text-muted-foreground/70 italic truncate">
                    {item.match_rationale}
                  </p>
                )}

                {isOutcome && meta?.outcome_delta != null && (
                  <div className="mt-1 ml-[72px] flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1">
                      {meta.outcome_delta > 0 ? (
                        <TrendingUp className="w-3 h-3 text-success" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-destructive" />
                      )}
                      <span className={`font-mono font-semibold ${meta.outcome_delta > 0 ? "text-success" : "text-destructive"}`}>
                        {meta.outcome_delta > 0 ? "+" : ""}{Number(meta.outcome_delta).toFixed(1)}%
                      </span>
                    </span>
                    {meta.accuracy_score != null && (
                      <span className="text-muted-foreground">
                        Accuracy: <span className="font-mono font-semibold">{Math.round(meta.accuracy_score)}%</span>
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Confidence adjustment rationale */}
      {confidenceAdjustment !== 0 && (
        <div className="mt-3 pt-2.5 border-t border-border/20">
          <p className="text-[10px] text-muted-foreground italic leading-relaxed">
            ↳ {confidenceAdjustment > 0
              ? `Historical accuracy of ${outcomes.length} similar outcomes (avg ${avgAccuracy}%) supports higher confidence.`
              : `Historical accuracy of ${outcomes.length} similar outcomes (avg ${avgAccuracy}%) warrants reduced confidence. Past predictions in this domain were less reliable.`
            }
            {retrievalQuality !== "high" && " (Adjustment reduced due to moderate match quality.)"}
          </p>
        </div>
      )}
    </motion.div>
  );
});

SimilarDecisionsPanel.displayName = "SimilarDecisionsPanel";

export default SimilarDecisionsPanel;

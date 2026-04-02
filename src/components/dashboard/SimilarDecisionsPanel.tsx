import { memo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, TrendingUp, TrendingDown, Target, History, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useSimilarDecisions } from "@/hooks/useSimilarDecisions";

interface SimilarDecisionsPanelProps {
  organizationId: string;
  queryText: string;
  onConfidenceAdjustment?: (adjustment: number, rationale: string) => void;
}

const SimilarDecisionsPanel = memo(({ organizationId, queryText, onConfidenceAdjustment }: SimilarDecisionsPanelProps) => {
  const { similar, loading, error, historicalSuccessRate, avgAccuracy, confidenceAdjustment, fetch } = useSimilarDecisions(organizationId);

  useEffect(() => {
    if (queryText && queryText.length > 10) {
      fetch(queryText);
    }
  }, [queryText, fetch]);

  useEffect(() => {
    if (confidenceAdjustment !== 0 && onConfidenceAdjustment) {
      const rationale = confidenceAdjustment > 0
        ? `Historical accuracy of similar decisions is strong (avg ${avgAccuracy}%), confidence boosted by ${confidenceAdjustment}pp.`
        : `Historical accuracy of similar decisions is low (avg ${avgAccuracy}%), confidence reduced by ${Math.abs(confidenceAdjustment)}pp.`;
      onConfidenceAdjustment(confidenceAdjustment, rationale);
    }
  }, [confidenceAdjustment, avgAccuracy, onConfidenceAdjustment]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/20 border border-border/20">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">Searching institutional memory...</span>
      </div>
    );
  }

  if (error || similar.length === 0) return null;

  const decisions = similar.filter(s => s.entity_type === "decision");
  const outcomes = similar.filter(s => s.entity_type === "outcome");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border/30 bg-muted/10 p-3 sm:p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
          <History className="w-3.5 h-3.5 text-primary" />
        </div>
        <h4 className="text-xs font-semibold font-display">Institutional Memory</h4>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {similar.length} similar record{similar.length !== 1 ? "s" : ""} found
        </span>
      </div>

      {/* Historical performance summary */}
      {(historicalSuccessRate != null || avgAccuracy != null) && (
        <div className="flex items-center gap-4 p-2.5 rounded-lg bg-muted/30 mb-3">
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

      {/* Similar decisions list */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        <AnimatePresence>
          {similar.slice(0, 6).map((item, i) => {
            const meta = item.metadata as any;
            const isOutcome = item.entity_type === "outcome";
            const relevance = Math.round(item.similarity * 100);

            return (
              <motion.div
                key={item.entity_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="py-1.5 px-2 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    isOutcome ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                  }`}>
                    {item.entity_type}
                  </span>
                  <p className="text-[11px] flex-1 truncate">{item.content_text.slice(0, 120)}</p>
                  <span className="text-[9px] text-muted-foreground font-mono shrink-0">{relevance}%</span>
                </div>

                {isOutcome && meta?.outcome_delta != null && (
                  <div className="mt-1 ml-14 flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1">
                      {meta.outcome_delta > 0 ? (
                        <TrendingUp className="w-3 h-3 text-success" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-destructive" />
                      )}
                      <span className={`font-mono font-semibold ${meta.outcome_delta > 0 ? "text-success" : "text-destructive"}`}>
                        {meta.outcome_delta > 0 ? "+" : ""}{meta.outcome_delta.toFixed(1)}%
                      </span>
                    </span>
                    {meta.accuracy_score != null && (
                      <span className="text-muted-foreground">
                        Accuracy: <span className="font-mono font-semibold">{meta.accuracy_score}%</span>
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
          </p>
        </div>
      )}
    </motion.div>
  );
});

SimilarDecisionsPanel.displayName = "SimilarDecisionsPanel";

export default SimilarDecisionsPanel;

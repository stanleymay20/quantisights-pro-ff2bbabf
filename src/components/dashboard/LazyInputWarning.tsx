import { useMemo } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Decision {
  confidence_at_decision: number | null;
  capped_confidence: number | null;
}

interface LazyInputWarningProps {
  decisions: Decision[];
}

interface LazyPattern {
  type: "clustering" | "fifty_default" | "low_entropy";
  label: string;
  description: string;
  severity: "warning" | "critical";
}

// Minimum decisions before any warning
const MIN_SAMPLE_FULL = 20;
const MIN_SAMPLE_GENTLE = 12;

export function detectLazyInput(decisions: Decision[]): { patterns: LazyPattern[]; isGentleMode: boolean } {
  const probs = decisions
    .map(d => d.confidence_at_decision ?? d.capped_confidence ?? null)
    .filter((p): p is number => p !== null);

  // No warnings below 12 decisions
  if (probs.length < MIN_SAMPLE_GENTLE) return { patterns: [], isGentleMode: false };

  const isGentleMode = probs.length < MIN_SAMPLE_FULL;
  const patterns: LazyPattern[] = [];

  // 1. Probability Clustering: >60% within ±5pp of median
  const sorted = [...probs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const clustered = probs.filter(p => Math.abs(p - median) <= 5);
  if (clustered.length / probs.length > 0.6) {
    patterns.push({
      type: "clustering",
      label: "Low Discrimination",
      description: `${Math.round(clustered.length / probs.length * 100)}% of probabilities cluster within ±5pp of ${median}%. This suggests insufficient differentiation between decisions of varying certainty.`,
      severity: isGentleMode ? "warning" : "critical",
    });
  }

  // 2. 50% Default Bias
  const fiftyCount = probs.filter(p => Math.abs(p - 50) <= 3).length;
  if (fiftyCount / probs.length > 0.3) {
    patterns.push({
      type: "fifty_default",
      label: "50% Default Bias",
      description: `${Math.round(fiftyCount / probs.length * 100)}% of estimates are near 50%. This may indicate unresolved belief rather than genuine uncertainty. Consider refining these estimates.`,
      severity: "warning",
    });
  }

  // 3. Low Entropy (only at full sample)
  if (!isGentleMode) {
    const mean = probs.reduce((s, v) => s + v, 0) / probs.length;
    const variance = probs.reduce((s, v) => s + (v - mean) ** 2, 0) / probs.length;
    const std = Math.sqrt(variance);
    if (std < 8) {
      patterns.push({
        type: "low_entropy",
        label: "Low Entropy",
        description: `Standard deviation of probability estimates is only ${std.toFixed(1)}pp. Real-world decisions should exhibit more variation in certainty levels.`,
        severity: "warning",
      });
    }
  }

  return { patterns, isGentleMode };
}

const LazyInputWarning = ({ decisions }: LazyInputWarningProps) => {
  const { patterns, isGentleMode } = useMemo(() => detectLazyInput(decisions), [decisions]);

  if (patterns.length === 0) return null;

  const hasCritical = patterns.some(p => p.severity === "critical");

  return (
    <Card className={`${hasCritical ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${hasCritical ? "text-destructive" : "text-warning"}`} />
          <span className="text-sm font-semibold text-foreground">
            {isGentleMode ? "Early Pattern Notice" : "Probability Input Quality Alert"}
          </span>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                {isGentleMode
                  ? "With fewer than 20 decisions logged, these patterns may not be conclusive. Continue logging decisions with differentiated estimates."
                  : "These patterns suggest probability assignments may not reflect genuine beliefs. Calibration accuracy depends on honest, differentiated estimates."}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-wrap gap-2">
          {patterns.map(p => (
            <Tooltip key={p.type}>
              <TooltipTrigger>
                <Badge variant={p.severity === "critical" ? "destructive" : "secondary"} className="text-xs cursor-help">
                  {p.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">{p.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <p className="text-xs text-muted-foreground italic">
          Probability is a forecast, not a commitment. Differentiated estimates improve calibration accuracy.
        </p>
      </CardContent>
    </Card>
  );
};

export default LazyInputWarning;

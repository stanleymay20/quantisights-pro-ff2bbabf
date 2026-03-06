import * as React from "react";
import { ShieldCheck, Database, AlertTriangle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface ConfidenceObject {
  raw_confidence?: number;
  capped_confidence?: number;
  confidence_cap_reason?: string;
  ceiling?: number;
  sample_size?: number;
  data_sufficiency?: string;
  variance_score?: number | null;
}

/**
 * Extracts a numeric confidence value from either a number or a confidence object.
 */
export function resolveConfidence(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as ConfidenceObject;
    return obj.capped_confidence ?? obj.raw_confidence ?? 0;
  }
  return 0;
}

/**
 * Extracts the full confidence metadata from either a number or object.
 */
export function resolveConfidenceMeta(value: unknown): ConfidenceObject | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as ConfidenceObject;
  }
  return null;
}

interface ConfidenceBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  confidence: unknown;
  showDetails?: boolean;
}

const ConfidenceBadge = React.forwardRef<HTMLSpanElement, ConfidenceBadgeProps>(
  ({ confidence, showDetails = false, className = "", ...rest }, ref) => {
    const score = resolveConfidence(confidence);
    const meta = resolveConfidenceMeta(confidence);
    const color = score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive";

    if (!showDetails || !meta) {
      return (
        <span ref={ref} className={`inline-flex items-center gap-1 text-xs font-semibold ${color} ${className}`} {...rest}>
          <ShieldCheck className="w-3 h-3" />
          {Math.round(score)}%
        </span>
      );
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span ref={ref} className={`inline-flex items-center gap-1 text-xs font-semibold ${color} cursor-help ${className}`} {...rest}>
            <ShieldCheck className="w-3 h-3" />
            {Math.round(score)}%
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs space-y-1.5 text-xs p-3">
          {meta.data_sufficiency && (
            <div className="flex items-center gap-1.5">
              <Database className="w-3 h-3 text-muted-foreground" />
              <span>Data: <strong className="capitalize">{meta.data_sufficiency}</strong></span>
              {meta.sample_size != null && <span className="text-muted-foreground">({meta.sample_size} points)</span>}
            </div>
          )}
          {meta.variance_score != null && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-muted-foreground" />
              <span>Variance: {meta.variance_score.toFixed(1)}</span>
            </div>
          )}
          {meta.confidence_cap_reason && (
            <div className="flex items-center gap-1.5">
              <Info className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">{meta.confidence_cap_reason}</span>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    );
  },
);

ConfidenceBadge.displayName = "ConfidenceBadge";

export default ConfidenceBadge;

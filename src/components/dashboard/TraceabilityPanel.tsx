/**
 * Traceability Panel — "Why am I seeing this?"
 *
 * Every intelligence output must be traceable to its source data,
 * transformation path, and model/heuristic used.
 */

import { useState } from "react";
import { Eye, Database, Layers, Cpu, Clock, AlertTriangle, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import type { TraceabilityRecord } from "@/lib/evidence-contract";
import type { ConfidenceBasis } from "@/lib/evidence-contract";

interface Props {
  traceability: TraceabilityRecord;
  confidenceBasis?: ConfidenceBasis | null;
  assumptions?: string[];
  limitations?: string[];
}

const TraceabilityPanel = ({ traceability, confidenceBasis, assumptions, limitations }: Props) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2 border border-border/30 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Eye className="w-3 h-3" />
          Why am I seeing this?
        </span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/20">
          {/* Source */}
          <div className="flex items-start gap-2 pt-2">
            <Database className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-[10px]">
              <span className="font-semibold text-foreground">Source: </span>
              <span className="text-muted-foreground">{traceability.sourceDataset}</span>
              <span className="text-muted-foreground"> · {traceability.dataRowsUsed.toLocaleString()} rows</span>
            </div>
          </div>

          {/* Transformation Path */}
          <div className="flex items-start gap-2">
            <Layers className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-[10px]">
              <span className="font-semibold text-foreground">Transform: </span>
              <span className="text-muted-foreground font-mono">{traceability.metricTransformationPath}</span>
            </div>
          </div>

          {/* Model */}
          <div className="flex items-start gap-2">
            <Cpu className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-[10px]">
              <span className="font-semibold text-foreground">Model: </span>
              <span className="text-muted-foreground">{traceability.modelOrHeuristic}</span>
            </div>
          </div>

          {/* Confidence Basis */}
          {confidenceBasis && (
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-[10px]">
                <span className="font-semibold text-foreground">Confidence: </span>
                <span className="text-muted-foreground">{confidenceBasis.label}</span>
                {confidenceBasis.isHeuristic && (
                  <span className="ml-1 text-[9px] font-bold text-warning uppercase">HEURISTIC</span>
                )}
                {confidenceBasis.calibrationApplied && (
                  <span className="ml-1 text-[9px] font-bold text-success uppercase">CALIBRATED</span>
                )}
              </div>
            </div>
          )}

          {/* Timestamp */}
          <div className="flex items-start gap-2">
            <Clock className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-[10px]">
              <span className="font-semibold text-foreground">Generated: </span>
              <span className="text-muted-foreground">{new Date(traceability.generatedAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Assumptions */}
          {assumptions && assumptions.length > 0 && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3 h-3 text-warning mt-0.5 shrink-0" />
              <div className="text-[10px]">
                <span className="font-semibold text-foreground">Assumptions: </span>
                <span className="text-muted-foreground">{assumptions.join("; ")}</span>
              </div>
            </div>
          )}

          {/* Limitations */}
          {(traceability.limitations.length > 0 || (limitations && limitations.length > 0)) && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3 h-3 text-destructive mt-0.5 shrink-0" />
              <div className="text-[10px]">
                <span className="font-semibold text-foreground">Limitations: </span>
                <span className="text-muted-foreground">
                  {[...traceability.limitations, ...(limitations ?? [])].join("; ")}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TraceabilityPanel;

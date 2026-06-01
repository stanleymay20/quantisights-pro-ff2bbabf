// Post-upload summary surfaced on the "done" step. Aggregates the data the
// ingestion pipeline already produced: industry classification, dataset health,
// PII risk, schema drift versus prior version, and a recommended next action.

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ShieldCheck,
  Database,
  AlertTriangle,
  Sparkles,
  GitBranch,
} from "lucide-react";
import type { DatasetClassification, DatasetDiagnostics } from "@/lib/data-upload-utils";
import type { DriftReport } from "@/lib/schema-evolution";
import { summarizeDrift } from "@/lib/schema-evolution";

interface Props {
  rowsImported: number;
  healthScore: number;
  classification: DatasetClassification | null;
  diagnostics: DatasetDiagnostics | null;
  drift: DriftReport | null;
}

function healthTone(score: number): { color: string; label: string } {
  if (score >= 85) return { color: "text-success", label: "Excellent" };
  if (score >= 70) return { color: "text-success", label: "Good" };
  if (score >= 50) return { color: "text-warning", label: "Fair" };
  return { color: "text-destructive", label: "Needs Attention" };
}

function recommendedAction(
  health: number,
  drift: DriftReport | null,
  pii: DatasetDiagnostics["piiRisk"] | undefined,
): { label: string; tone: "success" | "warning" | "destructive" } {
  if (pii === "high") {
    return { label: "Review PII before publishing", tone: "destructive" };
  }
  if (drift && !drift.backwardCompatible) {
    return { label: "Resolve breaking schema changes", tone: "warning" };
  }
  if (health < 50) {
    return { label: "Clean data before executive use", tone: "warning" };
  }
  return { label: "Ready for Executive Analysis", tone: "success" };
}

export default function PostUploadSummary({
  rowsImported,
  healthScore,
  classification,
  diagnostics,
  drift,
}: Props) {
  const tone = healthTone(healthScore);
  const action = recommendedAction(healthScore, drift, diagnostics?.piiRisk);
  const piiLabel = diagnostics?.piiRisk
    ? diagnostics.piiRisk.charAt(0).toUpperCase() + diagnostics.piiRisk.slice(1)
    : "Unknown";

  return (
    <Card className="overflow-hidden border-primary/20">
      <div className="bg-gradient-to-r from-primary/5 to-primary/0 p-5 border-b border-border/30 flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-semibold font-display">Post-Upload Summary</h3>
          <p className="text-xs text-muted-foreground">
            Snapshot recorded in dataset registry, schema log, lineage, and audit trail.
          </p>
        </div>
      </div>
      <CardContent className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Tile
            icon={<Activity className="w-3.5 h-3.5" />}
            label="Dataset Health"
            value={`${healthScore}%`}
            valueClass={tone.color}
            sub={tone.label}
          />
          <Tile
            icon={<Database className="w-3.5 h-3.5" />}
            label="Industry"
            value={classification?.type ?? "—"}
            sub={
              classification && classification.confidence > 0
                ? `${classification.confidence}% confidence`
                : undefined
            }
          />
          <Tile
            icon={<Database className="w-3.5 h-3.5" />}
            label="Rows"
            value={rowsImported.toLocaleString()}
          />
          <Tile
            icon={<GitBranch className="w-3.5 h-3.5" />}
            label="Schema Drift"
            value={drift ? `${drift.totalChanges}` : "0"}
            sub={drift ? summarizeDrift(drift) : "No prior version"}
          />
          <Tile
            icon={
              diagnostics?.piiRisk === "high" ? (
                <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )
            }
            label="PII Risk"
            value={piiLabel}
            valueClass={
              diagnostics?.piiRisk === "high"
                ? "text-destructive"
                : diagnostics?.piiRisk === "low"
                  ? "text-warning"
                  : "text-success"
            }
          />
        </div>

        <div className="mt-5 p-3 rounded-lg border bg-muted/20 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Recommended Action
            </p>
            <p className="text-sm font-semibold text-foreground">{action.label}</p>
          </div>
          <Badge
            variant="outline"
            className={
              action.tone === "success"
                ? "bg-success/10 text-success border-success/20"
                : action.tone === "warning"
                  ? "bg-warning/10 text-warning border-warning/20"
                  : "bg-destructive/10 text-destructive border-destructive/20"
            }
          >
            {action.tone === "success" ? "Approved" : "Action Needed"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function Tile({
  icon,
  label,
  value,
  valueClass = "text-foreground",
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
}) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <p className={`text-base font-semibold font-mono ${valueClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

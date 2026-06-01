import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChevronDown,
  ChevronRight,
  Globe,
  ShieldCheck,
  Wand2,
  Layers,
  Link2,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  BookOpen,
  Gauge,
  Info,
  ScrollText,
} from "lucide-react";
import type { IngestionIntelligenceResult } from "@/lib/ingestion-intelligence";
import type { CrossSheetDiscoveryResult } from "@/lib/cross-sheet-discovery";

interface Props {
  intelligence: IngestionIntelligenceResult;
  relationships?: CrossSheetDiscoveryResult | null;
}

type Grade = "A" | "B" | "C" | "D";

function computeTrustGrade(intel: IngestionIntelligenceResult): { grade: Grade; label: string; tone: "success" | "warning" | "destructive" } {
  const trust = intel.repairReport.summary.trustSignal;
  const warnings = intel.repairReport.summary.warnings.length;
  const health = intel.repairReport.diagnostics?.healthScore ?? 70;

  if (trust === "strong" && warnings <= 1 && health >= 85) return { grade: "A", label: "Low Risk Import", tone: "success" };
  if (trust === "strong" || (trust === "moderate" && warnings <= 2)) return { grade: "B", label: "Acceptable — Quick Review", tone: "success" };
  if (trust === "moderate") return { grade: "C", label: "Manual Review Recommended", tone: "warning" };
  return { grade: "D", label: "High Risk — Fix Issues First", tone: "destructive" };
}

function Section({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50 text-left transition-colors"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        <span className="text-sm font-medium flex-1 flex items-center gap-2">
          {icon}
          {title}
        </span>
        {badge}
      </button>
      {open && <div className="px-4 py-3 text-xs space-y-2">{children}</div>}
    </div>
  );
}

export default function MappingIntelligencePanel({ intelligence, relationships }: Props) {
  const { grade, label, tone } = computeTrustGrade(intelligence);
  const r = intelligence.repairReport;
  const dict = intelligence.dictionary;
  const sim = intelligence.columnSimilarity;
  const locale = intelligence.locale;

  const bannerCls =
    tone === "success"
      ? "border-success/30 bg-success/5 text-success"
      : tone === "warning"
      ? "border-warning/30 bg-warning/5 text-warning"
      : "border-destructive/30 bg-destructive/5 text-destructive";

  const repairLines: { ok: boolean; text: string }[] = [
    r.headerRecovery.recoveredCount > 0 && {
      ok: true,
      text: `${r.headerRecovery.recoveredCount} duplicate/missing header${r.headerRecovery.recoveredCount === 1 ? "" : "s"} recovered`,
    },
    r.mixedTypes.repairedColumnCount > 0 && {
      ok: true,
      text: `${r.mixedTypes.repairedColumnCount} mixed-type column${r.mixedTypes.repairedColumnCount === 1 ? "" : "s"} normalized`,
    },
    sim.groups.length > 0 && {
      ok: true,
      text: `${sim.groups.length} similar-column group${sim.groups.length === 1 ? "" : "s"} grouped`,
    },
    locale.locale !== "unknown" && {
      ok: true,
      text: `Locale detected: ${locale.locale} (${Math.round(locale.confidence * 100)}%)`,
    },
    r.headerRecovery.reviewCount > 0 && {
      ok: false,
      text: `${r.headerRecovery.reviewCount} recovered header${r.headerRecovery.reviewCount === 1 ? "" : "s"} need review`,
    },
    r.mixedTypes.reviewColumnCount > 0 && {
      ok: false,
      text: `${r.mixedTypes.reviewColumnCount} mixed-type column${r.mixedTypes.reviewColumnCount === 1 ? "" : "s"} need manual review`,
    },
  ].filter(Boolean) as { ok: boolean; text: string }[];

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        {/* Trust Score Banner with explanation */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`rounded-lg border p-4 flex items-center gap-4 cursor-help ${bannerCls}`}>
              <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-2xl font-bold ${bannerCls}`}>
                {grade}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  Dataset Trust Score: {grade}
                  <Info className="w-3.5 h-3.5 opacity-70" aria-label="How is this calculated?" />
                </p>
                <p className="text-xs opacity-90">{label}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {r.summary.recommendedAction} · {r.summary.repairsApplied} auto-repair{r.summary.repairsApplied === 1 ? "" : "s"} applied
                </p>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-sm text-xs space-y-1 p-3">
            <p className="font-semibold">Calculated from:</p>
            <ul className="space-y-0.5 text-muted-foreground">
              <li>• Schema confidence</li>
              <li>• Missing value ratio</li>
              <li>• Repair volume &amp; warnings</li>
              <li>• Data consistency (mixed-type repairs)</li>
              <li>• PII exposure</li>
              <li>• Health score from diagnostics</li>
            </ul>
          </TooltipContent>
        </Tooltip>




        {/* Summary chips */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="rounded-md border border-border bg-muted/20 p-2">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Locale</div>
            <div className="font-semibold">{locale.locale} <span className="text-muted-foreground font-normal">({Math.round(locale.confidence * 100)}%)</span></div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-2">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Trust Signal</div>
            <div className="font-semibold capitalize">{r.summary.trustSignal}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-2">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Recovered Headers</div>
            <div className="font-semibold">{r.headerRecovery.recoveredCount}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-2">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Mixed-Type Repairs</div>
            <div className="font-semibold">{r.mixedTypes.repairedColumnCount}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-2">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Similarity Groups</div>
            <div className="font-semibold">{sim.groups.length}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-2">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">PII Fields</div>
            <div className="font-semibold">{dict.summary.piiCount}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-2">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Dictionary Fields</div>
            <div className="font-semibold">{dict.fieldCount}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-2">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Avg Field Confidence</div>
            <div className="font-semibold">{Math.round(dict.summary.averageConfidence * 100)}%</div>
          </div>
        </div>

        {/* Auto-repair report */}
        <Section
          title="Auto Repairs Applied"
          icon={<Wand2 className="w-3.5 h-3.5 text-primary" />}
          badge={<Badge variant="outline" className="text-[10px]">{r.summary.repairsApplied}</Badge>}
          defaultOpen
        >
          {repairLines.length === 0 ? (
            <p className="text-muted-foreground">No automatic repairs were needed — dataset arrived clean.</p>
          ) : (
            <ul className="space-y-1">
              {repairLines.map((line, i) => (
                <li key={i} className="flex items-start gap-2">
                  {line.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
                  )}
                  <span>{line.text}</span>
                </li>
              ))}
            </ul>
          )}
          {r.summary.warnings.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/50">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Warnings</p>
              <ul className="space-y-0.5">
                {r.summary.warnings.map((w, i) => (
                  <li key={i} className="text-warning flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* Column similarity */}
        {sim.groups.length > 0 && (
          <Section
            title="Column Similarity Groups"
            icon={<Layers className="w-3.5 h-3.5 text-primary" />}
            badge={<Badge variant="outline" className="text-[10px]">{sim.groups.length}</Badge>}
          >
            <ul className="space-y-2">
              {sim.groups.map((g, i) => (
                <li key={i} className="rounded-md border border-border/60 bg-muted/20 p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] text-primary">{g.canonicalName}</span>
                    <Badge variant="outline" className="text-[10px]">{Math.round(g.confidence * 100)}%</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {g.columns.map((c) => (
                      <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border">{c}</span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Cross-sheet relationships */}
        {relationships && relationships.relationships.length > 0 && (
          <Section
            title="Cross-Sheet Relationships"
            icon={<Link2 className="w-3.5 h-3.5 text-primary" />}
            badge={<Badge variant="outline" className="text-[10px]">{relationships.relationships.length}</Badge>}
          >
            <ul className="space-y-1.5">
              {relationships.relationships.map((rel, i) => (
                <li key={i} className="flex items-center gap-2 font-mono text-[11px]">
                  <span>{rel.fromSheet}.{rel.fromColumn}</span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  <span>{rel.toSheet}.{rel.toColumn}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">{Math.round(rel.confidence * 100)}%</Badge>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* PII fields */}
        {intelligence.semanticSchema.piiColumns.length > 0 && (
          <Section
            title="PII Fields Detected"
            icon={<ShieldCheck className="w-3.5 h-3.5 text-warning" />}
            badge={<Badge variant="outline" className="text-[10px]">{intelligence.semanticSchema.piiColumns.length}</Badge>}
          >
            <div className="flex flex-wrap gap-1">
              {intelligence.semanticSchema.piiColumns.map((c) => (
                <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/30">{c}</span>
              ))}
            </div>
            <p className="text-muted-foreground mt-1">These fields will be governed per the data protection policy.</p>
          </Section>
        )}

        {/* Dictionary Summary */}
        <Section
          title="Data Dictionary Summary"
          icon={<BookOpen className="w-3.5 h-3.5 text-primary" />}
          badge={<Badge variant="outline" className="text-[10px]">{dict.fieldCount} fields</Badge>}
        >
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { label: "Metrics", value: dict.summary.metricCount, tone: "text-success" },
              { label: "Dimensions", value: dict.summary.dimensionCount, tone: "text-primary" },
              { label: "Identifiers", value: dict.summary.identifierCount, tone: "text-primary" },
              { label: "PII", value: dict.summary.piiCount, tone: dict.summary.piiCount > 0 ? "text-warning" : "text-muted-foreground" },
              { label: "Review", value: dict.summary.reviewRequiredCount, tone: dict.summary.reviewRequiredCount > 0 ? "text-warning" : "text-muted-foreground" },
            ].map((s) => (
              <div key={s.label} className="rounded-md border border-border bg-muted/20 p-2 text-center">
                <div className={`text-lg font-bold ${s.tone}`}>{s.value}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground mt-2">Avg field confidence: <strong>{Math.round(dict.summary.averageConfidence * 100)}%</strong></p>
        </Section>

        {/* Locale detail */}
        <Section
          title="Locale Detection"
          icon={<Globe className="w-3.5 h-3.5 text-primary" />}
          badge={<Badge variant="outline" className="text-[10px]">{locale.locale}</Badge>}
        >
          <p>Confidence: <strong>{Math.round(locale.confidence * 100)}%</strong></p>
          <p>Decimal separator: <code className="bg-muted/50 px-1 rounded">{locale.decimalSeparator ?? "—"}</code> · Thousands: <code className="bg-muted/50 px-1 rounded">{locale.thousandsSeparator ?? "—"}</code></p>
          <p className="text-muted-foreground">{locale.reason}</p>
          {locale.ambiguous && <p className="text-warning">Locale detection was ambiguous — verify currency/date parsing.</p>}
        </Section>
      </CardContent>
    </Card>
  );
}

function RiskAssessmentCard({
  intelligence,
  grade,
}: {
  intelligence: IngestionIntelligenceResult;
  grade: Grade;
}) {
  const r = intelligence.repairReport;
  const dict = intelligence.dictionary;
  const reviewCount = dict.summary.reviewRequiredCount;
  const piiCount = dict.summary.piiCount;
  const trust = r.summary.trustSignal;

  const { level, headline, detail, tone } = useMemo(() => {
    if (grade === "A" && reviewCount === 0) {
      return {
        level: "Low Risk",
        headline: "Dataset ready for executive analysis.",
        detail: "No critical schema issues detected. All key fields meet the trust threshold.",
        tone: "success" as const,
      };
    }
    if (grade === "D" || trust === "weak") {
      return {
        level: "High Risk",
        headline: "Manual review recommended before import.",
        detail: `${reviewCount} field${reviewCount === 1 ? "" : "s"} flagged for review${piiCount > 0 ? `, ${piiCount} PII field${piiCount === 1 ? "" : "s"} present` : ""}.`,
        tone: "destructive" as const,
      };
    }
    return {
      level: "Medium Risk",
      headline: reviewCount > 0
        ? `Review ${reviewCount} field${reviewCount === 1 ? "" : "s"} before import.`
        : "Review the auto-repair report before import.",
      detail: `${piiCount > 0 ? `${piiCount} PII field${piiCount === 1 ? "" : "s"} detected. ` : ""}Trust signal: ${trust}.`,
      tone: "warning" as const,
    };
  }, [grade, reviewCount, piiCount, trust]);

  const cls =
    tone === "success"
      ? "border-success/30 bg-success/5"
      : tone === "warning"
      ? "border-warning/30 bg-warning/5"
      : "border-destructive/30 bg-destructive/5";
  const iconCls =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-destructive";

  return (
    <div className={`rounded-lg border p-3 flex items-start gap-3 ${cls}`}>
      <Gauge className={`w-5 h-5 mt-0.5 shrink-0 ${iconCls}`} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-semibold ${iconCls}`}>Import Risk Assessment: {level}</p>
        </div>
        <p className="text-xs mt-0.5">{headline}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{detail}</p>
      </div>
    </div>
  );
}


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
  Rocket,
  Eye,
  HandMetal,
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

        {/* Executive Recommendation (hero) */}
        <ExecutiveRecommendationCard intelligence={intelligence} grade={grade} relationships={relationships} />

        {/* Risk Assessment */}
        <RiskAssessmentCard intelligence={intelligence} grade={grade} />

        {/* Governance Status */}
        <GovernanceStatusCard intelligence={intelligence} grade={grade} relationships={relationships} />


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

        {/* Column similarity (always render, with empty state) */}
        <Section
          title="Column Similarity Groups"
          icon={<Layers className="w-3.5 h-3.5 text-primary" />}
          badge={<Badge variant="outline" className="text-[10px]">{sim.groups.length}</Badge>}
        >
          {sim.groups.length === 0 ? (
            <p className="text-muted-foreground">No duplicate or semantically similar columns detected.</p>
          ) : (
            <ul className="space-y-2">
              {sim.groups.map((g, i) => (
                <li key={i} className="rounded-md border border-border/60 bg-muted/20 p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] text-primary">Group #{i + 1} · {g.canonicalName}</span>
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
          )}
        </Section>


        {/* Cross-sheet relationships — always rendered with empty state */}
        <Section
          title="Cross-Sheet Relationships"
          icon={<Link2 className="w-3.5 h-3.5 text-primary" />}
          badge={<Badge variant="outline" className="text-[10px]">{relationships?.relationships.length ?? 0}</Badge>}
        >
          {!relationships || relationships.relationships.length === 0 ? (
            <p className="text-muted-foreground">
              No cross-sheet relationships detected. Upload a multi-sheet workbook to surface foreign-key style joins (e.g.{" "}
              <span className="font-mono">orders.customer_id → customers.id</span>).
            </p>
          ) : (
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
          )}
        </Section>

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

        {/* Interactive Dictionary Drill-Down */}
        <Section
          title="Data Dictionary"
          icon={<BookOpen className="w-3.5 h-3.5 text-primary" />}
          badge={<Badge variant="outline" className="text-[10px]">{dict.fieldCount} fields</Badge>}
        >
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
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
          <DictionaryDrillDown dict={intelligence.dictionary} />
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

function GovernanceStatusCard({
  intelligence,
  grade,
  relationships,
}: {
  intelligence: IngestionIntelligenceResult;
  grade: Grade;
  relationships?: CrossSheetDiscoveryResult | null;
}) {
  const dict = intelligence.dictionary;
  const piiCount = dict.summary.piiCount;
  const reviewCount = dict.summary.reviewRequiredCount;
  const driftCount = 0;
  const lineageAvailable = true;
  const relationshipCount = relationships?.relationships.length ?? 0;

  const items: { label: string; value: React.ReactNode; tone: string }[] = [
    { label: "PII Fields", value: piiCount, tone: piiCount > 0 ? "text-warning" : "text-success" },
    { label: "Review Required", value: reviewCount, tone: reviewCount > 0 ? "text-warning" : "text-success" },
    { label: "Schema Drift", value: driftCount, tone: driftCount > 0 ? "text-warning" : "text-success" },
    { label: "Lineage", value: lineageAvailable ? "Yes" : "No", tone: lineageAvailable ? "text-success" : "text-destructive" },
    { label: "Relationships", value: relationshipCount, tone: "text-primary" },
    { label: "Trust Grade", value: grade, tone: grade === "A" || grade === "B" ? "text-success" : grade === "C" ? "text-warning" : "text-destructive" },
  ];

  return (
    <div className="rounded-lg border border-border bg-muted/10 p-3">
      <div className="flex items-center gap-2 mb-2">
        <ScrollText className="w-4 h-4 text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold">Governance Status</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
        {items.map((it) => (
          <div key={it.label} className="rounded-md border border-border bg-background p-2 text-center">
            <div className={`text-base font-bold ${it.tone}`}>{it.value}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


function DictionaryDrillDown({ dict }: { dict: IngestionIntelligenceResult["dictionary"] }) {
  const groups = useMemo(() => {
    const byCategory: Record<string, { name: string; description: string }[]> = {
      Metrics: [],
      Dimensions: [],
      Identifiers: [],
      PII: [],
    };
    dict.fields.forEach((f) => {
      if (f.semanticType === "pii" || f.governanceFlags.includes("pii")) {
        byCategory.PII.push({ name: f.name, description: f.description });
      }
      if (f.semanticType === "identifier" || f.businessRole === "entity_key") {
        byCategory.Identifiers.push({ name: f.name, description: f.description });
      }
      if (f.inferredType === "value") {
        byCategory.Metrics.push({ name: f.name, description: f.description });
      } else if (["segment", "region", "region_code", "date"].includes(f.inferredType)) {
        byCategory.Dimensions.push({ name: f.name, description: f.description });
      }
    });
    return byCategory;
  }, [dict]);

  return (
    <div className="space-y-1.5">
      {(Object.keys(groups) as Array<keyof typeof groups>).map((cat) => {
        const items = groups[cat];
        if (items.length === 0) return null;
        return <DictionaryGroup key={cat} title={cat} items={items} />;
      })}
    </div>
  );
}

function DictionaryGroup({
  title,
  items,
}: {
  title: string;
  items: { name: string; description: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-border/60 bg-background/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-muted/30 transition-colors text-left"
      >
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        <span className="text-xs font-medium flex-1">{title}</span>
        <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
      </button>
      {open && (
        <ul className="px-3 py-2 space-y-1 border-t border-border/40">
          {items.map((it) => (
            <li key={it.name} className="flex items-start gap-2 text-[11px]">
              <span className="font-mono text-primary shrink-0">{it.name}</span>
              <span className="text-muted-foreground line-clamp-1">— {it.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExecutiveRecommendationCard({
  intelligence,
  grade,
  relationships,
}: {
  intelligence: IngestionIntelligenceResult;
  grade: Grade;
  relationships?: CrossSheetDiscoveryResult | null;
}) {
  const r = intelligence.repairReport;
  const dict = intelligence.dictionary;
  const piiCount = dict.summary.piiCount;
  const reviewCount = dict.summary.reviewRequiredCount;
  const trust = r.summary.trustSignal;
  const warnings = r.summary.warnings.length;
  const driftCount = 0;

  // Import Readiness Score (0-100) — with breakdown
  const breakdown = useMemo(() => {
    // Schema Quality (max 30)
    const trustWeight = grade === "A" ? 30 : grade === "B" ? 25 : grade === "C" ? 18 : 10;
    // Mapping Confidence (max 25)
    const mappingWeight = Math.round(dict.summary.averageConfidence * 25);
    // Validation Success (max 20)
    const validationWeight = Math.max(0, 20 - Math.min(20, warnings * 5));
    // Governance (max 15)
    const governanceWeight = Math.max(0, 15 - Math.min(15, reviewCount * 3));
    // PII / Drift Penalties (max -20 total)
    const piiPenalty = Math.min(10, piiCount * 2);
    const driftPenalty = Math.min(10, driftCount * 5);
    const penalty = piiPenalty + driftPenalty;

    const raw = trustWeight + mappingWeight + validationWeight + governanceWeight + 10 - penalty;
    const total = Math.max(0, Math.min(100, raw));

    return {
      total,
      components: [
        { label: "Schema Quality", value: trustWeight, max: 30, tone: "success" as const },
        { label: "Mapping Confidence", value: mappingWeight, max: 25, tone: "success" as const },
        { label: "Validation Success", value: validationWeight, max: 20, tone: "success" as const },
        { label: "Governance", value: governanceWeight, max: 15, tone: "success" as const },
        { label: "Baseline", value: 10, max: 10, tone: "success" as const },
        { label: "Penalties", value: -penalty, max: 20, tone: "destructive" as const },
      ],
    };
  }, [grade, dict.summary.averageConfidence, warnings, reviewCount, piiCount, driftCount]);

  const readiness = breakdown.total;

  // Critical (blocking) issues
  const criticalIssues = useMemo(() => {
    const issues: string[] = [];
    if (grade === "D") issues.push("Trust grade D — multiple integrity concerns");
    if (trust === "weak") issues.push("Weak trust signal from ingestion engine");
    if (driftCount > 0) issues.push(`${driftCount} schema drift event(s) detected`);
    if (piiCount >= 5) issues.push(`${piiCount} PII fields require governance approval`);
    if (reviewCount >= 3) issues.push(`${reviewCount} fields flagged for manual review`);
    if (dict.fieldCount > 0 && dict.summary.identifierCount === 0) {
      issues.push("No primary identifier detected — joins and lineage will be limited");
    }
    if (intelligence.locale.ambiguous) issues.push("Ambiguous locale — verify currency/date parsing");
    return issues;
  }, [grade, trust, driftCount, piiCount, reviewCount, dict.fieldCount, dict.summary.identifierCount, intelligence.locale.ambiguous]);

  const verdict = useMemo(() => {
    if (criticalIssues.length > 0 || grade === "D" || trust === "weak") {
      return {
        action: "Manual Review Required" as const,
        statusLabel: "BLOCKED",
        icon: <HandMetal className="w-7 h-7" />,
        tone: "destructive" as const,
        headline: "Resolve blocking issues before import.",
      };
    }
    if (grade === "C" || trust === "moderate" || reviewCount > 0 || warnings > 1 || piiCount > 0) {
      return {
        action: "Review Recommended" as const,
        statusLabel: "REVIEW",
        icon: <Eye className="w-7 h-7" />,
        tone: "warning" as const,
        headline: "Review intelligence panel before import.",
      };
    }
    return {
      action: "Ready for Import" as const,
      statusLabel: "READY",
      icon: <Rocket className="w-7 h-7" />,
      tone: "success" as const,
      headline: "No blocking issues detected.",
    };
  }, [criticalIssues.length, grade, trust, reviewCount, piiCount, warnings]);

  const toneCls =
    verdict.tone === "success"
      ? "border-success/50 bg-gradient-to-br from-success/10 to-success/5"
      : verdict.tone === "warning"
      ? "border-warning/50 bg-gradient-to-br from-warning/10 to-warning/5"
      : "border-destructive/50 bg-gradient-to-br from-destructive/10 to-destructive/5";
  const accentCls =
    verdict.tone === "success" ? "text-success" : verdict.tone === "warning" ? "text-warning" : "text-destructive";
  const pillCls =
    verdict.tone === "success"
      ? "bg-success text-success-foreground"
      : verdict.tone === "warning"
      ? "bg-warning text-warning-foreground"
      : "bg-destructive text-destructive-foreground";
  const readinessTone = readiness >= 85 ? "text-success" : readiness >= 65 ? "text-warning" : "text-destructive";
  const readinessBar = readiness >= 85 ? "bg-success" : readiness >= 65 ? "bg-warning" : "bg-destructive";

  const heroMetrics = [
    { label: "Trust Score", value: grade },
    { label: "Risk", value: verdict.tone === "success" ? "Low" : verdict.tone === "warning" ? "Medium" : "High" },
    { label: "Schema Drift", value: driftCount === 0 ? "None" : driftCount },
    { label: "PII Fields", value: piiCount },
  ];

  return (
    <div className={`rounded-xl border-2 p-5 space-y-4 shadow-sm ${toneCls}`}>
      {/* Hero header */}
      <div className="flex items-start gap-4">
        <div className={`w-14 h-14 rounded-2xl bg-background border-2 ${accentCls} flex items-center justify-center shrink-0`}>
          {verdict.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold">
              Recommended Action
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider ${pillCls}`}>
              {verdict.statusLabel}
            </span>
          </div>
          <p className={`text-xl font-bold mt-0.5 leading-tight ${accentCls}`}>{verdict.action}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{verdict.headline}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Import Readiness
          </div>
          <div className={`text-3xl font-bold leading-none ${readinessTone}`}>
            {readiness}
            <span className="text-sm text-muted-foreground font-normal">/100</span>
          </div>
          <div className="mt-1.5 w-24 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={`h-full ${readinessBar} transition-all`} style={{ width: `${readiness}%` }} />
          </div>
        </div>
      </div>

      {/* Hero metric strip */}
      <div className="grid grid-cols-4 gap-2 pt-3 border-t border-border/40">
        {heroMetrics.map((m) => (
          <div key={m.label} className="text-center">
            <div className={`text-xl font-bold ${accentCls}`}>{m.value}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Readiness breakdown */}
      <Section
        title="Import Readiness Components"
        icon={<Gauge className="w-3.5 h-3.5 text-primary" />}
        badge={<Badge variant="outline" className="text-[10px]">{readiness}/100</Badge>}
      >
        <ul className="space-y-1.5">
          {breakdown.components.map((c) => {
            const pct = c.max > 0 ? Math.abs(c.value) / c.max : 0;
            const isPenalty = c.tone === "destructive";
            return (
              <li key={c.label} className="flex items-center gap-2">
                <span className={`w-12 text-right font-mono text-[11px] font-semibold ${isPenalty ? "text-destructive" : "text-success"}`}>
                  {c.value > 0 ? `+${c.value}` : c.value}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${isPenalty ? "bg-destructive" : "bg-success"} transition-all`}
                    style={{ width: `${Math.min(100, pct * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground w-36 truncate">{c.label}</span>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/40">
          <span className="text-xs font-semibold">Total</span>
          <span className={`text-sm font-bold ${readinessTone}`}>{readiness}/100</span>
        </div>
      </Section>

      {/* Critical Issues */}
      <div
        className={`rounded-lg border p-3 ${
          criticalIssues.length === 0
            ? "border-success/30 bg-success/5"
            : "border-destructive/40 bg-destructive/5"
        }`}
      >
        <div className="flex items-center gap-2 mb-1.5">
          {criticalIssues.length === 0 ? (
            <CheckCircle2 className="w-4 h-4 text-success" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-destructive" />
          )}
          <p className="text-sm font-semibold">
            Critical Issues{" "}
            <span className="text-muted-foreground font-normal">
              ({criticalIssues.length === 0 ? "0 blocking" : `${criticalIssues.length} blocking`})
            </span>
          </p>
        </div>
        {criticalIssues.length === 0 ? (
          <p className="text-xs text-muted-foreground">No blocking issues detected. Dataset is safe to import.</p>
        ) : (
          <ul className="space-y-1">
            {criticalIssues.map((issue, i) => (
              <li key={i} className="text-xs flex items-start gap-1.5 text-destructive">
                <span className="mt-1 w-1 h-1 rounded-full bg-destructive shrink-0" />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}






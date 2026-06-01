import { useMemo, useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  Gauge,
  Globe,
  HandMetal,
  Info,
  Layers,
  Link2,
  Rocket,
  ScrollText,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import type { IngestionIntelligenceResult } from "@/lib/ingestion-intelligence";
import type { CrossSheetDiscoveryResult } from "@/lib/cross-sheet-discovery";
import { buildImportRemediationPlan, type RemediationIssue } from "@/lib/ingestion-remediation";

interface Props {
  intelligence: IngestionIntelligenceResult;
  relationships?: CrossSheetDiscoveryResult | null;
}

type PanelTone = "success" | "warning" | "destructive";

function toneClasses(tone: PanelTone) {
  if (tone === "success") {
    return {
      shell: "border-success/50 bg-gradient-to-br from-success/10 to-success/5",
      text: "text-success",
      badge: "bg-success text-success-foreground",
      soft: "border-success/30 bg-success/5",
      bar: "bg-success",
    };
  }
  if (tone === "warning") {
    return {
      shell: "border-warning/50 bg-gradient-to-br from-warning/10 to-warning/5",
      text: "text-warning",
      badge: "bg-warning text-warning-foreground",
      soft: "border-warning/30 bg-warning/5",
      bar: "bg-warning",
    };
  }
  return {
    shell: "border-destructive/50 bg-gradient-to-br from-destructive/10 to-destructive/5",
    text: "text-destructive",
    badge: "bg-destructive text-destructive-foreground",
    soft: "border-destructive/30 bg-destructive/5",
    bar: "bg-destructive",
  };
}

function Section({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50 text-left transition-colors"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        <span className="text-sm font-medium flex-1 flex items-center gap-2">
          {icon}
          {title}
        </span>
        {badge}
      </button>
      {open && <div className="px-4 py-3 text-xs space-y-3">{children}</div>}
    </div>
  );
}

export default function MappingIntelligencePanel({ intelligence, relationships }: Props) {
  const dict = intelligence.dictionary;
  const repair = intelligence.repairReport;
  const remediation = useMemo(
    () => buildImportRemediationPlan({
      schema: dict.fields.map((field) => ({
        column: field.name,
        colIdx: field.index,
        inferredType: field.inferredType,
        confidence: Math.round(field.confidence * 100),
        reason: field.description,
        sampleValues: field.sampleValues,
        rulesApplied: field.governanceFlags,
      })),
      diagnostics: repair.diagnostics,
      intelligence,
    }),
    [dict.fields, intelligence, repair.diagnostics],
  );

  const tone: PanelTone = remediation.recommendation === "proceed"
    ? "success"
    : remediation.recommendation === "review"
      ? "warning"
      : "destructive";
  const toneClass = toneClasses(tone);
  const readinessTone = remediation.readiness.total >= 85
    ? "success"
    : remediation.readiness.total >= 65
      ? "warning"
      : "destructive";
  const readinessClass = toneClasses(readinessTone);
  const blockingIssues = remediation.issues.filter((issue) => issue.severity === "critical");
  const warningIssues = remediation.issues.filter((issue) => issue.severity === "warning");

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`rounded-xl border-2 p-5 space-y-4 cursor-help ${toneClass.shell}`}>
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl bg-background border-2 flex items-center justify-center shrink-0 ${toneClass.text}`}>
                  {tone === "success" ? <Rocket className="w-7 h-7" /> : tone === "warning" ? <Eye className="w-7 h-7" /> : <HandMetal className="w-7 h-7" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold">
                      Recommended Action
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider ${toneClass.badge}`}>
                      {remediation.recommendation === "proceed" ? "READY" : remediation.recommendation === "review" ? "REVIEW" : "BLOCKED"}
                    </span>
                  </div>
                  <p className={`text-xl font-bold mt-0.5 leading-tight ${toneClass.text}`}>{remediation.recommendationLabel}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{remediation.recommendationReason}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Trust signal: <span className="font-semibold capitalize">{repair.summary.trustSignal}</span> · {repair.summary.repairsApplied} repair{repair.summary.repairsApplied === 1 ? "" : "s"} · {repair.summary.warnings.length} warning{repair.summary.warnings.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Import Readiness</div>
                  <div className={`text-3xl font-bold leading-none ${readinessClass.text}`}>
                    {remediation.readiness.total}
                    <span className="text-sm text-muted-foreground font-normal">/100</span>
                  </div>
                  <div className="mt-1.5 w-28 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${readinessClass.bar} transition-all`} style={{ width: `${remediation.readiness.total}%` }} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-border/40">
                <HeroMetric label="Risk" value={tone === "success" ? "Low" : tone === "warning" ? "Medium" : "High"} tone={toneClass.text} />
                <HeroMetric label="PII Fields" value={dict.summary.piiCount} tone={dict.summary.piiCount > 0 ? "text-warning" : "text-success"} />
                <HeroMetric label="Review Queue" value={remediation.reviewQueue.length} tone={remediation.reviewQueue.length > 0 ? "text-warning" : "text-success"} />
                <HeroMetric label="Relationships" value={relationships?.relationships.length ?? 0} tone="text-primary" />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-sm text-xs space-y-1 p-3">
            <p className="font-semibold">Recommendation is calculated from:</p>
            <ul className="space-y-0.5 text-muted-foreground">
              <li>• Schema quality and mapping confidence</li>
              <li>• Validation health and missing values</li>
              <li>• Governance exposure and PII fields</li>
              <li>• Repair warnings and manual-review fields</li>
              <li>• Dataset completeness and relationship readiness</li>
            </ul>
          </TooltipContent>
        </Tooltip>

        <Section
          title="Import Readiness Breakdown"
          icon={<Gauge className="w-3.5 h-3.5 text-primary" />}
          badge={<Badge variant="outline" className="text-[10px]">{remediation.readiness.total}/100</Badge>}
          defaultOpen
        >
          <div className="space-y-2">
            {remediation.readiness.components.map((component) => {
              const width = component.max > 0 ? Math.round((component.score / component.max) * 100) : 0;
              return (
                <div key={component.label} className="grid grid-cols-[130px_1fr_60px] items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{component.label}</span>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-success transition-all" style={{ width: `${Math.max(4, Math.min(100, width))}%` }} />
                  </div>
                  <span className="text-[11px] font-mono text-right">{component.score}/{component.max}</span>
                  <span className="col-span-3 text-[10px] text-muted-foreground pl-[132px]">{component.reason}</span>
                </div>
              );
            })}
            {remediation.readiness.penalties.length > 0 && (
              <div className="pt-2 border-t border-border/40 space-y-1">
                {remediation.readiness.penalties.map((penalty) => (
                  <p key={penalty.label} className="text-[11px] text-destructive">
                    −{penalty.value} {penalty.label}: <span className="text-muted-foreground">{penalty.reason}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section
          title="Critical Issues & Suggested Fixes"
          icon={<AlertTriangle className={`w-3.5 h-3.5 ${blockingIssues.length ? "text-destructive" : "text-success"}`} />}
          badge={<Badge variant="outline" className="text-[10px]">{blockingIssues.length} critical · {warningIssues.length} warnings</Badge>}
          defaultOpen
        >
          <div className="space-y-2">
            {remediation.issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
          </div>
        </Section>

        <Section
          title="Review Queue"
          icon={<Eye className="w-3.5 h-3.5 text-primary" />}
          badge={<Badge variant="outline" className="text-[10px]">{remediation.reviewQueue.length}</Badge>}
          defaultOpen={remediation.reviewQueue.length > 0}
        >
          {remediation.reviewQueue.length === 0 ? (
            <p className="text-muted-foreground">No fields require manual review.</p>
          ) : (
            <div className="space-y-1.5">
              {remediation.reviewQueue.map((item) => (
                <div key={item.column} className="rounded-md border border-border/60 bg-muted/20 p-2 grid grid-cols-[1fr_auto] gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-primary truncate">{item.column}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{item.reason}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.badges.length === 0 ? <span className="text-[10px] text-muted-foreground">No semantic badges</span> : item.badges.map((badge) => (
                        <Badge key={badge} variant="outline" className="text-[10px]">{badge}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{item.confidence}%</p>
                    <p className="text-[10px] text-muted-foreground">→ {item.suggestedTarget ?? "review"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Auto Repairs Applied"
          icon={<Wand2 className="w-3.5 h-3.5 text-primary" />}
          badge={<Badge variant="outline" className="text-[10px]">{repair.summary.repairsApplied}</Badge>}
          defaultOpen
        >
          <ul className="space-y-1">
            <RepairLine label="Duplicate headers fixed" value={repair.headerRecovery.recoveredCount} />
            <RepairLine label="Mixed-type columns repaired" value={repair.mixedTypes.repairedColumnCount} />
            <RepairLine label="Mixed-type columns needing review" value={repair.mixedTypes.reviewColumnCount} warning />
            <RepairLine label="Locale detected" value={`${intelligence.locale.locale} (${Math.round(intelligence.locale.confidence * 100)}%)`} />
            <RepairLine label="Column similarity groups" value={intelligence.columnSimilarity.groups.length} />
          </ul>
          {repair.summary.warnings.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
              {repair.summary.warnings.map((warning) => (
                <p key={warning} className="text-[11px] text-warning flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  {warning}
                </p>
              ))}
            </div>
          )}
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <RelationshipSection relationships={relationships} />
          <SimilaritySection intelligence={intelligence} />
        </div>

        <Section
          title="Data Dictionary"
          icon={<BookOpen className="w-3.5 h-3.5 text-primary" />}
          badge={<Badge variant="outline" className="text-[10px]">{dict.fieldCount} fields</Badge>}
        >
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
            <MiniStat label="Metrics" value={dict.summary.metricCount} tone="text-success" />
            <MiniStat label="Dimensions" value={dict.summary.dimensionCount} tone="text-primary" />
            <MiniStat label="Identifiers" value={dict.summary.identifierCount} tone="text-primary" />
            <MiniStat label="PII" value={dict.summary.piiCount} tone={dict.summary.piiCount > 0 ? "text-warning" : "text-muted-foreground"} />
            <MiniStat label="Review" value={dict.summary.reviewRequiredCount} tone={dict.summary.reviewRequiredCount > 0 ? "text-warning" : "text-muted-foreground"} />
          </div>
          <DictionaryDrillDown intelligence={intelligence} />
        </Section>

        <Section
          title="Locale Detection"
          icon={<Globe className="w-3.5 h-3.5 text-primary" />}
          badge={<Badge variant="outline" className="text-[10px]">{intelligence.locale.locale}</Badge>}
        >
          <p>Confidence: <strong>{Math.round(intelligence.locale.confidence * 100)}%</strong></p>
          <p>Decimal separator: <code className="bg-muted/50 px-1 rounded">{intelligence.locale.decimalSeparator ?? "—"}</code> · Thousands: <code className="bg-muted/50 px-1 rounded">{intelligence.locale.thousandsSeparator ?? "—"}</code></p>
          <p className="text-muted-foreground">{intelligence.locale.reason}</p>
          {intelligence.locale.ambiguous && <p className="text-warning">Locale detection was ambiguous — verify currency/date parsing.</p>}
        </Section>
      </CardContent>
    </Card>
  );
}

function HeroMetric({ label, value, tone }: { label: string; value: ReactNode; tone: string }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function IssueCard({ issue }: { issue: RemediationIssue }) {
  const severity = issue.severity === "critical" ? toneClasses("destructive") : issue.severity === "warning" ? toneClasses("warning") : toneClasses("success");
  return (
    <div className={`rounded-md border p-3 ${severity.soft}`}>
      <div className="flex items-start gap-2">
        {issue.severity === "info" ? <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${severity.text}`} /> : <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${severity.text}`} />}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] uppercase ${severity.text}`}>{issue.severity}</Badge>
            <p className="text-sm font-semibold">{issue.title}</p>
            {issue.column && <span className="font-mono text-[11px] text-primary">{issue.column}</span>}
          </div>
          <p><strong>Problem:</strong> <span className="text-muted-foreground">{issue.problem}</span></p>
          <p><strong>Impact:</strong> <span className="text-muted-foreground">{issue.impact}</span></p>
          <p><strong>Suggested fix:</strong> <span className="text-muted-foreground">{issue.suggestedFix}</span></p>
          <div className="flex flex-wrap gap-1 pt-1">
            {issue.actions.map((action) => (
              <button
                key={action}
                type="button"
                className="text-[10px] px-2 py-1 rounded border border-border bg-background hover:bg-muted transition-colors"
              >
                {action === "auto_fix" ? "Auto Fix" : action === "review" ? "Review" : "Ignore"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RepairLine({ label, value, warning = false }: { label: string; value: ReactNode; warning?: boolean }) {
  const numeric = typeof value === "number" ? value : undefined;
  const active = typeof numeric === "number" ? numeric > 0 : true;
  return (
    <li className="flex items-center gap-2">
      {warning && active ? <AlertTriangle className="w-3.5 h-3.5 text-warning" /> : <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </li>
  );
}

function RelationshipSection({ relationships }: { relationships?: CrossSheetDiscoveryResult | null }) {
  return (
    <Section
      title="Cross-Sheet Relationships"
      icon={<Link2 className="w-3.5 h-3.5 text-primary" />}
      badge={<Badge variant="outline" className="text-[10px]">{relationships?.relationships.length ?? 0}</Badge>}
    >
      {!relationships || relationships.relationships.length === 0 ? (
        <div className="space-y-1">
          <p>No relationships discovered.</p>
          <p className="text-muted-foreground">Upload multi-sheet workbooks or linked datasets to enable relationship detection.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {relationships.relationships.map((relationship, index) => (
            <li key={index} className="rounded-md border border-border/60 bg-muted/20 p-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-primary">{relationship.fromSheet}.{relationship.fromColumn}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-mono text-primary">{relationship.toSheet}.{relationship.toColumn}</span>
                <Badge variant="outline" className="text-[10px] ml-auto">{Math.round(relationship.confidence * 100)}%</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{relationship.kind} · {relationship.basis.join(", ")}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function SimilaritySection({ intelligence }: { intelligence: IngestionIntelligenceResult }) {
  const groups = intelligence.columnSimilarity.groups;
  return (
    <Section
      title="Column Similarity Groups"
      icon={<Layers className="w-3.5 h-3.5 text-primary" />}
      badge={<Badge variant="outline" className="text-[10px]">{groups.length}</Badge>}
    >
      {groups.length === 0 ? (
        <div className="space-y-1">
          <p>No duplicate or semantically similar columns detected.</p>
          <p className="text-muted-foreground">Column names appear distinct and unambiguous.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {groups.map((group, index) => (
            <li key={group.canonicalName} className="rounded-md border border-border/60 bg-muted/20 p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[11px] text-primary">Group #{index + 1} · {group.canonicalName}</span>
                <Badge variant="outline" className="text-[10px]">{Math.round(group.confidence * 100)}%</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {group.columns.map((column) => (
                  <span key={column} className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border">{column}</span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-2 text-center">
      <div className={`text-lg font-bold ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function DictionaryDrillDown({ intelligence }: { intelligence: IngestionIntelligenceResult }) {
  const groups = useMemo(() => {
    const byCategory: Record<string, { name: string; description: string }[]> = {
      Metrics: [],
      Dimensions: [],
      Identifiers: [],
      PII: [],
      Review: [],
    };
    intelligence.dictionary.fields.forEach((field) => {
      if (field.inferredType === "value") byCategory.Metrics.push({ name: field.name, description: field.description });
      if (["segment", "region", "region_code", "date"].includes(field.inferredType)) byCategory.Dimensions.push({ name: field.name, description: field.description });
      if (field.semanticType === "identifier" || field.businessRole === "entity_key") byCategory.Identifiers.push({ name: field.name, description: field.description });
      if (field.semanticType === "pii" || field.governanceFlags.includes("pii")) byCategory.PII.push({ name: field.name, description: field.description });
      if (field.governanceFlags.includes("review_required") || field.confidence < 0.75) byCategory.Review.push({ name: field.name, description: field.description });
    });
    return byCategory;
  }, [intelligence.dictionary.fields]);

  return (
    <div className="space-y-1.5">
      {(Object.keys(groups) as Array<keyof typeof groups>).map((category) => {
        const items = groups[category];
        if (items.length === 0) return null;
        return <DictionaryGroup key={category} title={category} items={items} />;
      })}
    </div>
  );
}

function DictionaryGroup({ title, items }: { title: string; items: { name: string; description: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-border/60 bg-background/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-muted/30 transition-colors text-left"
      >
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        <span className="text-xs font-medium flex-1">{title}</span>
        <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
      </button>
      {open && (
        <ul className="px-3 py-2 space-y-1 border-t border-border/40">
          {items.map((item) => (
            <li key={item.name} className="flex items-start gap-2 text-[11px]">
              <span className="font-mono text-primary shrink-0">{item.name}</span>
              <span className="text-muted-foreground line-clamp-1">— {item.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

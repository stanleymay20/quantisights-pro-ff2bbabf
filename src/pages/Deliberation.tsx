/**
 * Deliberation — Deterministic deliberation layer for pending decisions.
 *
 * Per project memory:
 *   - No LLM personas, no synthesized prose, no fabricated consensus score.
 *   - Perspectives are computed deterministically from real signals
 *     (decision_ledger, governance_thresholds, narrative_conflicts, decision_approvals).
 *   - Human votes only — surfaced from decision_approvals; not auto-generated.
 *   - All explanations use "Label: value" format anchored to source statistics.
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { usePendingDeliberations, useDeliberation } from "@/hooks/useDeliberation";
import type { PerspectiveStance } from "@/lib/deliberation/perspectives";
import { Scale, Users, AlertTriangle, CheckCircle2, MinusCircle, HelpCircle, XCircle, ArrowLeft } from "lucide-react";

const stanceMeta: Record<PerspectiveStance, { label: string; icon: typeof CheckCircle2; className: string }> = {
  supports: { label: "Supports", icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400 border-emerald-600/30 bg-emerald-500/5" },
  conditional: { label: "Conditional", icon: MinusCircle, className: "text-amber-600 dark:text-amber-400 border-amber-600/30 bg-amber-500/5" },
  concerns: { label: "Concerns", icon: AlertTriangle, className: "text-amber-700 dark:text-amber-300 border-amber-700/40 bg-amber-500/10" },
  opposes: { label: "Opposes", icon: XCircle, className: "text-destructive border-destructive/30 bg-destructive/5" },
  insufficient_evidence: { label: "Insufficient Evidence", icon: HelpCircle, className: "text-muted-foreground border-border bg-muted/30" },
};

const toneClass = (tone?: string) => {
  switch (tone) {
    case "positive": return "text-emerald-600 dark:text-emerald-400";
    case "warning": return "text-amber-600 dark:text-amber-400";
    case "negative": return "text-destructive";
    default: return "";
  }
};

function DeliberationDetail({ decisionId, onBack }: { decisionId: string; onBack: () => void }) {
  const { data, loading } = useDeliberation(decisionId);

  if (loading) return <div className="text-xs text-muted-foreground p-6">Loading deliberation…</div>;
  if (!data) return (
    <Card className="p-6">
      <div className="text-sm text-muted-foreground">Decision not found or no longer in scope.</div>
      <Button variant="outline" size="sm" className="mt-3" onClick={onBack}><ArrowLeft className="h-3 w-3 mr-1" /> Back</Button>
    </Card>
  );

  const { decision, perspectives, summary } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-3 w-3 mr-1" /> Back to queue</Button>
      </div>

      {/* Decision header */}
      <Card className="p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Decision under deliberation</div>
        <h2 className="text-xl font-semibold mt-1">{decision.recommended_action}</h2>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="outline" className="text-[10px]">{decision.decision_type}</Badge>
          <Badge variant="outline" className="text-[10px]">Status: {decision.decision_status}</Badge>
          <Badge variant="outline" className="text-[10px] tabular-nums">
            Confidence: {decision.capped_confidence != null ? `${(Number(decision.capped_confidence) * 100).toFixed(1)}%` : "—"}
          </Badge>
        </div>
      </Card>

      {/* Summary — REAL counts only */}
      <Card className="p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Deliberation summary (deterministic, no synthesis)</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Supports" value={summary.perspectives_supports.toString()} tone="positive" />
          <Stat label="Conditional" value={summary.perspectives_conditional.toString()} tone="warning" />
          <Stat label="Concerns" value={summary.perspectives_concerns.toString()} tone="warning" />
          <Stat label="Opposes" value={summary.perspectives_opposes.toString()} tone="negative" />
          <Stat label="Insufficient" value={summary.perspectives_insufficient.toString()} />
        </div>
        <Separator className="my-4" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="Human approvals received" value={`${summary.human_approvals_received}/${summary.human_approvals_required}`} />
          <Stat label="Human rejections" value={summary.human_rejections.toString()} tone={summary.human_rejections > 0 ? "negative" : undefined} />
          <Stat label="Gate status" value={summary.status.replace(/_/g, " ")} />
        </div>
        <div className="mt-3 text-[11px] text-muted-foreground flex items-start gap-2">
          <Scale className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            No consensus score is synthesized. Perspective stances are deterministic functions of governance thresholds and decision evidence.
            Final approval requires real human votes via the Decision Ledger.
          </span>
        </div>
      </Card>

      {/* Perspectives */}
      <SectionErrorBoundary sectionName="Deliberation — Perspectives">
        <div className="grid gap-4 md:grid-cols-2">
          {perspectives.map((p) => {
            const meta = stanceMeta[p.stance];
            const Icon = meta.icon;
            return (
              <Card key={p.id} className={"p-5 border " + meta.className}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{p.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{p.question}</div>
                  </div>
                  <Badge variant="outline" className={"text-[10px] shrink-0 " + meta.className}>
                    <Icon className="h-3 w-3 mr-1" /> {meta.label}
                  </Badge>
                </div>
                <div className="text-sm mt-3 leading-relaxed">{p.rationale}</div>
                <Separator className="my-3" />
                <div className="grid grid-cols-2 gap-2">
                  {p.facts.map((f, i) => (
                    <div key={i} className="border-l-2 border-border/60 pl-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{f.label}</div>
                      <div className={"text-sm font-medium tabular-nums " + toneClass(f.tone)}>{f.value}</div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </SectionErrorBoundary>

      <Card className="p-4 text-xs text-muted-foreground flex items-start gap-2">
        <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          To approve or reject, use the human approval workflow in the Decision Ledger.
          Approval verdicts recorded there flow back into this view automatically.
        </span>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="border-l-2 border-border/60 pl-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"text-base font-semibold tabular-nums " + toneClass(tone)}>{value}</div>
    </div>
  );
}

export default function Deliberation() {
  const { rows, loading } = usePendingDeliberations();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) return (
    <div className="container max-w-6xl mx-auto py-8 px-6">
      <DeliberationDetail decisionId={selectedId} onBack={() => setSelectedId(null)} />
    </div>
  );

  return (
    <div className="container max-w-6xl mx-auto py-8 px-6 space-y-6">
      <header>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Decision OS</div>
        <h1 className="text-2xl font-semibold tracking-tight">Deliberation</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Deterministic, multi-perspective evaluation of pending decisions. Each perspective is computed from real
          governance thresholds, evidence sources, and conflict signals — never from LLM personas or synthesized votes.
        </p>
      </header>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b text-[10px] uppercase tracking-wide text-muted-foreground">Pending decisions ({rows.length})</div>
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading queue…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No pending decisions to deliberate.</div>
        ) : (
          <ul className="divide-y">
            {rows.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(d.id)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/40 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{d.recommended_action}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {d.decision_type} · created {new Date(d.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px] tabular-nums">
                      conf {d.capped_confidence != null ? `${(Number(d.capped_confidence) * 100).toFixed(0)}%` : "—"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">{d.decision_status}</Badge>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

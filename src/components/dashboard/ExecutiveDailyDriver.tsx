// @ts-nocheck — suppresses TS2589/TS2769 from large generated schema; remove when schema stabilises
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  MessageSquareText,
  ArrowRight,
  ChevronRight,
  Loader2,
  Clock,
  Target,
  BarChart3,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Euro,
  Minus,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useExecutiveIntelligence } from "@/hooks/useExecutiveIntelligence";
import type { MetricTypeSummary } from "@/hooks/useMetrics";
import type { Insight } from "@/hooks/useInsights";
import { generateAnswer } from "@/lib/copilot-answer-engine";
import type { DecisionSummary } from "@/lib/copilot-answer-engine";

interface PendingDecision {
  id: string;
  recommended_action: string;
  decision_type: string;
  capped_confidence: number | null;
  predicted_net_impact: number | null;
  created_at: string;
}

interface Props {
  displayName: string;
  orgId: string | null;
  insights: Insight[];
  topMetrics: MetricTypeSummary[];
  pendingDecisions: number;
}

const EURO = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const timeOfDay = () => {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
};

const todayKey = () => new Date().toISOString().slice(0, 10);

function truncateWords(str: string, n: number): string {
  const words = str.split(" ");
  return words.length <= n ? str : words.slice(0, n).join(" ") + "…";
}

function MetricChip({ metric }: { metric: MetricTypeSummary }) {
  const label = metric.metricType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const val = metric.latest > 1000 ? EURO(metric.latest) : metric.latest.toFixed(1);
  const up = metric.trend === "up";
  const down = metric.trend === "down";

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold">{val}</span>
        {up && <TrendingUp className="h-3.5 w-3.5 text-success" />}
        {down && <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
        {!up && !down && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
    </div>
  );
}

function DecisionRow({
  decision,
  onApprove,
  onReject,
  acting,
}: {
  decision: PendingDecision;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  acting: string | null;
}) {
  const navigate = useNavigate();
  const isActing = acting === decision.id;
  const conf = decision.capped_confidence;
  const impact = decision.predicted_net_impact;
  const title = truncateWords(decision.recommended_action, 14);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="rounded-xl border border-border/50 bg-card p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px] capitalize">
              {decision.decision_type.replace(/_/g, " ")}
            </Badge>
            {conf !== null && <span className="text-xs text-muted-foreground">{conf}% confidence</span>}
            {impact !== null && (
              <span className={`text-xs font-medium ${impact >= 0 ? "text-success" : "text-destructive"}`}>
                {impact >= 0 ? "+" : ""}{EURO(impact)} estimated impact
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-foreground">{title}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onReject(decision.id)}
            disabled={!!acting}
          >
            {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            Reject
          </Button>
          <Button size="sm" className="h-8 gap-1.5" onClick={() => onApprove(decision.id)} disabled={!!acting}>
            {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Approve
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground" onClick={() => navigate("/decisions")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

const ExecutiveDailyDriver = ({ displayName, orgId, insights, topMetrics, pendingDecisions }: Props) => {
  const navigate = useNavigate();
  const { brief, interventions, loading: briefLoading, regenerate, generating } = useExecutiveIntelligence();
  const [decisions, setDecisions] = useState<PendingDecision[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<ReturnType<typeof generateAnswer> | null>(null);
  const [answering, setAnswering] = useState(false);
  const autoGeneratedRef = useRef(false);

  useEffect(() => {
    if (autoGeneratedRef.current || briefLoading || generating) return;
    if (brief) return;
    if (!orgId) return;

    const cacheKey = `brief_auto_generated_${orgId}_${todayKey()}`;
    if (sessionStorage.getItem(cacheKey)) return;

    autoGeneratedRef.current = true;
    sessionStorage.setItem(cacheKey, "1");
    regenerate();
  }, [brief, briefLoading, generating, orgId, regenerate]);

  useEffect(() => {
    if (!orgId) return;
    (supabase as any)
      .from("decision_ledger")
      .select("id,recommended_action,decision_type,capped_confidence,predicted_net_impact,created_at")
      .eq("organization_id", orgId)
      .in("decision_status", ["pending", "active"])
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }: { data: PendingDecision[] | null }) => setDecisions(data ?? []));
  }, [orgId]);

  const handleApprove = useCallback(async (id: string) => {
    setActing(id);
    try {
      await (supabase as any).from("decision_ledger").update({
        decision_status: "approved",
        decided_at: new Date().toISOString(),
      }).eq("id", id);
      setDecisions(prev => prev.filter(d => d.id !== id));
    } finally {
      setActing(null);
    }
  }, []);

  const handleReject = useCallback(async (id: string) => {
    setActing(id);
    try {
      await (supabase as any).from("decision_ledger").update({
        decision_status: "rejected",
        decided_at: new Date().toISOString(),
      }).eq("id", id);
      setDecisions(prev => prev.filter(d => d.id !== id));
    } finally {
      setActing(null);
    }
  }, []);

  const handleAsk = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setAnswering(true);
    setQuery("");
    try {
      const result = generateAnswer(q, {
        insights,
        metrics: topMetrics,
        pendingDecisions,
        orgName: "your organisation",
        decisions: decisions as unknown as DecisionSummary[],
      });
      setAnswer(result);
      import("@/lib/analytics").then(({ trackCopilotQuery }) => trackCopilotQuery(result.destination));
    } finally {
      setAnswering(false);
    }
  }, [query, insights, topMetrics, pendingDecisions, decisions]);

  const briefSummary = brief?.summary_json;
  const criticalInterventions = interventions
    .filter(i => i.escalation_tier === "critical" || i.escalation_tier === "high")
    .slice(0, 3);
  const topDecision = decisions[0];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Good {timeOfDay()}, {displayName.split(" ")[0] || displayName}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Today&apos;s decision brief</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-fit shrink-0 gap-1.5"
          onClick={() => {
            regenerate();
            import("@/lib/analytics").then(({ trackBriefGenerated }) => trackBriefGenerated());
          }}
          disabled={generating}
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardContent className="p-5 sm:p-6">
          {generating ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Preparing the latest decision brief from live signals…
            </div>
          ) : topDecision ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wide">Top decision</Badge>
                  <h2 className="text-xl font-semibold leading-snug">{topDecision.recommended_action}</h2>
                  <p className="text-sm text-muted-foreground">
                    Review the evidence, then approve or reject. The decision and outcome will be logged for governance review.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:min-w-[220px]">
                  <div className="rounded-lg border border-border/50 bg-background p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Confidence</p>
                    <p className="mt-1 text-lg font-semibold">{topDecision.capped_confidence ?? "—"}%</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-background p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Impact</p>
                    <p className="mt-1 text-lg font-semibold">
                      {topDecision.predicted_net_impact !== null ? EURO(topDecision.predicted_net_impact) : "—"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="gap-1.5" onClick={() => handleApprove(topDecision.id)} disabled={!!acting}>
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </Button>
                <Button variant="outline" className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleReject(topDecision.id)} disabled={!!acting}>
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
                <Button variant="ghost" className="gap-1.5" onClick={() => navigate("/decisions")}>
                  View evidence <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : briefSummary ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wide">Executive summary</Badge>
                <h2 className="text-xl font-semibold leading-snug">{briefSummary.headline}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{briefSummary.why_it_matters}</p>
              </div>
              {briefSummary.recommended_executive_actions?.length > 0 && (
                <div className="space-y-2 border-t border-border/40 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommended next actions</p>
                  {briefSummary.recommended_executive_actions.slice(0, 3).map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
                      <span>{a.value || a.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Preparing your decision brief</p>
                <p className="text-xs text-muted-foreground">This usually takes a few seconds once live data is available.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium"><Clock className="h-4 w-4 text-primary" /> Pending decisions</div>
            <p className="mt-2 text-2xl font-semibold">{pendingDecisions}</p>
            <p className="mt-1 text-xs text-muted-foreground">Need sign-off or review.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="h-4 w-4 text-destructive" /> Critical alerts</div>
            <p className="mt-2 text-2xl font-semibold">{criticalInterventions.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">High-priority risks surfaced today.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4 text-primary" /> Governance record</div>
            <p className="mt-2 text-2xl font-semibold">Active</p>
            <p className="mt-1 text-xs text-muted-foreground">Decisions are tracked with evidence.</p>
          </CardContent>
        </Card>
      </div>

      {criticalInterventions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Priority risks</p>
          {criticalInterventions.map(i => (
            <div key={i.id} className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.03] p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{i.title}</p>
                {i.recommended_action && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{i.recommended_action}</p>}
              </div>
              <Button size="sm" variant="ghost" className="h-7 shrink-0 text-xs" onClick={() => navigate("/executive-intelligence")}>Review</Button>
            </div>
          ))}
        </div>
      )}

      {decisions.length > 1 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Other decisions</p>
            <button className="text-xs text-primary hover:underline" onClick={() => navigate("/decisions")}>View ledger →</button>
          </div>
          <AnimatePresence mode="popLayout">
            {decisions.slice(1).map(d => <DecisionRow key={d.id} decision={d} onApprove={handleApprove} onReject={handleReject} acting={acting} />)}
          </AnimatePresence>
        </div>
      )}

      {topMetrics.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Supporting metrics
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {topMetrics.slice(0, 6).map(m => <MetricChip key={m.metricType} metric={m} />)}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <MessageSquareText className="h-3.5 w-3.5" /> Ask about this decision
          </p>

          <AnimatePresence>
            {answer && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-primary/25 bg-primary/[0.02] p-4 space-y-3"
              >
                <p className="text-sm font-semibold">{answer.headline}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{answer.summary}</p>
                {answer.lines.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-border/30">
                    {answer.lines.map((line, i) => (
                      <div key={i} className={`flex justify-between gap-3 px-3 py-1.5 text-xs ${i < answer.lines.length - 1 ? "border-b border-border/20" : ""} ${line.alert ? "bg-destructive/[0.03]" : ""}`}>
                        <span className="text-muted-foreground">{line.label}</span>
                        <span className={`font-medium ${line.alert ? "text-destructive" : line.emphasis ? "text-foreground" : "text-muted-foreground"}`}>{line.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-2">
                    {answer.confidence !== null && <Badge variant="outline" className="h-5 text-[10px]">{answer.confidence}% confidence</Badge>}
                    {answer.dataSource === "live" && <Badge variant="outline" className="h-5 text-[10px] text-success border-success/30">Live data</Badge>}
                  </div>
                  <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => navigate(answer.destination)}>
                    {answer.destinationLabel} <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <Textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleAsk(); } }}
              placeholder="Ask: What evidence supports this? What risk should I review first?"
              className="min-h-[64px] resize-none rounded-xl border-border/50 pr-16 text-sm focus:border-primary/50"
              rows={2}
              aria-label="Ask about this decision"
            />
            <Button size="sm" onClick={handleAsk} disabled={!query.trim() || answering} className="absolute bottom-2 right-2 gap-1.5">
              {answering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2 border-t border-border/20 pt-2">
        {[
          { label: "Decision Ledger", icon: Target, path: "/decisions", count: pendingDecisions },
          { label: "Trust Center", icon: ShieldCheck, path: "/trust-center" },
          { label: "Board Report", icon: BarChart3, path: "/board-report" },
        ].map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center gap-1 rounded-lg p-2.5 text-center transition-colors hover:bg-muted/50"
          >
            <div className="relative">
              <item.icon className="h-4 w-4 text-primary" />
              {item.count !== undefined && item.count > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-warning text-[8px] font-bold text-warning-foreground">
                  {item.count}
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ExecutiveDailyDriver;

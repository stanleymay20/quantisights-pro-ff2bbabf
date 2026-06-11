import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2, XCircle, AlertTriangle, TrendingUp, TrendingDown,
  MessageSquareText, ArrowRight, ChevronRight, Sparkles, Loader2,
  Clock, Target, BarChart3, ShieldCheck, AlertCircle, RefreshCw,
  Euro, Minus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useExecutiveIntelligence, type ExecBrief } from "@/hooks/useExecutiveIntelligence";
import { useOrganization } from "@/hooks/useOrganization";
import type { MetricTypeSummary } from "@/hooks/useMetrics";
import type { Insight } from "@/hooks/useInsights";
import { generateAnswer } from "@/lib/copilot-answer-engine";
import { invokeWithRetry } from "@/lib/edge-function-retry";
import { getVerifiedAuth, authHeaders } from "@/lib/auth-helpers";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricChip({ metric }: { metric: MetricTypeSummary }) {
  const label = metric.metricType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const val = metric.latest > 1000 ? EURO(metric.latest) : metric.latest.toFixed(1);
  const up = metric.trend === "up";
  const down = metric.trend === "down";
  return (
    <div className="flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg bg-muted/40 border border-border/30 min-w-[100px]">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold">{val}</span>
        {up && <TrendingUp className="w-3 h-3 text-success" />}
        {down && <TrendingDown className="w-3 h-3 text-destructive" />}
        {!up && !down && <Minus className="w-3 h-3 text-muted-foreground" />}
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
  const conf = decision.capped_confidence ?? decision.capped_confidence;
  const impact = decision.predicted_net_impact;
  const title = truncateWords(decision.recommended_action, 8);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card hover:border-primary/30 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Badge variant="outline" className="text-[10px] capitalize shrink-0">
            {decision.decision_type.replace(/_/g, " ")}
          </Badge>
          {conf !== null && <span className="text-[10px] text-muted-foreground">{conf}% confidence</span>}
          {impact !== null && (
            <span className={`text-[10px] font-medium ${impact >= 0 ? "text-success" : "text-destructive"}`}>
              {impact >= 0 ? "+" : ""}{EURO(impact)}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onReject(decision.id)}
          disabled={!!acting}
          aria-label="Reject decision"
        >
          {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
        </Button>
        <Button
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onApprove(decision.id)}
          disabled={!!acting}
          aria-label="Approve decision"
        >
          {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-muted-foreground"
          onClick={() => navigate(`/decisions`)}
          aria-label="Open full decision"
        >
          <ChevronRight className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const ExecutiveDailyDriver = ({ displayName, orgId, insights, topMetrics, pendingDecisions }: Props) => {
  const navigate = useNavigate();
  const { brief, interventions, loading: briefLoading, regenerate, generating } = useExecutiveIntelligence();
  const [decisions, setDecisions] = useState<PendingDecision[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<ReturnType<typeof generateAnswer> | null>(null);
  const [answering, setAnswering] = useState(false);
  const autoGeneratedRef = useRef(false);

  // Auto-generate brief once per day if none exists
  useEffect(() => {
    if (autoGeneratedRef.current || briefLoading || generating) return;
    if (brief) return; // already have one
    if (!orgId) return;

    const cacheKey = `brief_auto_generated_${orgId}_${todayKey()}`;
    if (sessionStorage.getItem(cacheKey)) return;

    autoGeneratedRef.current = true;
    sessionStorage.setItem(cacheKey, "1");
    regenerate();
  }, [brief, briefLoading, generating, orgId, regenerate]);

  // Fetch pending decisions
  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("decisions")
      .select("id,recommended_action,decision_type,capped_confidence,predicted_net_impact,created_at")
      .eq("organization_id", orgId)
      .in("decision_status", ["pending", "active"])
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => setDecisions((data as PendingDecision[]) ?? []));
  }, [orgId]);

  const handleApprove = useCallback(async (id: string) => {
    setActing(id);
    try {
      await supabase.from("decisions").update({
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
      await supabase.from("decisions").update({
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
      });
      setAnswer(result);
    } finally {
      setAnswering(false);
    }
  }, [query, insights, topMetrics, pendingDecisions]);

  const briefSummary = brief?.summary_json;
  const criticalInterventions = interventions.filter(i => i.escalation_tier === "critical" || i.escalation_tier === "high").slice(0, 3);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">

      {/* ── Greeting ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold font-display">
            Good {timeOfDay()}, {displayName.split(" ")[0] || displayName}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            {decisions.length > 0 && (
              <span className="ml-2 font-medium text-warning">
                · {decisions.length} decision{decisions.length !== 1 ? "s" : ""} need{decisions.length === 1 ? "s" : ""} your sign-off
              </span>
            )}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5 text-xs"
          onClick={() => regenerate()}
          disabled={generating}
        >
          {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {generating ? "Generating…" : "Refresh brief"}
        </Button>
      </div>

      {/* ── Executive Brief ── */}
      <Card className={`border-primary/20 ${briefSummary ? "bg-primary/[0.02]" : "border-dashed"}`}>
        <CardContent className="p-5">
          {generating ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Generating your executive brief from live signals…
            </div>
          ) : briefSummary ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground leading-snug">{briefSummary.headline}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{briefSummary.why_it_matters}</p>
                </div>
              </div>
              {briefSummary.recommended_executive_actions?.length > 0 && (
                <div className="border-t border-border/30 pt-3 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Recommended actions</p>
                  {briefSummary.recommended_executive_actions.slice(0, 3).map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-foreground">{a.value || a.label}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 pt-1">
                <Badge variant="outline" className="text-[10px] text-success border-success/30 bg-success/5">
                  <ShieldCheck className="w-2.5 h-2.5 mr-1" /> {briefSummary.confidence}% confidence
                </Badge>
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => navigate("/executive-intelligence")}
                >
                  Full intelligence report →
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Preparing your executive brief</p>
                <p className="text-xs text-muted-foreground">Synthesising signals from your data — this takes about 10 seconds.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Critical alerts ── */}
      {criticalInterventions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Critical alerts
          </p>
          {criticalInterventions.map(i => (
            <div key={i.id} className="flex items-start gap-2.5 p-3 rounded-lg border border-destructive/20 bg-destructive/[0.03]">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{i.title}</p>
                {i.recommended_action && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{i.recommended_action}</p>
                )}
              </div>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs shrink-0" onClick={() => navigate("/executive-intelligence")}>
                Review
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* ── Decision queue ── */}
      {decisions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Pending sign-off ({decisions.length})
            </p>
            <button className="text-xs text-primary hover:underline" onClick={() => navigate("/decisions")}>
              View all in Decision Ledger →
            </button>
          </div>
          <AnimatePresence mode="popLayout">
            {decisions.map(d => (
              <DecisionRow key={d.id} decision={d} onApprove={handleApprove} onReject={handleReject} acting={acting} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Live metrics ── */}
      {topMetrics.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Live metrics
          </p>
          <div className="flex flex-wrap gap-2">
            {topMetrics.slice(0, 6).map(m => <MetricChip key={m.metricType} metric={m} />)}
          </div>
        </div>
      )}

      {/* ── Inline Copilot ── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <MessageSquareText className="w-3.5 h-3.5" /> Ask anything
        </p>

        {/* Answer card */}
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
                <div className="border border-border/30 rounded-lg overflow-hidden">
                  {answer.lines.map((line, i) => (
                    <div key={i} className={`flex justify-between px-3 py-1.5 text-xs gap-3 ${i < answer.lines.length - 1 ? "border-b border-border/20" : ""} ${line.alert ? "bg-destructive/[0.03]" : ""}`}>
                      <span className="text-muted-foreground">{line.label}</span>
                      <span className={`font-medium ${line.alert ? "text-destructive" : line.emphasis ? "text-foreground" : "text-muted-foreground"}`}>{line.value}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {answer.confidence !== null && (
                    <Badge variant="outline" className="text-[10px] h-5">{answer.confidence}% confidence</Badge>
                  )}
                  {answer.dataSource === "live" && (
                    <Badge variant="outline" className="text-[10px] h-5 text-success border-success/30">Live data</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-6 px-2 text-xs" onClick={() => navigate(answer.destination)}>
                    {answer.destinationLabel} <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-muted-foreground" onClick={() => setAnswer(null)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative">
          <Textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleAsk(); } }}
            placeholder="Ask anything — 'What should I focus on today?' · 'Are there any risks?' · 'How is revenue trending?'"
            className="min-h-[64px] text-sm resize-none pr-16 rounded-xl border-border/50 focus:border-primary/50"
            rows={2}
            aria-label="Ask the Decision Copilot"
          />
          <Button
            size="sm"
            onClick={handleAsk}
            disabled={!query.trim() || answering}
            className="absolute bottom-2 right-2 gap-1.5"
          >
            {answering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1 ml-1">⌘+Enter to send</p>
        </div>
      </div>

      {/* ── Quick nav ── */}
      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/20">
        {[
          { label: "Decision Ledger", icon: Target, path: "/decisions", count: pendingDecisions },
          { label: "Executive Intelligence", icon: Sparkles, path: "/executive-intelligence" },
          { label: "Trust Center", icon: ShieldCheck, path: "/trust-center" },
          { label: "Board Report", icon: BarChart3, path: "/board-report" },
        ].map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center gap-1 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-center"
          >
            <div className="relative">
              <item.icon className="w-4 h-4 text-primary" />
              {item.count !== undefined && item.count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-warning text-warning-foreground text-[8px] flex items-center justify-center font-bold">
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

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { SidebarMobileToggle } from "@/components/layout/ProtectedShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquareText, ArrowRight, BarChart2, ClipboardList,
  TrendingUp, FileText, ShieldAlert, Sparkles, AlertTriangle,
  CheckCircle2, ChevronRight, X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { useProject } from "@/contexts/ProjectContext";
import { useIndustryLabels } from "@/hooks/useIndustryLanguage";
import { useCopilotTelemetry } from "@/hooks/useCopilotTelemetry";
import { useInsights } from "@/hooks/useInsights";
import { useMetricsSummary } from "@/hooks/useMetricsSummary";
import { supabase } from "@/integrations/supabase/client";
import { generateAnswer, type CopilotAnswer } from "@/lib/copilot-answer-engine";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

/**
 * Decision Copilot — chat-first command centre.
 * Answers questions with live data first, then routes to the deep-dive workspace.
 */

interface SuggestedPrompt {
  label: string;
  icon: React.ElementType;
  path: string;
}

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  { label: "Why are sales slowing?",             icon: TrendingUp,   path: "/executive-intelligence" },
  { label: "What decisions need my approval?",   icon: ClipboardList, path: "/decisions" },
  { label: "Where are we losing money?",         icon: BarChart2,    path: "/executive-intelligence" },
  { label: "Which risks need my attention?",     icon: ShieldAlert,  path: "/interventions" },
  { label: "What will happen if revenue drops 10%?", icon: Sparkles, path: "/simulations" },
  { label: "Show me governance compliance status", icon: FileText,   path: "/trust-center" },
];

// ─── Answer card component ────────────────────────────────────────────────────

function AnswerCard({ answer, onDismiss }: { answer: CopilotAnswer; onDismiss: () => void }) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      <Card className="border-primary/30 bg-primary/[0.02] shadow-sm">
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquareText className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-snug">{answer.headline}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{answer.summary}</p>
              </div>
            </div>
            <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground p-1 shrink-0" aria-label="Dismiss answer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Data lines */}
          {answer.lines.length > 0 && (
            <div className="border border-border/40 rounded-lg overflow-hidden mb-3">
              {answer.lines.map((line, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-3 py-2 text-xs gap-3 ${
                    i < answer.lines.length - 1 ? "border-b border-border/30" : ""
                  } ${line.alert ? "bg-destructive/[0.03]" : "bg-muted/20"}`}
                >
                  <span className="text-muted-foreground truncate">{line.label}</span>
                  <span className={`font-medium shrink-0 ${
                    line.alert ? "text-destructive" : line.emphasis ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {line.alert && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                    {line.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {answer.confidence !== null && (
                <Badge variant="outline" className="text-[10px] h-5">
                  {answer.confidence}% confidence
                </Badge>
              )}
              {answer.dataSource === "live" && (
                <Badge variant="outline" className="text-[10px] h-5 text-success border-success/30 bg-success/5">
                  <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Live data
                </Badge>
              )}
            </div>
            <Button size="sm" variant="default" className="gap-1.5 h-7 text-xs" onClick={() => navigate(answer.destination)}>
              {answer.destinationLabel}
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const Copilot = () => {
  const { profile } = useAuth();
  const { currentOrg, currentOrgId } = useOrganization();
  const { orgRole } = usePermissions();
  const { activeDatasetId } = useProject();
  const lang = useIndustryLabels(currentOrg?.industry);
  const { logQuery } = useCopilotTelemetry();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<CopilotAnswer | null>(null);
  const [pendingDecisions, setPendingDecisions] = useState(0);

  const { insights } = useInsights(currentOrgId ?? null, activeDatasetId ?? null);
  const { topMetrics } = useMetricsSummary(currentOrgId ?? null, activeDatasetId ?? null);

  // Fetch pending decision count for context
  useEffect(() => {
    if (!currentOrgId) return;
    supabase
      .from("decisions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", currentOrgId)
      .eq("execution_status", "pending")
      .then(({ count }) => setPendingDecisions(count ?? 0));
  }, [currentOrgId]);

  // Pre-populate from ?q= URL param
  useEffect(() => {
    const prefilledQuery = searchParams.get("q");
    if (prefilledQuery) setQuery(prefilledQuery);
  }, [searchParams]);

  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const handleSubmit = useCallback(() => {
    const q = query.trim();
    if (!q) return;

    // Log for telemetry (non-blocking)
    logQuery(q);

    // Generate inline answer from live data
    const generated = generateAnswer(q, {
      insights,
      metrics: topMetrics,
      pendingDecisions,
      orgName: currentOrg?.name?.trim() ?? "your organisation",
    });
    setAnswer(generated);
    setQuery("");
  }, [query, insights, topMetrics, pendingDecisions, currentOrg, logQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePromptClick = (prompt: SuggestedPrompt) => {
    logQuery(prompt.label, prompt.path, true);
    // Generate answer for the suggested prompt too
    const generated = generateAnswer(prompt.label, {
      insights,
      metrics: topMetrics,
      pendingDecisions,
      orgName: currentOrg?.name?.trim() ?? "your organisation",
    });
    setAnswer(generated);
  };

  return (
    <SectionErrorBoundary sectionName="Copilot">
      <>
        <header className="h-14 border-b border-border/30 flex items-center gap-3 px-6 shrink-0 bg-background/60 backdrop-blur-sm">
          <SidebarMobileToggle />
          <MessageSquareText className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold font-display">Decision Copilot</h1>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="max-w-2xl mx-auto px-6 pt-12 pb-12">

            {/* Greeting */}
            {!answer && (
              <div className="text-center mb-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <MessageSquareText className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold font-display mb-2">
                  Good to see you, {firstName}
                </h2>
                <p className="text-muted-foreground text-sm">
                  Ask anything about your business — I'll answer from your live data.
                </p>
                {orgRole && orgRole !== "owner" && orgRole !== "admin" && (
                  <span className="inline-block mt-2 text-[11px] text-muted-foreground/60 bg-muted/40 px-2.5 py-1 rounded-full capitalize">
                    {orgRole} view
                  </span>
                )}
              </div>
            )}

            {/* Inline answer */}
            <AnimatePresence mode="wait">
              {answer && (
                <AnswerCard key="answer" answer={answer} onDismiss={() => setAnswer(null)} />
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="relative mb-6">
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={answer
                  ? "Ask a follow-up question…"
                  : "Ask anything — e.g. 'What are my biggest risks?' or 'What decisions need approval?'"}
                className="min-h-[72px] text-sm resize-none pr-16 rounded-xl border-border/50 focus:border-primary/50"
                rows={3}
                aria-label="Ask the Decision Copilot"
              />
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!query.trim()}
                className="absolute bottom-3 right-3 gap-1.5"
                aria-label="Send question"
              >
                Ask <ArrowRight className="w-3.5 h-3.5" />
              </Button>
              <p className="text-[11px] text-muted-foreground mt-1.5 ml-1">⌘+Enter to send</p>
            </div>

            {/* Suggested prompts */}
            {!answer && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Try asking
                </p>
                {(lang.copilotPrompts.length > 0
                  ? lang.copilotPrompts.map((label, i) => ({
                      label,
                      icon: SUGGESTED_PROMPTS[i % SUGGESTED_PROMPTS.length].icon,
                      path: SUGGESTED_PROMPTS[i % SUGGESTED_PROMPTS.length].path,
                    }))
                  : SUGGESTED_PROMPTS
                ).map((prompt) => (
                  <Card
                    key={prompt.label}
                    className="border-border/40 hover:border-primary/40 cursor-pointer transition-all hover:bg-muted/30"
                    onClick={() => handlePromptClick(prompt)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && handlePromptClick(prompt)}
                    aria-label={`Ask: ${prompt.label}`}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <prompt.icon className="w-4 h-4 text-primary" />
                      </div>
                      <p className="text-sm font-medium text-foreground flex-1 truncate">{prompt.label}</p>
                      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Decision lifecycle */}
            <div className="mt-8 border-t border-border/30 pt-5">
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest text-center mb-3">
                Every decision follows the same path
              </p>
              <div className="flex items-center justify-center gap-1 flex-wrap">
                {[
                  { label: "Data",          path: "/data-upload" },
                  { label: "Signals",       path: "/executive-intelligence" },
                  { label: "Decision Brief",path: "/decisions" },
                  { label: "Approval",      path: "/decisions" },
                  { label: "Execution",     path: "/execution" },
                  { label: "Outcome",       path: "/outcomes" },
                  { label: "Learning",      path: "/decision-accuracy" },
                ].map((step, i, arr) => (
                  <span key={step.label} className="flex items-center gap-1">
                    <button
                      onClick={() => navigate(step.path)}
                      className="text-[11px] text-muted-foreground/60 hover:text-primary transition-colors"
                    >
                      {step.label}
                    </button>
                    {i < arr.length - 1 && (
                      <span className="text-muted-foreground/30 text-[10px]">→</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </main>
      </>
    </SectionErrorBoundary>
  );
};

export default Copilot;

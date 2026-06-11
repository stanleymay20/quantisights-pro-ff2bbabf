import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SidebarMobileToggle } from "@/components/layout/ProtectedShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquareText, ArrowRight, BarChart2, ClipboardList,
  TrendingUp, FileText, ShieldAlert, Sparkles, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { useIndustryLabels } from "@/hooks/useIndustryLanguage";
import { useCopilotTelemetry } from "@/hooks/useCopilotTelemetry";
import { supabase } from "@/integrations/supabase/client";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

interface SuggestedPrompt {
  label: string;
  icon: React.ElementType;
  path: string;
  description: string;
}

interface InlineBrief {
  query: string;
  title: string;
  summary: string;
  action: string;
  destination: string;
  confidence?: number | null;
  status: "answered" | "needs_data";
}

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  { label: "Why are sales slowing?", icon: TrendingUp, path: "/executive-intelligence", description: "Generates a Decision Brief" },
  { label: "What should I prioritise this week?", icon: ClipboardList, path: "/decisions", description: "Finds priority decisions" },
  { label: "Where are we losing money?", icon: BarChart2, path: "/executive-intelligence", description: "Analyses cost and margin signals" },
  { label: "What decisions need my approval?", icon: ShieldAlert, path: "/decisions", description: "Shows pending approvals" },
  { label: "What will happen if revenue drops 10%?", icon: Sparkles, path: "/simulations", description: "Runs a scenario path" },
  { label: "Which risks need my attention?", icon: FileText, path: "/interventions", description: "Surfaces active risks" },
];

const shortTitle = (value: string) => {
  const cleaned = value.replace(/[—–-].*$/, "").trim();
  return cleaned.split(/\s+/).slice(0, 7).join(" ") || "Review Decision Brief";
};

const toPercent = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value > 1 ? Math.round(value) : Math.round(value * 100);
};

const fallbackBrief = (query: string, destination: string): InlineBrief => ({
  query,
  destination,
  status: "needs_data",
  title: "Connect Data First",
  summary: "Quantivis needs connected data or existing decision evidence before it can answer this with a full Decision Brief.",
  action: "Connect data, then ask the same question again to receive an evidence-backed recommendation.",
});

const decisionToBrief = (query: string, destination: string, decision: any): InlineBrief => {
  const action = decision?.recommended_action || decision?.source_insight_summary || decision?.notes || "Review this decision";
  return {
    query,
    destination,
    status: "answered",
    title: shortTitle(action),
    summary: decision?.source_insight_summary || action,
    action,
    confidence: toPercent(decision?.capped_confidence ?? decision?.confidence_at_decision ?? decision?.raw_confidence),
  };
};

const Copilot = () => {
  const { profile } = useAuth();
  const { currentOrg, currentOrgId } = useOrganization();
  const { orgRole } = usePermissions();
  const lang = useIndustryLabels(currentOrg?.industry);
  const { logQuery } = useCopilotTelemetry();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [brief, setBrief] = useState<InlineBrief | null>(null);
  const [answering, setAnswering] = useState(false);

  useEffect(() => {
    const prefilledQuery = searchParams.get("q");
    if (prefilledQuery) setQuery(prefilledQuery);
  }, [searchParams]);

  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const answerQuestion = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const { destination } = logQuery(trimmed);
    setAnswering(true);
    try {
      if (!currentOrgId) {
        setBrief(fallbackBrief(trimmed, destination));
        return;
      }
      const { data } = await supabase
        .from("decision_ledger")
        .select("recommended_action, source_insight_summary, notes, capped_confidence, confidence_at_decision, raw_confidence, created_at")
        .eq("organization_id", currentOrgId)
        .order("created_at", { ascending: false })
        .limit(1);
      const decision = data?.[0];
      setBrief(decision ? decisionToBrief(trimmed, destination, decision) : fallbackBrief(trimmed, destination));
      setQuery("");
    } finally {
      setAnswering(false);
    }
  };

  const handleSubmit = () => answerQuestion(query);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
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
          <div className="max-w-2xl mx-auto px-6 pt-16 pb-12">
            <div className="text-center mb-10">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MessageSquareText className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold font-display mb-2">Good to see you, {firstName}</h2>
              <p className="text-muted-foreground text-sm">Quantivis turns your data into decisions, tracks outcomes, and learns what works.</p>
              {orgRole && orgRole !== "owner" && orgRole !== "admin" && (
                <span className="inline-block mt-2 text-[11px] text-muted-foreground/60 bg-muted/40 px-2.5 py-1 rounded-full capitalize">{orgRole} view</span>
              )}
            </div>

            <div className="relative mb-8">
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything - e.g. 'Why are sales slowing?' or 'Show me pending approvals'"
                className="min-h-[80px] text-sm resize-none pr-20 rounded-xl border-border/50 focus:border-primary/50"
                rows={3}
              />
              <Button size="sm" onClick={handleSubmit} disabled={!query.trim() || answering} className="absolute bottom-3 right-3 gap-1.5">
                {answering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Ask <ArrowRight className="w-3.5 h-3.5" /></>}
              </Button>
              <p className="text-[11px] text-muted-foreground mt-1.5 ml-1">Command+Enter to send</p>
            </div>

            {brief && (
              <Card className="mb-8 border-primary/30 bg-card/80">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={brief.status === "answered" ? "default" : "outline"} className="text-[10px]">
                          {brief.status === "answered" ? "Decision Brief" : "Setup Brief"}
                        </Badge>
                        {brief.confidence != null && <Badge variant="outline" className="text-[10px]">{brief.confidence}% confidence</Badge>}
                      </div>
                      <h3 className="text-lg font-semibold font-display">{brief.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">Asked: {brief.query}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Summary</p>
                    <p className="text-sm text-foreground leading-relaxed">{brief.summary}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Recommended action</p>
                    <p className="text-sm font-medium text-foreground">{brief.action}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => navigate("/decisions")}>Approve / Review</Button>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/simulations?q=${encodeURIComponent(brief.query)}`)}>Simulate</Button>
                    <Button size="sm" variant="outline" onClick={() => navigate("/deliberation")}>Discuss</Button>
                    <Button size="sm" variant="ghost" onClick={() => navigate(brief.destination)}>Open workspace</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Try asking</p>
              {(lang.copilotPrompts.length > 0
                ? lang.copilotPrompts.map((label, i) => ({
                    label,
                    icon: SUGGESTED_PROMPTS[i % SUGGESTED_PROMPTS.length].icon,
                    path: SUGGESTED_PROMPTS[i % SUGGESTED_PROMPTS.length].path,
                    description: SUGGESTED_PROMPTS[i % SUGGESTED_PROMPTS.length].description,
                  }))
                : SUGGESTED_PROMPTS
              ).map((prompt) => (
                <Card key={`${prompt.path}-${prompt.label}`} className="border-border/40 hover:border-primary/40 cursor-pointer transition-all hover:bg-muted/30" onClick={() => answerQuestion(prompt.label)}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <prompt.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{prompt.label}</p>
                      <p className="text-[11px] text-muted-foreground">{prompt.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-10 border-t border-border/30 pt-6">
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest text-center mb-3">Every decision follows the same path</p>
              <div className="flex items-center justify-center gap-1 flex-wrap">
                {[
                  { label: "Data", path: "/data-upload" },
                  { label: "Signals", path: "/executive-intelligence" },
                  { label: "Decision Brief", path: "/decisions" },
                  { label: "Approval", path: "/decisions" },
                  { label: "Execution", path: "/execution" },
                  { label: "Outcome", path: "/outcomes" },
                  { label: "Learning", path: "/decision-accuracy" },
                ].map((step, i, arr) => (
                  <span key={step.label} className="flex items-center gap-1">
                    <button onClick={() => navigate(step.path)} className="text-[11px] text-muted-foreground/60 hover:text-primary transition-colors">{step.label}</button>
                    {i < arr.length - 1 && <span className="text-muted-foreground/30 text-[10px]">-&gt;</span>}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 text-center space-y-1">
              <p className="text-xs text-muted-foreground">Looking for a specific workspace? <button onClick={() => navigate("/dashboard")} className="text-primary hover:underline">View all workspaces</button></p>
              <p className="text-xs text-muted-foreground"><button onClick={() => navigate("/copilot/analytics")} className="text-muted-foreground/60 hover:text-primary transition-colors hover:underline">Copilot analytics and Phase 6 readiness -&gt;</button></p>
            </div>
          </div>
        </main>
      </>
    </SectionErrorBoundary>
  );
};

export default Copilot;

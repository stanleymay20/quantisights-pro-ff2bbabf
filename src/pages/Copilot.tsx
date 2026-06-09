import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarMobileToggle } from "@/components/layout/ProtectedShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageSquareText, ArrowRight, BarChart2, ClipboardList,
  TrendingUp, FileText, ShieldAlert, Sparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { useIndustryLabels } from "@/hooks/useIndustryLanguage";
import { useCopilotTelemetry } from "@/hooks/useCopilotTelemetry";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

/**
 * Copilot — Phase 3 placeholder.
 *
 * This page acts as the Decision Copilot entry point.
 * In Phase 3 the input box will be wired to an intent-routing engine
 * that surfaces the correct page, dataset, or action based on the user's query.
 *
 * For now it renders the conversational entry UI with suggested prompts
 * and navigates to the most relevant existing page when a prompt is selected.
 */

interface SuggestedPrompt {
  label: string;
  icon: React.ElementType;
  path: string;
  description: string;
}

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    label: "What are my biggest risks this week?",
    icon: ShieldAlert,
    path: "/executive-intelligence",
    description: "Opens Executive Intelligence",
  },
  {
    label: "What decisions need my approval?",
    icon: ClipboardList,
    path: "/decisions",
    description: "Opens Decision Ledger",
  },
  {
    label: "Run a forecast for next quarter",
    icon: TrendingUp,
    path: "/forecasting",
    description: "Opens Forecasting",
  },
  {
    label: "Prepare a board report",
    icon: FileText,
    path: "/reports",
    description: "Opens Reports",
  },
  {
    label: "Analyse my latest data",
    icon: BarChart2,
    path: "/data-upload",
    description: "Opens Data Upload",
  },
  {
    label: "Run a what-if scenario",
    icon: Sparkles,
    path: "/simulations",
    description: "Opens Simulations",
  },
];

const Copilot = () => {
  const { profile } = useAuth();
  const { currentOrg } = useOrganization();
  const { orgRole } = usePermissions();
  const lang = useIndustryLabels(currentOrg?.industry);
  const { logQuery } = useCopilotTelemetry();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  const handleSubmit = () => {
    if (!query.trim()) return;
    // Log the query and detect intent
    const { destination } = logQuery(query);
    navigate(destination);
    setQuery("");
  };

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
          <span className="ml-2 text-xs text-muted-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            Phase 3 — intent routing coming
          </span>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="max-w-2xl mx-auto px-6 pt-16 pb-12">

            {/* Greeting */}
            <div className="text-center mb-10">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MessageSquareText className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold font-display mb-2">
                Good to see you, {firstName}
              </h2>
              <p className="text-muted-foreground text-sm">
                What decision do you need to make today?
              </p>
              {orgRole && orgRole !== "owner" && orgRole !== "admin" && (
                <span className="inline-block mt-2 text-[11px] text-muted-foreground/60 bg-muted/40 px-2.5 py-1 rounded-full capitalize">
                  {orgRole} view
                </span>
              )}
            </div>

            {/* Input */}
            <div className="relative mb-8">
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything — e.g. 'What are my biggest supply chain risks?' or 'Show me pending approvals'"
                className="min-h-[80px] text-sm resize-none pr-16 rounded-xl border-border/50 focus:border-primary/50"
                rows={3}
              />
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!query.trim()}
                className="absolute bottom-3 right-3 gap-1.5"
              >
                Ask <ArrowRight className="w-3.5 h-3.5" />
              </Button>
              <p className="text-[11px] text-muted-foreground mt-1.5 ml-1">
                ⌘+Enter to send
              </p>
            </div>

            {/* Suggested prompts */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Suggested
              </p>
              {(lang.copilotPrompts.length > 0
              ? lang.copilotPrompts.map((label, i) => ({
                  label,
                  icon: SUGGESTED_PROMPTS[i % SUGGESTED_PROMPTS.length].icon,
                  path: SUGGESTED_PROMPTS[i % SUGGESTED_PROMPTS.length].path,
                  description: SUGGESTED_PROMPTS[i % SUGGESTED_PROMPTS.length].description,
                }))
              : SUGGESTED_PROMPTS
            ).map((prompt) => (
                <Card
                  key={prompt.path}
                  className="border-border/40 hover:border-primary/40 cursor-pointer transition-all hover:bg-muted/30"
                  onClick={() => {
                    logQuery(prompt.label, prompt.path, true);
                    navigate(prompt.path);
                  }}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <prompt.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {prompt.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {prompt.description}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Decision Brief lifecycle — Decision Brief Doctrine (IA v1.2) */}
            <div className="mt-10 border-t border-border/30 pt-6">
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest text-center mb-3">
                Every decision follows the same path
              </p>
              <div className="flex items-center justify-center gap-1 flex-wrap">
                {[
                  { label: "Data",     path: "/data-upload" },
                  { label: "Signals",  path: "/executive-intelligence" },
                  { label: "Decision Brief", path: "/decisions" },
                  { label: "Approval", path: "/decisions" },
                  { label: "Execution",path: "/execution" },
                  { label: "Outcome",  path: "/outcomes" },
                  { label: "Learning", path: "/decision-accuracy" },
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

            {/* Advanced workspaces link */}
            <div className="mt-6 text-center space-y-1">
              <p className="text-xs text-muted-foreground">
                Looking for a specific workspace?{" "}
                <button
                  onClick={() => navigate("/dashboard")}
                  className="text-primary hover:underline"
                >
                  View all workspaces
                </button>
              </p>
              <p className="text-xs text-muted-foreground">
                <button
                  onClick={() => navigate("/copilot/analytics")}
                  className="text-muted-foreground/60 hover:text-primary transition-colors hover:underline"
                >
                  Copilot analytics & Phase 6 readiness →
                </button>
              </p>
            </div>
          </div>
        </main>
      </>
    </SectionErrorBoundary>
  );
};

export default Copilot;

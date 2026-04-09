import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarMobileToggle } from "@/components/layout/ProtectedShell";
import OrgSwitcher from "@/components/dashboard/OrgSwitcher";
import ProjectSwitcher from "@/components/dashboard/ProjectSwitcher";
import SimpleHome from "@/components/dashboard/SimpleHome";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { useProject } from "@/contexts/ProjectContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useMetrics } from "@/hooks/useMetrics";
import { useInsights } from "@/hooks/useInsights";
import { Bell, User, RefreshCw, Upload, Zap, ArrowRight, LogOut, ChevronDown, Settings, CreditCard, Users } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithRetry } from "@/lib/edge-function-retry";
import { embedInsightsBatch } from "@/lib/decision-lifecycle";
import { filterCriticalInsights } from "@/lib/insight-filters";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

import WelcomeFlow from "@/components/dashboard/WelcomeFlow";
import DemoBanner from "@/components/dashboard/DemoBanner";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { organizations, currentOrgId, currentOrg, switchOrganization, loading: orgLoading } = useOrganization();
  const { currentWorkspaceId, loading: workspaceLoading } = useWorkspace();
  const { currentProject, activeDatasetId, loading: projectLoading } = useProject();
  const {
    metrics, totalRevenue, totalCustomers, latestCost, latestChurn,
    revenueByMonth, segmentData, hasData, lastUpdated, loading: metricsLoading,
    topMetrics, metricTypes,
  } = useMetrics(currentOrgId, activeDatasetId);
  const { insights, loading: insightsLoading } = useInsights(currentOrgId, activeDatasetId);
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const isDemoUser = Boolean(user?.user_metadata?.is_demo);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [recalculating, setRecalculating] = useState(false);
  const [pendingDecisions, setPendingDecisions] = useState(0);
  const [calibrationScore, setCalibrationScore] = useState<number | null>(null);

  useEffect(() => {
    if (orgLoading || !currentOrgId) return;
    const checkOnboarding = async () => {
      const { data } = await supabase
        .from("organizations")
        .select("onboarding_completed")
        .eq("id", currentOrgId)
        .maybeSingle();
      if (data && !data.onboarding_completed) {
        navigate("/onboarding", { replace: true });
      }
    };
    checkOnboarding();
  }, [currentOrgId, orgLoading, navigate]);

  useEffect(() => {
    if (!currentOrgId) return;
    const fetchCount = async () => {
      if (!activeDatasetId) {
        setPendingDecisions(0);
        return;
      }

      const decisionQuery = supabase
        .from("decision_ledger")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", currentOrgId)
        .eq("execution_status", "not_started");

      const calQuery = supabase
        .from("calibration_models")
        .select("overall_calibration_score")
        .eq("organization_id", currentOrgId)
        .order("computed_at", { ascending: false })
        .limit(1);

      const [decisionRes, calRes] = await Promise.all([decisionQuery, calQuery]);
      setPendingDecisions(decisionRes.count || 0);
      setCalibrationScore(calRes.data?.[0]?.overall_calibration_score ?? null);
    };
    fetchCount();
  }, [currentOrgId, activeDatasetId]);

  const queryClient = useQueryClient();

  const handleRecalculate = async () => {
    if (!currentOrgId || !activeDatasetId) {
      toast({ title: "Select a dataset first", variant: "destructive" });
      return;
    }
    setRecalculating(true);
    try {
      // Full pipeline: Insights → Advisory → Auto-create decisions
      await invokeWithRetry("generate-insights", {
        body: { organization_id: currentOrgId, dataset_id: activeDatasetId },
      });
      embedInsightsBatch(currentOrgId);

      // Auto-generate advisories and convert to pending decisions
      try {
        await invokeWithRetry("prescriptive-advisory", {
          body: { organization_id: currentOrgId, dataset_id: activeDatasetId, role_type: "ceo" },
        });
        await invokeWithRetry("auto-create-decisions", {
          body: { organization_id: currentOrgId, dataset_id: activeDatasetId },
        });
      } catch {
        // Non-blocking: advisory/decision creation is best-effort
        console.warn("[Dashboard] Advisory pipeline step failed");
      }

      toast({ title: "Analysis refreshed" });
      queryClient.invalidateQueries();
    } catch {
      toast({ title: "Refresh failed", variant: "destructive" });
    } finally {
      setRecalculating(false);
    }
  };

  const criticalInsights = filterCriticalInsights(insights);
  const isContextLoading = orgLoading || workspaceLoading || projectLoading;
  const isLoading = isContextLoading || metricsLoading || insightsLoading;
  const isDemoHydrating = isDemoUser && (!currentWorkspaceId || !activeDatasetId);
  const showWelcomeFlow = !isDemoUser && !isContextLoading;
  const showEmptyState = !hasData && !isLoading && !isDemoHydrating;

  useEffect(() => {
    if (isDemoUser && hasData) sessionStorage.removeItem("quantivis_demo_mode");
    if (!isDemoUser) sessionStorage.removeItem("quantivis_demo_mode");
  }, [isDemoUser, hasData]);

  return (
    <>
      {showWelcomeFlow && <WelcomeFlow hasData={hasData} displayName={displayName} />}

      <header className="h-12 border-b border-border/30 flex items-center justify-between px-3 sm:px-6 shrink-0 bg-background/60 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <SidebarMobileToggle />
          <OrgSwitcher organizations={organizations} currentOrg={currentOrg} onSwitch={switchOrganization} />
          <ProjectSwitcher />
        </div>
        <div className="flex items-center gap-1">
          {hasData && (
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${recalculating ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{recalculating ? "Analyzing…" : "Refresh"}</span>
            </button>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <button className="p-2 rounded-lg hover:bg-secondary/60 transition-colors relative" aria-label="Notifications">
                <Bell className="w-4 h-4 text-muted-foreground" />
                {criticalInsights.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
              <div className="p-3 border-b border-border/30">
                <h4 className="text-sm font-semibold">Notifications</h4>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {criticalInsights.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">No active alerts</p>
                ) : (
                  criticalInsights.slice(0, 5).map((insight, i) => (
                    <div key={i} className="px-3 py-2.5 border-b border-border/10 last:border-0 hover:bg-muted/40 transition-colors">
                      <p className="text-xs font-medium truncate">{insight.category || "Alert"}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{insight.message}</p>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 ml-1 pl-2 border-l border-border/30 hover:bg-secondary/40 rounded-lg px-2 py-1 transition-colors">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-primary" />
                </div>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="w-4 h-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/billing")}>
                <CreditCard className="w-4 h-4 mr-2" /> Billing
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/team")}>
                <Users className="w-4 h-4 mr-2" /> Team
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {isDemoUser && hasData && <DemoBanner />}

      <main id="main-content" className="flex-1 p-4 sm:p-6 md:p-8 overflow-auto">
        {(isLoading || isDemoHydrating) && !hasData ? (
          <DashboardSkeleton />
        ) : showEmptyState ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-lg mx-auto mt-16 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Zap className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Get started</h1>
            <p className="text-muted-foreground text-sm mb-8 max-w-sm mx-auto">
              Upload your data or try a demo to start making better decisions.
            </p>
            <div className="space-y-3 text-left">
              <div
                className="flex items-center gap-4 p-4 rounded-xl border border-primary/30 bg-primary/[0.04] hover:bg-primary/[0.06] cursor-pointer transition-all"
                onClick={() => navigate("/demo")}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Try with sample data</p>
                  <p className="text-xs text-muted-foreground">See the full experience instantly</p>
                </div>
                <ArrowRight className="w-4 h-4 text-primary" />
              </div>
              <div
                className="flex items-center gap-4 p-4 rounded-xl border border-border/30 bg-card/40 hover:bg-card/60 cursor-pointer transition-all"
                onClick={() => navigate("/data-upload")}
              >
                <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Upload your data</p>
                  <p className="text-xs text-muted-foreground">Any CSV — financial, operational, or custom</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </motion.div>
        ) : (
          <SectionErrorBoundary sectionName="Dashboard">
            <SimpleHome
              displayName={displayName}
              insights={insights}
              pendingDecisions={pendingDecisions}
              calibrationScore={calibrationScore}
              topMetrics={topMetrics}
              organizationId={currentOrgId!}
            />
          </SectionErrorBoundary>
        )}
      </main>
    </>
  );
};

export default Dashboard;

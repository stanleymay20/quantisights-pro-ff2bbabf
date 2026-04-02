import { useState, useEffect } from "react";
import { SidebarMobileToggle } from "@/components/layout/ProtectedShell";
import OrgSwitcher from "@/components/dashboard/OrgSwitcher";
import ProjectSwitcher from "@/components/dashboard/ProjectSwitcher";
import IntelligenceStatusBar from "@/components/dashboard/IntelligenceStatusBar";
import CommandCenter from "@/components/dashboard/CommandCenter";
import ExecutiveQuickView from "@/components/dashboard/ExecutiveQuickView";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

import { useAuth } from "@/contexts/AuthContext";

import { useOrganization } from "@/hooks/useOrganization";
import { useProject } from "@/contexts/ProjectContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useMetrics } from "@/hooks/useMetrics";
import { useInsights } from "@/hooks/useInsights";
import { Bell, User, RefreshCw, Shield, Upload, Zap, TrendingUp, ArrowRight, Minimize2, Maximize2, Settings, CreditCard, Users, LogOut, ChevronDown } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import GuidedTour from "@/components/dashboard/GuidedTour";
import WelcomeFlow from "@/components/dashboard/WelcomeFlow";
import DemoBanner from "@/components/dashboard/DemoBanner";
import HeroInsight from "@/components/dashboard/HeroInsight";
import DecisionMemoryWidget from "@/components/dashboard/DecisionMemoryWidget";
import SystemHealthDashboard from "@/components/dashboard/SystemHealthDashboard";

const VIEW_STORAGE_KEY = "quantivis_dashboard_view";

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
  const [openAdvisoryCount, setOpenAdvisoryCount] = useState(0);
  const [pendingDecisions, setPendingDecisions] = useState(0);
  const [calibrationScore, setCalibrationScore] = useState<number | null>(null);
  const [dashboardView, setDashboardView] = useState<"executive" | "full">(() => {
    return (localStorage.getItem(VIEW_STORAGE_KEY) as "executive" | "full") || "executive";
  });

  const toggleView = (view: "executive" | "full") => {
    setDashboardView(view);
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  };

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
      let advisoryQuery = supabase
        .from("advisory_instances")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", currentOrgId)
        .in("status", ["open", "in_progress"]);
      if (activeDatasetId) {
        advisoryQuery = advisoryQuery.eq("dataset_id", activeDatasetId);
      } else {
        setOpenAdvisoryCount(0);
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

      const [advisoryRes, decisionRes, calRes] = await Promise.all([advisoryQuery, decisionQuery, calQuery]);
      setOpenAdvisoryCount(advisoryRes.count || 0);
      setPendingDecisions(decisionRes.count || 0);
      setCalibrationScore(calRes.data?.[0]?.overall_calibration_score ?? null);
    };
    fetchCount();
  }, [currentOrgId, activeDatasetId]);

  const handleRecalculate = async () => {
    if (!currentOrgId || !activeDatasetId) {
      toast({ title: "Select a dataset first", variant: "destructive" });
      return;
    }
    setRecalculating(true);
    try {
      await supabase.functions.invoke("generate-insights", {
        body: { organization_id: currentOrgId, dataset_id: activeDatasetId },
      });
      // Embed new insights into institutional memory (non-blocking)
      embedInsightsBatch(currentOrgId);
      toast({ title: "Intelligence refreshed" });
      navigate(0);
    } catch {
      toast({ title: "Refresh failed", variant: "destructive" });
    } finally {
      setRecalculating(false);
    }
  };

  const criticalInsights = insights.filter(i => i.severity === "high" || i.severity === "medium");
  const hasAnomalies = criticalInsights.length > 0;
  const isContextLoading = orgLoading || workspaceLoading || projectLoading;
  const isLoading = isContextLoading || metricsLoading || insightsLoading;
  // Demo users: treat as loading until context fully hydrates to prevent empty-state flash
  const isDemoHydrating = isDemoUser && (!currentWorkspaceId || !activeDatasetId);
  const showWelcomeFlow = !isDemoUser && !isContextLoading;
  const showGuidedTour = !isDemoUser && hasData && !isContextLoading;
  const showEmptyState = !hasData && !isLoading && !isDemoHydrating;

  const demoContextLabel = currentWorkspaceId && currentProject
    ? `${currentProject.name} • ready in active workspace`
    : null;

  useEffect(() => {
    if (isDemoUser && hasData) {
      sessionStorage.removeItem("quantivis_demo_mode");
    }
    if (!isDemoUser) {
      sessionStorage.removeItem("quantivis_demo_mode");
    }
  }, [isDemoUser, hasData]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  /** Data-driven summary: show metric count and types instead of hardcoded SaaS terms */
  const dataDescription = metricTypes.length > 0
    ? `${metricTypes.length} metric type${metricTypes.length > 1 ? "s" : ""} detected across ${metrics.length.toLocaleString()} data points`
    : "Upload verified operational data to enable intelligence. Every insight is derived from your data.";

  return (
    <>
      {showGuidedTour && <GuidedTour />}
      {showWelcomeFlow && <WelcomeFlow hasData={hasData} displayName={displayName} />}
        <IntelligenceStatusBar
          hasData={hasData}
          insights={insights}
          openAdvisories={openAdvisoryCount}
          lastUpdated={lastUpdated}
        />

        <header className="h-11 sm:h-14 border-b border-border/30 flex items-center justify-between px-2 sm:px-4 md:px-8 shrink-0 bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-hidden">
            <SidebarMobileToggle />
            <OrgSwitcher organizations={organizations} currentOrg={currentOrg} onSwitch={switchOrganization} />
            <ProjectSwitcher />
          </div>
          <div className="flex items-center gap-1 md:gap-1.5">
            {hasData && (
              <>
                <button
                  onClick={() => toggleView(dashboardView === "executive" ? "full" : "executive")}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
                  title={dashboardView === "executive" ? "Switch to Full Command Center" : "Switch to Executive View"}
                >
                  {dashboardView === "executive" ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
                  {dashboardView === "executive" ? "Full View" : "Quick View"}
                </button>
                <button
                  onClick={handleRecalculate}
                  disabled={recalculating}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${recalculating ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <button
                  onClick={handleRecalculate}
                  disabled={recalculating}
                  className="sm:hidden p-2 rounded-lg hover:bg-secondary/60 transition-colors disabled:opacity-50"
                  aria-label="Refresh intelligence"
                >
                  <RefreshCw className={`w-4 h-4 text-muted-foreground ${recalculating ? "animate-spin" : ""}`} />
                </button>
               </>
             )}
            <Popover>
              <PopoverTrigger asChild>
                <button className="p-2 rounded-lg hover:bg-secondary/60 transition-colors relative" aria-label="Notifications">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  {hasAnomalies && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
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
                {criticalInsights.length > 0 && (
                  <button onClick={() => navigate("/diagnostics")} className="w-full p-2.5 text-xs text-primary hover:bg-muted/40 border-t border-border/30 transition-colors">
                    View all diagnostics
                  </button>
                )}
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 ml-1 pl-2.5 border-l border-border/30 hover:bg-secondary/40 rounded-lg px-2 py-1 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-[13px] font-medium hidden sm:inline">{displayName}</span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 sm:hidden">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator className="sm:hidden" />
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

        <main id="main-content" className="flex-1 p-3 sm:p-4 md:p-8 overflow-auto">
          {(isLoading || isDemoHydrating) && !hasData ? (
            <DashboardSkeleton />
          ) : showEmptyState ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl mx-auto mt-16"
            >
              <div className="text-center mb-10">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-3xl font-bold font-display mb-3">
                  {greeting()}, {displayName}
                </h1>
                {activeDatasetId ? (
                  <p className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed">
                    Your dataset is loaded. Derived metrics are being processed. Click below to run the intelligence engine.
                  </p>
                ) : (
                  <p className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed">
                    {dataDescription}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {activeDatasetId ? (
                  [
                    { icon: Zap, title: "Run Intelligence Engine", desc: "Generate insights, diagnostics, and strategic recommendations from your dataset", path: null, action: "Run Analysis", onClick: handleRecalculate },
                    { icon: TrendingUp, title: "Strategic advisory activates", desc: "Prescriptive playbooks, scenario modeling, and board reports", path: "/advisory", action: "View Advisory" },
                    { icon: Upload, title: "Upload additional data", desc: "Add more datasets or update existing ones", path: "/data-upload", action: "Upload" },
                  ].map((step, i) => (
                    <motion.div
                      key={step.title}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
                        i === 0
                          ? "border-primary/30 bg-primary/[0.04] hover:bg-primary/[0.06] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 cursor-pointer"
                          : "border-border/30 bg-card/40 hover:bg-card/60 cursor-pointer"
                      }`}
                      onClick={() => step.onClick ? step.onClick() : step.path && navigate(step.path)}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        i === 0 ? "bg-primary/15" : "bg-muted/50"
                      }`}>
                        <step.icon className={`w-5 h-5 ${i === 0 ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{step.title}</p>
                        <p className="text-xs text-muted-foreground">{step.desc}</p>
                      </div>
                      {step.action && (
                        <span className="text-xs font-semibold text-primary flex items-center gap-1">
                          {step.action} <ArrowRight className="w-3 h-3" />
                        </span>
                      )}
                    </motion.div>
                  ))
                ) : (
                  <>
                    {/* Primary: Try with sample data */}
                    <motion.div
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="flex items-center gap-4 p-4 rounded-xl border border-primary/30 bg-primary/[0.04] hover:bg-primary/[0.06] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 cursor-pointer transition-all duration-200"
                      onClick={() => navigate("/demo")}
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-primary/15">
                        <Zap className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">Try with Sample Data</p>
                        <p className="text-xs text-muted-foreground">Load 15 months of B2B SaaS data — insights, diagnostics, and advisories appear instantly</p>
                      </div>
                      <span className="text-xs font-semibold text-primary flex items-center gap-1">
                        Launch Demo <ArrowRight className="w-3 h-3" />
                      </span>
                    </motion.div>

                    <div className="flex items-center gap-3 px-2">
                      <div className="flex-1 h-px bg-border/40" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">or</span>
                      <div className="flex-1 h-px bg-border/40" />
                    </div>

                    {/* Secondary: Upload your own data */}
                    <motion.div
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="flex items-center gap-4 p-4 rounded-xl border border-border/30 bg-card/40 hover:bg-card/60 cursor-pointer transition-all duration-200"
                      onClick={() => navigate("/data-upload")}
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-muted/50">
                        <Upload className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">Upload your own data</p>
                        <p className="text-xs text-muted-foreground">Any structured CSV — financial, operational, academic, or custom metrics</p>
                      </div>
                      <span className="text-xs font-semibold text-primary flex items-center gap-1">
                        Upload <ArrowRight className="w-3 h-3" />
                      </span>
                    </motion.div>

                    {/* Steps preview (grayed out) */}
                    {[
                      { icon: Zap, title: "Autonomous diagnostics engage", desc: "Root cause analysis, anomaly detection, and pattern recognition" },
                      { icon: TrendingUp, title: "Strategic advisory activates", desc: "Prescriptive playbooks, scenario modeling, and board reports" },
                    ].map((step, i) => (
                      <motion.div
                        key={step.title}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + i * 0.1 }}
                        className="flex items-center gap-4 p-4 rounded-xl border border-border/30 bg-card/20 opacity-50"
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-muted/50">
                          <step.icon className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{step.title}</p>
                          <p className="text-xs text-muted-foreground">{step.desc}</p>
                        </div>
                        <span className="w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                          {i + 2}
                        </span>
                      </motion.div>
                    ))}
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 sm:mb-6 max-w-[1400px]"
              >
                <h1 className="text-lg sm:text-2xl font-bold font-display tracking-tight">
                  {greeting()}, {displayName.split(" ")[0]}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  {isDemoUser
                    ? `${criticalInsights.length} signal${criticalInsights.length !== 1 ? "s" : ""} · calibration active · memory recording`
                    : hasAnomalies
                      ? `${criticalInsights.length} signal${criticalInsights.length > 1 ? "s" : ""} require attention`
                      : `${dataDescription}`
                  }
                </p>
              </motion.div>

              {hasAnomalies && <HeroInsight insights={insights} />}
              {currentOrgId && <DecisionMemoryWidget organizationId={currentOrgId} />}
              {currentOrgId && <SystemHealthDashboard orgId={currentOrgId} />}

              {dashboardView === "executive" ? (
                <ExecutiveQuickView
                  organizationId={currentOrgId!}
                  pendingDecisions={pendingDecisions}
                  calibrationScore={calibrationScore}
                  criticalSignals={criticalInsights.length}
                  topMetrics={topMetrics}
                  insights={insights}
                  onExpandToFull={() => toggleView("full")}
                />
              ) : (
                <CommandCenter
                  organizationId={currentOrgId!}
                  insights={insights}
                  hasData={hasData}
                  churnRate={latestChurn}
                  revenue={totalRevenue}
                  totalCustomers={totalCustomers}
                  latestCost={latestCost}
                  pendingDecisions={pendingDecisions}
                  calibrationScore={calibrationScore}
                  metrics={metrics}
                  revenueByMonth={revenueByMonth}
                  segmentData={segmentData}
                  onDecisionLogged={() => setPendingDecisions(p => p + 1)}
                  topMetrics={topMetrics}
                  datasetId={activeDatasetId ?? undefined}
                  datasetName={currentProject?.name}
                  isDemoMode={isDemoUser}
                />
              )}
            </>
          )}
        </main>
    </>
  );
};

export default Dashboard;

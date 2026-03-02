import { lazy, Suspense } from "react";
import DashboardSidebar, { SidebarMobileToggle } from "@/components/dashboard/DashboardSidebar";
import KPICards from "@/components/dashboard/KPICards";
import OrgSwitcher from "@/components/dashboard/OrgSwitcher";
import IntelligenceStatusBar from "@/components/dashboard/IntelligenceStatusBar";
import DailyActions from "@/components/dashboard/DailyActions";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

// Lazy-load heavy chart components (recharts is ~200KB)
const RevenueChart = lazy(() => import("@/components/dashboard/RevenueChart"));
const CustomerSegmentation = lazy(() => import("@/components/dashboard/CustomerSegmentation"));
const AIInsights = lazy(() => import("@/components/dashboard/AIInsights"));
const AnomalyDetection = lazy(() => import("@/components/dashboard/AnomalyDetection"));
const WaterfallChart = lazy(() => import("@/components/dashboard/WaterfallChart"));
const CohortAnalysis = lazy(() => import("@/components/dashboard/CohortAnalysis"));
const FunnelChart = lazy(() => import("@/components/dashboard/FunnelChart"));
const PeriodComparison = lazy(() => import("@/components/dashboard/PeriodComparison"));
const HeatmapChart = lazy(() => import("@/components/dashboard/HeatmapChart"));
const TreemapChart = lazy(() => import("@/components/dashboard/TreemapChart"));
const ScatterBubbleChart = lazy(() => import("@/components/dashboard/ScatterBubbleChart"));
const RadarChartComponent = lazy(() => import("@/components/dashboard/RadarChart"));
const GaugeChart = lazy(() => import("@/components/dashboard/GaugeChart"));
const SankeyChart = lazy(() => import("@/components/dashboard/SankeyChart"));
const BoxPlotChart = lazy(() => import("@/components/dashboard/BoxPlotChart"));
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { useMetrics } from "@/hooks/useMetrics";
import { useInsights } from "@/hooks/useInsights";
import { Bell, User, Upload, RefreshCw, ArrowRight, Shield, Zap, TrendingUp } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const Dashboard = () => {
  const { user } = useAuth();
  const { organizations, currentOrgId, currentOrg, switchOrganization, loading: orgLoading } = useOrganization();
  const { metrics, totalRevenue, totalCustomers, latestCost, latestChurn, revenueByMonth, segmentData, hasData, lastUpdated, loading: metricsLoading } = useMetrics(currentOrgId);
  const { insights, loading: insightsLoading } = useInsights(currentOrgId);
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const { toast } = useToast();
  const navigate = useNavigate();
  const [recalculating, setRecalculating] = useState(false);
  const [openAdvisoryCount, setOpenAdvisoryCount] = useState(0);

  useEffect(() => {
    if (orgLoading || !currentOrgId) return;
    const checkOnboarding = async () => {
      const { data } = await supabase
        .from("organizations")
        .select("onboarding_completed")
        .eq("id", currentOrgId)
        .single();
      if (data && !data.onboarding_completed) {
        navigate("/onboarding", { replace: true });
      }
    };
    checkOnboarding();
  }, [currentOrgId, orgLoading, navigate]);

  // Fetch open advisory count
  useEffect(() => {
    if (!currentOrgId) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("advisory_instances")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", currentOrgId)
        .in("status", ["open", "in_progress"]);
      setOpenAdvisoryCount(count || 0);
    };
    fetchCount();
  }, [currentOrgId]);

  const handleRecalculate = async () => {
    if (!currentOrgId) return;
    setRecalculating(true);
    try {
      await supabase.functions.invoke("generate-insights", {
        body: { organization_id: currentOrgId },
      });
      toast({ title: "Intelligence refreshed" });
      // Controlled refresh via navigation instead of full page reload
      navigate(0);
    } catch {
      toast({ title: "Refresh failed", variant: "destructive" });
    } finally {
      setRecalculating(false);
    }
  };

  const criticalInsights = insights.filter(i => i.severity === "high" || i.severity === "medium");
  const hasAnomalies = criticalInsights.length > 0;
  const isLoading = metricsLoading || insightsLoading;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Global Intelligence Status Bar */}
        <IntelligenceStatusBar
          hasData={hasData}
          insights={insights}
          openAdvisories={openAdvisoryCount}
          lastUpdated={lastUpdated}
        />

        {/* Header */}
        <header className="h-14 border-b border-border/30 flex items-center justify-between px-4 md:px-8 shrink-0 bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 min-w-0">
            <SidebarMobileToggle />
            <OrgSwitcher organizations={organizations} currentOrg={currentOrg} onSwitch={switchOrganization} />
          </div>
          <div className="flex items-center gap-1 md:gap-1.5">
            {hasData && (
              <button
                onClick={handleRecalculate}
                disabled={recalculating}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${recalculating ? "animate-spin" : ""}`} />
                Refresh
              </button>
            )}
            {hasData && (
              <button
                onClick={handleRecalculate}
                disabled={recalculating}
                className="sm:hidden p-2 rounded-lg hover:bg-secondary/60 transition-colors disabled:opacity-50"
                aria-label="Refresh intelligence"
              >
                <RefreshCw className={`w-4 h-4 text-muted-foreground ${recalculating ? "animate-spin" : ""}`} />
              </button>
            )}
            <button className="p-2 rounded-lg hover:bg-secondary/60 transition-colors relative" aria-label="Notifications">
              <Bell className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              {hasAnomalies && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-destructive" />
              )}
            </button>
            <div className="hidden sm:flex items-center gap-2 ml-1 pl-2.5 border-l border-border/30">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-[13px] font-medium">{displayName}</span>
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 p-4 md:p-8 overflow-auto">
          {!hasData && !isLoading ? (
            /* ── Smart Empty State ── */
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
                <p className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed">
                  Upload verified operational data to enable intelligence. No synthetic metrics — every insight is derived from your data.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { icon: Upload, title: "Upload verified data", desc: "Revenue, cost, customer, and churn metrics via CSV or API", path: "/data-upload", action: "Upload Data" },
                  { icon: Zap, title: "Autonomous diagnostics engage", desc: "Root cause analysis, anomaly detection, and risk scoring", path: null, action: null },
                  { icon: TrendingUp, title: "Strategic advisory activates", desc: "Prescriptive playbooks, scenario modeling, and board reports", path: null, action: null },
                ].map((step, i) => (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
                      i === 0
                        ? "border-primary/30 bg-primary/[0.04] hover:bg-primary/[0.06] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 cursor-pointer"
                        : "border-border/30 bg-card/20 opacity-50"
                    }`}
                    onClick={() => step.path && navigate(step.path)}
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
                    <span className="w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                      {i + 1}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : isLoading ? (
            /* ── Skeleton Loading ── */
            <DashboardSkeleton />
          ) : (
            /* ── Command Center ── */
            <div className="space-y-6 max-w-[1400px]">
              {/* Greeting */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h1 className="text-2xl font-bold font-display tracking-tight">
                  {greeting()}, {displayName}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {hasAnomalies
                    ? `${criticalInsights.length} signal${criticalInsights.length > 1 ? "s" : ""} require attention`
                    : "All systems nominal — no action required"
                  }
                </p>
              </motion.div>

              {/* Priority Actions Today */}
              <DailyActions
                insights={insights}
                hasData={hasData}
                churnRate={latestChurn}
                revenue={totalRevenue}
              />

              {/* Contextual Nudge */}
              {hasAnomalies && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="nudge-card flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Zap className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm truncate">
                      <span className="font-semibold">Signal detected</span>
                      <span className="text-muted-foreground"> — {criticalInsights[0]?.message?.slice(0, 80)}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Link to="/diagnostics" className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                      Dismiss
                    </Link>
                    <Link to="/advisory" className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1">
                      Investigate <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </motion.div>
              )}

              {/* KPIs */}
              <KPICards
                revenue={totalRevenue}
                customers={totalCustomers}
                costRate={latestCost}
                churnRate={latestChurn}
              />

              {/* Charts — lazy loaded for faster initial paint */}
              <Suspense fallback={<div className="grid lg:grid-cols-3 gap-5">{Array.from({length: 3}).map((_, i) => <div key={i} className="h-64 rounded-xl bg-muted/30 animate-pulse" />)}</div>}>
                {/* Charts Row 1 */}
                <div className="grid lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-2">
                    <RevenueChart data={revenueByMonth} />
                  </div>
                  <CustomerSegmentation data={segmentData} />
                </div>

                {/* Charts Row 2 */}
                <div className="grid lg:grid-cols-3 gap-5">
                  <WaterfallChart data={metrics} />
                  <FunnelChart metrics={metrics} />
                  <PeriodComparison data={revenueByMonth} />
                </div>

                <CohortAnalysis metrics={metrics} />

                {/* Enterprise Visualizations Row 3 */}
                <div className="grid lg:grid-cols-3 gap-5">
                  <HeatmapChart metrics={metrics} />
                  <TreemapChart metrics={metrics} />
                  <RadarChartComponent metrics={metrics} />
                </div>

                {/* Enterprise Visualizations Row 4 */}
                <div className="grid lg:grid-cols-3 gap-5">
                  <ScatterBubbleChart metrics={metrics} />
                  <SankeyChart metrics={metrics} />
                  <BoxPlotChart metrics={metrics} />
                </div>

                {/* Gauge Row */}
                <div className="grid lg:grid-cols-3 gap-5">
                  <GaugeChart
                    value={latestChurn > 0 ? Math.max(0, 100 - latestChurn * 100) : 85}
                    label="Retention Health"
                  />
                  <GaugeChart
                    value={latestCost > 0 ? Math.max(0, 100 - latestCost * 100) : 70}
                    label="Cost Efficiency"
                  />
                  <GaugeChart
                    value={revenueByMonth.length >= 2
                      ? Math.min(100, Math.max(0, ((revenueByMonth[revenueByMonth.length - 1]?.revenue ?? 0) / (revenueByMonth[0]?.revenue || 1) - 1) * 100 + 50))
                      : 50}
                    label="Growth Momentum"
                  />
                </div>

                {/* Intelligence Row */}
                <div className="grid lg:grid-cols-3 gap-5">
                  <AIInsights insights={insights} />
                  <AnomalyDetection insights={insights} />
                  <div className="glass-card p-6 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Historical Growth</h3>
                      <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-6">Period-over-period change</p>
                    <div className="text-center py-4">
                      <p className="text-4xl font-bold font-display gradient-text">
                        {revenueByMonth.length >= 2
                          ? `${(((revenueByMonth[revenueByMonth.length - 1]?.revenue ?? 0) / (revenueByMonth[0]?.revenue || 1) - 1) * 100).toFixed(1)}%`
                          : "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-3">Growth over data period</p>
                    </div>
                  </div>
                </div>
              </Suspense>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;

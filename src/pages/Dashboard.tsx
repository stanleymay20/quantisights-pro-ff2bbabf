import { useState, useEffect } from "react";
import { SidebarMobileToggle } from "@/components/layout/ProtectedShell";
import OrgSwitcher from "@/components/dashboard/OrgSwitcher";
import ProjectSwitcher from "@/components/dashboard/ProjectSwitcher";
import IntelligenceStatusBar from "@/components/dashboard/IntelligenceStatusBar";
import CommandCenter from "@/components/dashboard/CommandCenter";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { useProject } from "@/contexts/ProjectContext";
import { useMetrics } from "@/hooks/useMetrics";
import { useInsights } from "@/hooks/useInsights";
import { Bell, User, RefreshCw, Shield, Upload, Zap, TrendingUp, ArrowRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import GuidedTour from "@/components/dashboard/GuidedTour";

const Dashboard = () => {
  const { user } = useAuth();
  const { organizations, currentOrgId, currentOrg, switchOrganization, loading: orgLoading } = useOrganization();
  const { currentProject, activeDatasetId } = useProject();
  const { metrics, totalRevenue, totalCustomers, latestCost, latestChurn, revenueByMonth, segmentData, hasData, lastUpdated, loading: metricsLoading } = useMetrics(currentOrgId, activeDatasetId);
  const { insights, loading: insightsLoading } = useInsights(currentOrgId, activeDatasetId);
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [recalculating, setRecalculating] = useState(false);
  const [openAdvisoryCount, setOpenAdvisoryCount] = useState(0);
  const [pendingDecisions, setPendingDecisions] = useState(0);
  const [calibrationScore, setCalibrationScore] = useState<number | null>(null);

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

  useEffect(() => {
    if (location.pathname === "/dashboard" && !hasData && !metricsLoading) {
      navigate("/portfolio", { replace: true });
    }
  }, [location.pathname, hasData, metricsLoading, navigate]);

  useEffect(() => {
    if (!currentOrgId) return;
    const fetchCount = async () => {
      const [advisoryRes, decisionRes, calRes] = await Promise.all([
        supabase
          .from("advisory_instances")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", currentOrgId)
          .in("status", ["open", "in_progress"]),
        supabase
          .from("decision_ledger")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", currentOrgId)
          .eq("execution_status", "not_started"),
        supabase
          .from("calibration_models")
          .select("overall_calibration_score")
          .eq("organization_id", currentOrgId)
          .order("computed_at", { ascending: false })
          .limit(1),
      ]);
      setOpenAdvisoryCount(advisoryRes.count || 0);
      setPendingDecisions(decisionRes.count || 0);
      setCalibrationScore(calRes.data?.[0]?.overall_calibration_score ?? null);
    };
    fetchCount();
  }, [currentOrgId]);

  const handleRecalculate = async () => {
    if (!currentOrgId) return;
    setRecalculating(true);
    try {
      await supabase.functions.invoke("generate-insights", {
        body: { organization_id: currentOrgId, dataset_id: activeDatasetId },
      });
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
  const isLoading = metricsLoading || insightsLoading;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <>
      {hasData && <GuidedTour />}
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
            <ProjectSwitcher />
          </div>
          <div className="flex items-center gap-1 md:gap-1.5">
            {hasData && (
              <>
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
            <button className="p-2 rounded-lg hover:bg-secondary/60 transition-colors relative" aria-label="Notifications">
              <Bell className="w-4 h-4 text-muted-foreground" />
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

        <main id="main-content" className="flex-1 p-3 sm:p-4 md:p-8 overflow-auto">
          {!hasData && !isLoading ? (
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
            <DashboardSkeleton />
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 max-w-[1400px]"
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
              />
            </>
          )}
        </main>
    </>
  );
};

export default Dashboard;

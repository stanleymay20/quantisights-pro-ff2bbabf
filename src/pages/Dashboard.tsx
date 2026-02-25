import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import KPICards from "@/components/dashboard/KPICards";
import RevenueChart from "@/components/dashboard/RevenueChart";
import CustomerSegmentation from "@/components/dashboard/CustomerSegmentation";
import AIInsights from "@/components/dashboard/AIInsights";
import AnomalyDetection from "@/components/dashboard/AnomalyDetection";
import OrgSwitcher from "@/components/dashboard/OrgSwitcher";
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
  const { totalRevenue, totalCustomers, latestCost, latestChurn, revenueByMonth, segmentData, hasData, loading: metricsLoading } = useMetrics(currentOrgId);
  const { insights, loading: insightsLoading } = useInsights(currentOrgId);
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const { toast } = useToast();
  const navigate = useNavigate();
  const [recalculating, setRecalculating] = useState(false);

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

  const handleRecalculate = async () => {
    if (!currentOrgId) return;
    setRecalculating(true);
    try {
      await supabase.functions.invoke("generate-insights", {
        body: { organization_id: currentOrgId },
      });
      toast({ title: "Insights recalculated" });
      window.location.reload();
    } catch {
      toast({ title: "Failed to recalculate", variant: "destructive" });
    } finally {
      setRecalculating(false);
    }
  };

  const criticalInsights = insights.filter(i => i.severity === "high" || i.severity === "medium");
  const hasAnomalies = criticalInsights.length > 0;

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
        {/* Header */}
        <header className="h-16 border-b border-border/50 flex items-center justify-between px-8 shrink-0 backdrop-blur-sm bg-background/80">
          <div className="flex items-center gap-4">
            <OrgSwitcher organizations={organizations} currentOrg={currentOrg} onSwitch={switchOrganization} />
          </div>
          <div className="flex items-center gap-2">
            {hasData && (
              <button
                onClick={handleRecalculate}
                disabled={recalculating}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? "animate-spin" : ""}`} />
                Refresh
              </button>
            )}
            <button className="p-2 rounded-lg hover:bg-secondary transition-colors relative">
              <Bell className="w-4.5 h-4.5 text-muted-foreground" />
              {hasAnomalies && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
              )}
            </button>
            <div className="flex items-center gap-2.5 ml-1 pl-3 border-l border-border/50">
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium">{displayName}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-auto">
          {!hasData && !metricsLoading ? (
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
                  Upload revenue, cost, and customer data to activate your strategic intelligence engine.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { icon: Upload, title: "Upload your data", desc: "CSV with revenue, cost, customer, and churn metrics", path: "/data-upload", action: "Upload CSV" },
                  { icon: Zap, title: "AI generates diagnostics", desc: "Root cause analysis, anomaly detection, and risk scoring", path: null, action: null },
                  { icon: TrendingUp, title: "Strategic advisory activates", desc: "Prescriptive recommendations, scenarios, and board reports", path: null, action: null },
                ].map((step, i) => (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                      i === 0 ? "border-primary/30 bg-primary/[0.04] hover:bg-primary/[0.08] cursor-pointer" : "border-border/50 bg-card/30 opacity-60"
                    }`}
                    onClick={() => step.path && navigate(step.path)}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      i === 0 ? "bg-primary/15" : "bg-muted"
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
                    <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                      {i + 1}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : (
            /* ── Command Center ── */
            <div className="space-y-6 max-w-[1400px]">
              {/* Greeting + Context Bar */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-end justify-between"
              >
                <div>
                  <h1 className="text-2xl font-bold font-display tracking-tight">
                    {greeting()}, {displayName}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {hasAnomalies
                      ? `${criticalInsights.length} signal${criticalInsights.length > 1 ? "s" : ""} require attention`
                      : "All systems nominal"
                    }
                  </p>
                </div>
                {hasAnomalies && (
                  <Link
                    to="/diagnostics"
                    className="flex items-center gap-2 text-xs font-semibold text-destructive hover:text-destructive/80 transition-colors"
                  >
                    View diagnostics <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </motion.div>

              {/* Contextual Nudge */}
              {hasAnomalies && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="nudge-card flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-sm">
                      <span className="font-semibold">Anomaly detected</span>
                      <span className="text-muted-foreground"> — {criticalInsights[0]?.message?.slice(0, 80)}...</span>
                    </span>
                  </div>
                  <Link to="/advisory" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                    Open playbook <ArrowRight className="w-3 h-3" />
                  </Link>
                </motion.div>
              )}

              {/* KPIs */}
              <KPICards
                revenue={totalRevenue}
                customers={totalCustomers}
                costRate={latestCost}
                churnRate={latestChurn}
              />

              {/* Charts */}
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <RevenueChart data={revenueByMonth} />
                </div>
                <CustomerSegmentation data={segmentData} />
              </div>

              {/* Intelligence Row */}
              <div className="grid lg:grid-cols-3 gap-6">
                <AIInsights insights={insights} />
                <AnomalyDetection insights={insights} />
                <div className="glass-card p-6 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold font-display uppercase tracking-wide text-muted-foreground">Forecast</h3>
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mb-6">Revenue trajectory</p>
                  <div className="text-center py-4">
                    <p className="text-4xl font-bold font-display gradient-text">
                      {revenueByMonth.length >= 2
                        ? `${(((revenueByMonth[revenueByMonth.length - 1]?.revenue ?? 0) / (revenueByMonth[0]?.revenue || 1) - 1) * 100).toFixed(1)}%`
                        : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-3">Growth over data period</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;

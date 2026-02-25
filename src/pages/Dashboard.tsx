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
import { Bell, User, Upload, RefreshCw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const Dashboard = () => {
  const { user } = useAuth();
  const { organizations, currentOrgId, currentOrg, switchOrganization, loading: orgLoading } = useOrganization();
  const { totalRevenue, totalCustomers, latestCost, latestChurn, revenueByMonth, segmentData, hasData, loading: metricsLoading } = useMetrics(currentOrgId);
  const { insights, loading: insightsLoading } = useInsights(currentOrgId);
  const displayName = user?.user_metadata?.full_name || user?.email || "User";
  const { toast } = useToast();
  const navigate = useNavigate();
  const [recalculating, setRecalculating] = useState(false);

  // Auto-redirect to onboarding if org hasn't completed it
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
      toast({ title: "Insights recalculated!" });
      window.location.reload();
    } catch {
      toast({ title: "Failed to recalculate", variant: "destructive" });
    } finally {
      setRecalculating(false);
    }
  };
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b border-border flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold font-display">Dashboard</h1>
            <OrgSwitcher organizations={organizations} currentOrg={currentOrg} onSwitch={switchOrganization} />
          </div>
          <div className="flex items-center gap-3">
            {hasData && (
              <button
                onClick={handleRecalculate}
                disabled={recalculating}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? "animate-spin" : ""}`} />
                Recalculate Insights
              </button>
            )}
            <button className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <Bell className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{displayName}</span>
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-auto space-y-6">
          {!hasData && !metricsLoading ? (
            <div className="glass-card p-12 rounded-xl flex flex-col items-center justify-center min-h-[400px]">
              <Upload className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold font-display mb-2">No Data Yet</h2>
              <p className="text-muted-foreground text-sm mb-6">Upload a CSV file to populate your dashboard</p>
              <Link
                to="/data-upload"
                className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all"
              >
                Upload Data
              </Link>
            </div>
          ) : (
            <>
              <KPICards
                revenue={totalRevenue}
                customers={totalCustomers}
                costRate={latestCost}
                churnRate={latestChurn}
              />
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <RevenueChart data={revenueByMonth} />
                </div>
                <CustomerSegmentation data={segmentData} />
              </div>
              <div className="grid lg:grid-cols-3 gap-6">
                <AIInsights insights={insights} />
                <AnomalyDetection insights={insights} />
                <div className="glass-card p-6 rounded-xl">
                  <h3 className="text-lg font-semibold font-display mb-1">Predictive Forecasting</h3>
                  <p className="text-xs text-muted-foreground mb-4">Revenue sentiment</p>
                  <div className="text-center py-8">
                    <p className="text-4xl font-bold font-display gradient-text">
                      {revenueByMonth.length >= 2
                        ? `${(((revenueByMonth[revenueByMonth.length - 1]?.revenue ?? 0) / (revenueByMonth[0]?.revenue || 1) - 1) * 100).toFixed(1)}%`
                        : "—"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">Growth over data period</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;

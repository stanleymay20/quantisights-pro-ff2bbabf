import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { useProject } from "@/contexts/ProjectContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useMetrics } from "@/hooks/useMetrics";
import { useInsights } from "@/hooks/useInsights";
import { filterCriticalInsights } from "@/lib/insight-filters";
import { supabase } from "@/integrations/supabase/client";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import SimpleHome from "@/components/dashboard/SimpleHome";
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
  const navigate = useNavigate();

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const isDemoUser = Boolean(user?.user_metadata?.is_demo);

  const [pendingDecisions, setPendingDecisions] = useState(0);
  const [calibrationScore, setCalibrationScore] = useState<number | null>(null);

  // Onboarding redirect — cached in sessionStorage to avoid repeated DB hits
  useEffect(() => {
    if (orgLoading || !currentOrgId) return;
    const cacheKey = `onboarding_checked_${currentOrgId}`;
    if (sessionStorage.getItem(cacheKey) === "done") return;

    const checkOnboarding = async () => {
      const { data } = await supabase
        .from("organizations")
        .select("onboarding_completed")
        .eq("id", currentOrgId)
        .maybeSingle();
      if (data && !data.onboarding_completed) {
        navigate("/onboarding", { replace: true });
      } else {
        sessionStorage.setItem(cacheKey, "done");
      }
    };
    checkOnboarding();
  }, [currentOrgId, orgLoading, navigate]);

  // Fetch pending decisions & calibration — parallel, lightweight queries
  useEffect(() => {
    if (!currentOrgId) return;
    const fetchCount = async () => {
      if (!activeDatasetId) {
        setPendingDecisions(0);
        return;
      }
      const [decisionRes, calRes] = await Promise.all([
        supabase.from("decision_ledger")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", currentOrgId)
          .eq("execution_status", "not_started"),
        supabase.from("calibration_models")
          .select("overall_calibration_score")
          .eq("organization_id", currentOrgId)
          .order("computed_at", { ascending: false })
          .limit(1),
      ]);
      setPendingDecisions(decisionRes.count || 0);
      setCalibrationScore(calRes.data?.[0]?.overall_calibration_score ?? null);
    };
    fetchCount();
  }, [currentOrgId, activeDatasetId]);

  // Memoize expensive insight filtering
  const criticalInsights = useMemo(() => filterCriticalInsights(insights), [insights]);

  const isContextLoading = orgLoading || workspaceLoading || projectLoading;
  const isLoading = isContextLoading || metricsLoading || insightsLoading;
  const isDemoHydrating = isDemoUser && (!currentWorkspaceId || !activeDatasetId);
  const showWelcomeFlow = !isDemoUser && !isContextLoading;
  const showEmptyState = !hasData && !isLoading && !isDemoHydrating;

  // Demo session cleanup
  useEffect(() => {
    if (isDemoUser && hasData) sessionStorage.removeItem("quantivis_demo_mode");
    if (!isDemoUser) sessionStorage.removeItem("quantivis_demo_mode");
  }, [isDemoUser, hasData]);

  return (
    <>
      {showWelcomeFlow && <WelcomeFlow hasData={hasData} displayName={displayName} />}

      <DashboardHeader
        organizations={organizations}
        currentOrg={currentOrg}
        switchOrganization={switchOrganization}
        displayName={displayName}
        email={user?.email}
        hasData={hasData}
        criticalInsights={criticalInsights}
        currentOrgId={currentOrgId}
        activeDatasetId={activeDatasetId}
        onSignOut={signOut}
      />

      {isDemoUser && hasData && <DemoBanner />}

      <main id="main-content" className="flex-1 p-4 sm:p-6 md:p-8 overflow-auto">
        {(isLoading || isDemoHydrating) && !hasData ? (
          <DashboardSkeleton />
        ) : showEmptyState ? (
          <DashboardEmptyState />
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

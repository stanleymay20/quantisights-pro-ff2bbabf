import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface QuotaLimits {
  max_datasets: number;
  max_rows_per_day: number;
  max_api_calls_per_day: number;
  max_simulations_per_day: number;
  max_copilot_queries_per_day: number;
  max_team_seats: number;
}

interface QuotaCheck {
  current_usage: number;
  quota_limit: number;
  allowed: boolean;
  remaining: number;
}

const DEFAULT_LIMITS: QuotaLimits = {
  max_datasets: 1,
  max_rows_per_day: 50000,
  max_api_calls_per_day: 100,
  max_simulations_per_day: 5,
  max_copilot_queries_per_day: 0,
  max_team_seats: 2,
};

export const useWorkspaceQuota = () => {
  const { currentWorkspaceId } = useWorkspace();
  const [limits, setLimits] = useState<QuotaLimits>(DEFAULT_LIMITS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspaceId) {
      setLimits(DEFAULT_LIMITS);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase
        .from("workspace_quotas")
        .select("*")
        .eq("workspace_id", currentWorkspaceId)
        .maybeSingle();

      if (data) {
        setLimits({
          max_datasets: data.max_datasets,
          max_rows_per_day: data.max_rows_per_day,
          max_api_calls_per_day: data.max_api_calls_per_day,
          max_simulations_per_day: data.max_simulations_per_day,
          max_copilot_queries_per_day: data.max_copilot_queries_per_day,
          max_team_seats: data.max_team_seats,
        });
      }
      setLoading(false);
    };

    fetch();
  }, [currentWorkspaceId]);

  const checkQuota = useCallback(async (metricName: string): Promise<QuotaCheck> => {
    if (!currentWorkspaceId) {
      return { current_usage: 0, quota_limit: 0, allowed: false, remaining: 0 };
    }

    const { data, error } = await supabase.rpc("check_workspace_quota", {
      _workspace_id: currentWorkspaceId,
      _metric_name: metricName,
    });

    if (error || !data) {
      return { current_usage: 0, quota_limit: 999999, allowed: true, remaining: 999999 };
    }

    return data as unknown as QuotaCheck;
  }, [currentWorkspaceId]);

  const incrementUsage = useCallback(async (metricName: string, increment: number = 1) => {
    if (!currentWorkspaceId) return;

    // Get org_id from workspace
    const { data: ws } = await supabase
      .from("workspaces")
      .select("organization_id")
      .eq("id", currentWorkspaceId)
      .single();

    if (!ws) return;

    await supabase.rpc("increment_workspace_usage", {
      _workspace_id: currentWorkspaceId,
      _org_id: ws.organization_id,
      _metric_name: metricName,
      _increment: increment,
    });
  }, [currentWorkspaceId]);

  return { limits, loading, checkQuota, incrementUsage };
};

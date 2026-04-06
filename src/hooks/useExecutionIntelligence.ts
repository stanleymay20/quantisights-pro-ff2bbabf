import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { getVerifiedAuth, authHeaders } from "@/lib/auth-helpers";
import { invokeWithRetry } from "@/lib/edge-function-retry";

export interface ExecutionScore {
  id: string;
  organization_id: string;
  scope_type: string;
  scope_id: string;
  score: number;
  reliability_rate: number;
  avg_delay_days: number;
  success_rate: number;
  failure_rate: number;
  plans_evaluated: number;
  computed_at: string;
}

export interface ExecutionPrediction {
  id: string;
  execution_plan_id: string;
  risk_score: number;
  predicted_outcome: string;
  delay_days_predicted: number;
  risk_factors: Array<{ factor: string; weight: number }>;
  recommendation: string;
  execution_plans?: {
    action_title: string;
    status: string;
    priority: string;
    deadline: string | null;
    owner_user_id: string | null;
  };
}

export interface ExecutionIntervention {
  id: string;
  execution_plan_id: string;
  intervention_type: string;
  trigger_reason: string;
  corrective_action: string | null;
  auto_triggered: boolean;
  resolved: boolean;
  created_at: string;
  execution_plans?: {
    action_title: string;
    status: string;
    priority: string;
    deadline: string | null;
  };
}

export interface CommandSummary {
  org_score: ExecutionScore | null;
  at_risk_plans: number;
  open_interventions: number;
  critical_active: number;
  total_active: number;
  multi_plan_decisions: Array<{ decision_id: string; plan_count: number }>;
  risk_distribution: {
    likely_failure: number;
    at_risk: number;
    delayed: number;
    on_track: number;
  };
}

export const useExecutionIntelligence = (organizationId: string | null) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState<ExecutionScore[]>([]);
  const [predictions, setPredictions] = useState<ExecutionPrediction[]>([]);
  const [interventions, setInterventions] = useState<ExecutionIntervention[]>([]);
  const [commandSummary, setCommandSummary] = useState<CommandSummary | null>(null);

  const invoke = useCallback(async <T>(actionName: string, extra: Record<string, unknown> = {}): Promise<T | null> => {
    if (!organizationId) return null;
    const auth = await getVerifiedAuth();
    if (!auth) return null;
    const { data, error } = await invokeWithRetry<T>("execution-intelligence", {
      body: { action: actionName, organization_id: organizationId, ...extra },
      headers: authHeaders(auth),
    });
    if (error) throw error;
    return data;
  }, [organizationId]);

  const scanInterventions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<{ interventions_created: number; scanned: number }>("scan_interventions");
      if (result && result.interventions_created > 0) {
        toast({ title: `${result.interventions_created} intervention(s) created` });
      }
      return result;
    } catch (e) {
      console.error("Scan interventions failed:", e);
    } finally {
      setLoading(false);
    }
  }, [invoke, toast]);

  const fetchInterventions = useCallback(async () => {
    try {
      const data = await invoke<ExecutionIntervention[]>("get_interventions");
      setInterventions(data || []);
    } catch (e) {
      console.error("Fetch interventions failed:", e);
    }
  }, [invoke]);

  const resolveIntervention = useCallback(async (interventionId: string) => {
    try {
      await invoke("resolve_intervention", { intervention_id: interventionId });
      toast({ title: "Intervention resolved" });
      await fetchInterventions();
    } catch (e) {
      toast({ title: "Failed to resolve", variant: "destructive" });
    }
  }, [invoke, toast, fetchInterventions]);

  const computeScores = useCallback(async () => {
    setLoading(true);
    try {
      await invoke("compute_scores");
      toast({ title: "Execution scores computed" });
      await fetchScores();
    } catch (e) {
      console.error("Compute scores failed:", e);
    } finally {
      setLoading(false);
    }
  }, [invoke, toast]);

  const fetchScores = useCallback(async (scopeType?: string, includeHistory = false) => {
    try {
      const data = await invoke<ExecutionScore[]>("get_scores", {
        ...(scopeType ? { scope_type: scopeType } : {}),
        include_history: includeHistory,
      });
      setScores(data || []);
    } catch (e) {
      console.error("Fetch scores failed:", e);
    }
  }, [invoke]);

  const fetchScoreTrend = useCallback(async (scopeType: string, scopeId: string, limit = 30) => {
    try {
      return await invoke<Array<{
        score: number;
        success_rate: number;
        failure_rate: number;
        avg_delay_days: number;
        plans_evaluated: number;
        computed_at: string;
      }>>("get_score_trend", { scope_type: scopeType, scope_id: scopeId, limit });
    } catch (e) {
      console.error("Fetch score trend failed:", e);
      return null;
    }
  }, [invoke]);

  const predictRisks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<{ predictions: ExecutionPrediction[]; total: number }>("predict_risks");
      toast({ title: `Risk analysis complete: ${result?.total || 0} plans assessed` });
      await fetchPredictions();
      return result;
    } catch (e) {
      console.error("Predict risks failed:", e);
    } finally {
      setLoading(false);
    }
  }, [invoke, toast]);

  const fetchPredictions = useCallback(async () => {
    try {
      const data = await invoke<ExecutionPrediction[]>("get_predictions");
      setPredictions(data || []);
    } catch (e) {
      console.error("Fetch predictions failed:", e);
    }
  }, [invoke]);

  const fetchCommandSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<CommandSummary>("command_summary");
      setCommandSummary(data);
    } catch (e) {
      console.error("Fetch command summary failed:", e);
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  const reassignPlan = useCallback(async (planId: string, newOwnerId: string, reason?: string) => {
    try {
      await invoke("reassign_plan", { plan_id: planId, new_owner_id: newOwnerId, reason });
      toast({ title: "Plan reassigned successfully" });
    } catch (e) {
      toast({ title: "Reassignment failed", variant: "destructive" });
    }
  }, [invoke, toast]);

  return {
    loading,
    scores,
    predictions,
    interventions,
    commandSummary,
    scanInterventions,
    fetchInterventions,
    resolveIntervention,
    computeScores,
    fetchScores,
    fetchScoreTrend,
    predictRisks,
    fetchPredictions,
    fetchCommandSummary,
    reassignPlan,
  };
};

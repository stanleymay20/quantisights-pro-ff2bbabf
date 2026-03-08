import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DecisionContext {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  industry: string | null;
  decision_type: string;
  objective: string | null;
  target_metrics: string[];
  datasets: string[];
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDecisionContextInput {
  name: string;
  description?: string;
  industry?: string;
  decision_type: string;
  objective?: string;
  target_metrics?: string[];
  datasets?: string[];
}

export const DECISION_TYPES = [
  { value: "growth_strategy", label: "Growth Strategy" },
  { value: "operational_efficiency", label: "Operational Efficiency" },
  { value: "risk_management", label: "Risk Management" },
  { value: "pricing_strategy", label: "Pricing Strategy" },
  { value: "policy_analysis", label: "Policy Analysis" },
  { value: "market_expansion", label: "Market Expansion" },
  { value: "investment_decision", label: "Investment Decision" },
  { value: "retention_strategy", label: "Retention Strategy" },
  { value: "cost_optimization", label: "Cost Optimization" },
  { value: "general", label: "General" },
] as const;

/**
 * Hook to manage Decision Contexts — scoping all analysis to a strategic decision.
 */
export const useDecisionContexts = (organizationId: string | null) => {
  const [contexts, setContexts] = useState<DecisionContext[]>([]);
  const [activeContext, setActiveContext] = useState<DecisionContext | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchContexts = useCallback(async () => {
    if (!organizationId) {
      setContexts([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("decision_contexts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setContexts(data as unknown as DecisionContext[]);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    fetchContexts();
  }, [fetchContexts]);

  const createContext = useCallback(async (input: CreateDecisionContextInput) => {
    if (!organizationId) return null;
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("decision_contexts")
      .insert({
        organization_id: organizationId,
        name: input.name,
        description: input.description || null,
        industry: input.industry || null,
        decision_type: input.decision_type,
        objective: input.objective || null,
        target_metrics: input.target_metrics || [],
        datasets: input.datasets || [],
        created_by: userData?.user?.id || null,
      } as any)
      .select()
      .single();

    if (!error && data) {
      const ctx = data as unknown as DecisionContext;
      setContexts(prev => [ctx, ...prev]);
      return ctx;
    }
    return null;
  }, [organizationId]);

  const updateContext = useCallback(async (id: string, updates: Partial<CreateDecisionContextInput>) => {
    const { error } = await supabase
      .from("decision_contexts")
      .update(updates as any)
      .eq("id", id);

    if (!error) {
      await fetchContexts();
    }
    return !error;
  }, [fetchContexts]);

  const archiveContext = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("decision_contexts")
      .update({ status: "archived" } as any)
      .eq("id", id);

    if (!error) {
      if (activeContext?.id === id) setActiveContext(null);
      await fetchContexts();
    }
    return !error;
  }, [activeContext, fetchContexts]);

  return {
    contexts,
    activeContext,
    setActiveContext,
    loading,
    createContext,
    updateContext,
    archiveContext,
    refreshContexts: fetchContexts,
  };
};

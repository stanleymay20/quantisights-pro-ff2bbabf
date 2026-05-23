import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveDataContext } from "@/hooks/useActiveDataContext";
import { invokeWithRetry } from "@/lib/edge-function-retry";
import { getVerifiedAuth, authHeaders } from "@/lib/auth-helpers";

export interface ExecBriefSummary {
  headline: string;
  why_it_matters: string;
  likely_business_impact: string;
  affected_areas: string[];
  projected_time_horizon_days: number;
  recommended_executive_actions: Array<{ label: string; value: string }>;
  confidence: number;
  escalation_recommended: boolean;
  provenance: Record<string, unknown>;
  pressure_tiers: { critical: number; high: number; elevated: number };
}

export interface ExecBrief {
  id: string;
  summary_json: ExecBriefSummary;
  risk_score: number | null;
  generated_at: string;
}

export interface Intervention {
  id: string;
  intervention_type: string;
  severity: string;
  recommended_action: string;
  rationale: string | null;
  supporting_intelligence_ids: string[];
  decision_pressure_score: number;
  pressure_tier: "low" | "elevated" | "high" | "critical";
  escalation_status: string;
  owner_user_id: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  scoring_factors: Record<string, number>;
}

export interface Narrative {
  id: string;
  narrative: string;
  narrative_strength: number;
  affected_domains: string[];
  projected_window_days: number | null;
  combined_pressure_score: number;
  generated_at: string;
}

export interface Exposure {
  id: string;
  exposure_score: number;
  exposure_reasoning: string | null;
  geography_exposure: Record<string, number>;
  entity_exposure: Record<string, number>;
  sector_exposure: Record<string, number>;
  dependency_graph: { nodes?: string[]; domain_counts?: Record<string, number> };
  computed_at: string;
}

export interface ExecObservability {
  snapshot_day: string;
  items_to_decision_rate: number;
  advisory_adoption_rate: number;
  intervention_resolution_rate: number;
  unresolved_critical_pressure: number;
  avg_response_latency_hours: number;
  memory_effectiveness_score: number;
}

export const useExecutiveIntelligence = () => {
  const { orgId } = useActiveDataContext();
  const [brief, setBrief] = useState<ExecBrief | null>(null);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [exposure, setExposure] = useState<Exposure | null>(null);
  const [observability, setObservability] = useState<ExecObservability | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [b, iv, nar, exp, obs] = await Promise.all([
        supabase
          .from("executive_briefs")
          .select("id,summary_json,risk_score,generated_at")
          .eq("organization_id", orgId)
          .eq("role_type", "ceo")
          .order("generated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("executive_interventions")
          .select("id,intervention_type,severity,recommended_action,rationale,supporting_intelligence_ids,decision_pressure_score,pressure_tier,escalation_status,owner_user_id,acknowledged_at,resolved_at,created_at,scoring_factors")
          .eq("organization_id", orgId)
          .order("decision_pressure_score", { ascending: false })
          .limit(50),
        supabase
          .from("executive_cross_domain_narratives")
          .select("id,narrative,narrative_strength,affected_domains,projected_window_days,combined_pressure_score,generated_at")
          .eq("organization_id", orgId)
          .order("generated_at", { ascending: false })
          .limit(10),
        supabase
          .from("executive_exposure_snapshots")
          .select("id,exposure_score,exposure_reasoning,geography_exposure,entity_exposure,sector_exposure,dependency_graph,computed_at")
          .eq("organization_id", orgId)
          .order("computed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("executive_intel_observability")
          .select("snapshot_day,items_to_decision_rate,advisory_adoption_rate,intervention_resolution_rate,unresolved_critical_pressure,avg_response_latency_hours,memory_effectiveness_score")
          .eq("organization_id", orgId)
          .order("snapshot_day", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setBrief((b.data as unknown as ExecBrief) || null);
      setInterventions((iv.data as unknown as Intervention[]) || []);
      setNarratives((nar.data as unknown as Narrative[]) || []);
      setExposure((exp.data as unknown as Exposure) || null);
      setObservability((obs.data as unknown as ExecObservability) || null);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime on interventions
  useEffect(() => {
    if (!orgId) return;
    const ch = supabase
      .channel(`exec-intel-${orgId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "executive_interventions", filter: `organization_id=eq.${orgId}` },
        () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, refresh]);

  const regenerate = useCallback(async () => {
    if (!orgId) return null;
    setGenerating(true);
    try {
      const auth = await getVerifiedAuth();
      if (!auth) return null;
      const { data, error } = await invokeWithRetry("executive-brief-generator", {
        body: { organization_id: orgId },
        headers: authHeaders(auth),
      });
      if (error) throw error;
      await refresh();
      return data;
    } finally {
      setGenerating(false);
    }
  }, [orgId, refresh]);

  const updateIntervention = useCallback(async (
    id: string,
    patch: Partial<Pick<Intervention, "escalation_status" | "owner_user_id">> & { resolved?: boolean; acknowledged?: boolean }
  ) => {
    if (!orgId) return;
    // Optimistic UI
    setInterventions((cur) => cur.map((i) => i.id === id ? {
      ...i,
      ...patch,
      acknowledged_at: patch.acknowledged ? new Date().toISOString() : i.acknowledged_at,
      resolved_at: patch.resolved ? new Date().toISOString() : i.resolved_at,
    } as Intervention : i));
    const updates: Record<string, unknown> = {};
    if (patch.escalation_status) updates.escalation_status = patch.escalation_status;
    if (patch.owner_user_id !== undefined) updates.owner_user_id = patch.owner_user_id;
    if (patch.acknowledged) updates.acknowledged_at = new Date().toISOString();
    if (patch.resolved) updates.resolved_at = new Date().toISOString();
    await supabase.from("executive_interventions").update(updates).eq("id", id).eq("organization_id", orgId);
    refresh();
  }, [orgId, refresh]);

  const topByPressure = useMemo(
    () => [...interventions].sort((a, b) => b.decision_pressure_score - a.decision_pressure_score),
    [interventions]
  );

  return {
    brief, interventions, topByPressure, narratives, exposure, observability,
    loading, generating, refresh, regenerate, updateIntervention,
  };
};

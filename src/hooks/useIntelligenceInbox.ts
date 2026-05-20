import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveDataContext } from "@/hooks/useActiveDataContext";
import { invokeWithRetry } from "@/lib/edge-function-retry";
import { getVerifiedAuth, authHeaders } from "@/lib/auth-helpers";

export interface IntelligenceItem {
  id: string;
  title: string | null;
  summary: string | null;
  severity: string;
  urgency: string;
  domain: string | null;
  geography: string[];
  entities: unknown[];
  status: string;
  global_criticality_score: number;
  ingested_at: string;
  last_transition_at: string;
  intelligence_relevance_scores?: {
    organization_relevance_score: number;
    business_impact_score: number;
    operational_urgency_score: number;
    decision_pressure_score: number;
  } | null;
}

export interface IntelligenceBrief {
  id: string;
  title: string;
  summary: string;
  why_it_matters: string | null;
  affected_areas: string[];
  recommended_actions: Array<{ label: string; value: string }>;
  severity: string;
  item_ids: string[];
  confidence: number;
  generated_at: string;
}

export interface Observability {
  imports_total: number;
  imports_failed: number;
  duplicates_suppressed: number;
  avg_processing_ms: number;
  items_to_decisions: number;
  conversion_rate: number;
}

export const useIntelligenceInbox = () => {
  const { orgId } = useActiveDataContext();
  const [items, setItems] = useState<IntelligenceItem[]>([]);
  const [briefs, setBriefs] = useState<IntelligenceBrief[]>([]);
  const [observability, setObservability] = useState<Observability | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [itemsRes, briefsRes, obsRes] = await Promise.all([
        supabase
          .from("aicis_intelligence_items")
          .select("id,title,summary,severity,urgency,domain,geography,entities,status,global_criticality_score,ingested_at,last_transition_at,intelligence_relevance_scores(organization_relevance_score,business_impact_score,operational_urgency_score,decision_pressure_score)")
          .eq("organization_id", orgId)
          .order("ingested_at", { ascending: false })
          .limit(100),
        supabase
          .from("intelligence_briefs")
          .select("id,title,summary,why_it_matters,affected_areas,recommended_actions,severity,item_ids,confidence,generated_at")
          .eq("organization_id", orgId)
          .order("generated_at", { ascending: false })
          .limit(20),
        supabase
          .from("intelligence_observability")
          .select("imports_total,imports_failed,duplicates_suppressed,avg_processing_ms,items_to_decisions,conversion_rate")
          .eq("organization_id", orgId)
          .eq("day", new Date().toISOString().slice(0, 10))
          .maybeSingle(),
      ]);
      setItems((itemsRes.data as unknown as IntelligenceItem[]) || []);
      setBriefs((briefsRes.data as unknown as IntelligenceBrief[]) || []);
      setObservability((obsRes.data as unknown as Observability) || null);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime
  useEffect(() => {
    if (!orgId) return;
    const ch = supabase
      .channel(`intel-inbox-${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "aicis_intelligence_items", filter: `organization_id=eq.${orgId}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, refresh]);

  const routeItem = useCallback(async (params: {
    intelligence_item_id?: string;
    brief_id?: string;
    route_type: "decision" | "task" | "approval" | "alert" | "owner_assignment";
    reason?: string;
  }) => {
    if (!orgId) return null;
    const auth = await getVerifiedAuth();
    if (!auth) return null;
    const { data, error } = await invokeWithRetry("intelligence-router", {
      body: { organization_id: orgId, ...params },
      headers: authHeaders(auth),
    });
    if (error) throw error;
    await refresh();
    return data;
  }, [orgId, refresh]);

  const sendFeedback = useCallback(async (intelligence_item_id: string, feedback: string, reason?: string) => {
    if (!orgId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("intelligence_feedback").insert({
      organization_id: orgId,
      intelligence_item_id,
      user_id: user.id,
      feedback: feedback as never,
      feedback_reason: reason ?? null,
    });
  }, [orgId]);

  return { items, briefs, observability, loading, refresh, routeItem, sendFeedback };
};

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Insight {
  id: string;
  message: string;
  severity: string;
  category: string | null;
  is_read: boolean;
  created_at: string;
  confidence_score?: number;
  generation_model?: string;
}

export const useInsights = (orgId: string | null, datasetId?: string | null) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setInsights([]);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      let query = supabase
        .from("insights")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(20);

      // Scope to dataset if provided; fall back to org-wide
      if (datasetId) {
        query = query.eq("dataset_id", datasetId);
      }

      const { data, error } = await query;

      if (!error && data) setInsights(data);
      setLoading(false);
    };

    fetchData();
  }, [orgId, datasetId]);

  return { insights, loading };
};

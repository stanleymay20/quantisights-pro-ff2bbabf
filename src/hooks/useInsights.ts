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
  raw_confidence?: number | null;
  capped_confidence?: number | null;
  confidence_cap_reason?: string | null;
  sample_size?: number | null;
  variance_score?: number | null;
  data_quality_index?: number | null;
}

/**
 * Hook to fetch insights — REQUIRES dataset_id (Active Data Contract).
 */
export const useInsights = (orgId: string | null, datasetId: string | null) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !datasetId) {
      setInsights([]);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("insights")
        .select("*")
        .eq("organization_id", orgId)
        .eq("dataset_id", datasetId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && data) setInsights(data);
      setLoading(false);
    };

    fetchData();
  }, [orgId, datasetId]);

  return { insights, loading };
};

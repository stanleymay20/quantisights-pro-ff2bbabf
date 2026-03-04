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

export const useInsights = (orgId: string | null) => {
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
      const { data, error } = await supabase
        .from("insights")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && data) setInsights(data);
      setLoading(false);
    };

    fetchData();
  }, [orgId]);

  return { insights, loading };
};

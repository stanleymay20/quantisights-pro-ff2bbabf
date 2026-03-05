import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PipelineRun {
  id: string;
  dataset_id: string;
  run_type: string;
  status: string;
  stage: string;
  raw_count: number;
  transformed_count: number;
  aggregated_count: number;
  error_count: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
}

/**
 * Hook to track data pipeline runs — REQUIRES dataset_id (Active Data Contract).
 */
export const usePipelineRuns = (orgId: string | null, datasetId: string | null) => {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestRun, setLatestRun] = useState<PipelineRun | null>(null);

  useEffect(() => {
    if (!orgId || !datasetId) {
      setRuns([]);
      setLatestRun(null);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("pipeline_runs")
        .select("*")
        .eq("organization_id", orgId)
        .eq("dataset_id", datasetId)
        .order("started_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        const typed = data as PipelineRun[];
        setRuns(typed);
        setLatestRun(typed[0] ?? null);
      }
      setLoading(false);
    };

    fetch();
  }, [orgId, datasetId]);

  return { runs, latestRun, loading };
};

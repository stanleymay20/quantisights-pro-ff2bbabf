/**
 * Hook for calling the server-side ML engine edge function.
 * Provides typed wrappers for all ML algorithms.
 */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  KMeansResult,
  ARIMAResult,
  DecisionTreeResult,
  IsolationForestResult,
  CohortResult,
  ABTestResult,
} from "./useMLTypes";

export type { KMeansResult, ARIMAResult, DecisionTreeResult, IsolationForestResult, CohortResult, ABTestResult };

interface MLState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useMLCall<T>() {
  const [state, setState] = useState<MLState<T>>({ data: null, loading: false, error: null });

  const call = useCallback(async (algorithm: string, params: Record<string, unknown>): Promise<T | null> => {
    setState({ data: null, loading: true, error: null });
    try {
      const { data, error } = await supabase.functions.invoke("ml-engine", {
        body: { algorithm, params },
      });
      if (error) throw new Error(error.message || "ML engine error");
      if (data?.error) throw new Error(data.error);
      setState({ data: data.result as T, loading: false, error: null });
      return data.result as T;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setState({ data: null, loading: false, error: msg });
      return null;
    }
  }, []);

  return { ...state, call };
}

export function useKMeans() {
  const { data, loading, error, call } = useMLCall<KMeansResult>();
  const cluster = useCallback(
    (numericData: number[][], k: number, maxIterations?: number) =>
      call("kmeans", { data: numericData, k, maxIterations }),
    [call]
  );
  return { result: data, loading, error, cluster };
}

export function useARIMA() {
  const { data, loading, error, call } = useMLCall<ARIMAResult>();
  const forecast = useCallback(
    (series: number[], horizons?: number, order?: { p: number; d: number; q: number }) =>
      call("arima", { series, horizons, order }),
    [call]
  );
  return { result: data, loading, error, forecast };
}

export function useDecisionTree() {
  const { data, loading, error, call } = useMLCall<DecisionTreeResult>();
  const train = useCallback(
    (features: number[][], labels: string[], featureNames: string[], maxDepth?: number) =>
      call("decision_tree", { features, labels, featureNames, maxDepth }),
    [call]
  );
  return { result: data, loading, error, train };
}

export function useIsolationForest() {
  const { data, loading, error, call } = useMLCall<IsolationForestResult>();
  const detect = useCallback(
    (numericData: number[][], numTrees?: number, contamination?: number) =>
      call("isolation_forest", { data: numericData, numTrees, contamination }),
    [call]
  );
  return { result: data, loading, error, detect };
}

export function useCohortAnalysis() {
  const { data, loading, error, call } = useMLCall<CohortResult>();
  const analyze = useCallback(
    (events: Array<{ userId: string; date: string; value?: number }>, periodType?: "week" | "month") =>
      call("cohort_analysis", { events, periodType }),
    [call]
  );
  return { result: data, loading, error, analyze };
}

export function useABTest() {
  const { data, loading, error, call } = useMLCall<ABTestResult>();
  const test = useCallback(
    (controlValues: number[], treatmentValues: number[], alpha?: number) =>
      call("ab_test", { controlValues, treatmentValues, alpha }),
    [call]
  );
  return { result: data, loading, error, test };
}

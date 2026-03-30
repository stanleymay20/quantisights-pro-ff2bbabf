import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CronJobHealth {
  job_name: string;
  last_status: string;
  last_completed_at: string | null;
  last_duration_ms: number | null;
  last_error: string | null;
  runs_last_24h: number;
  failures_last_24h: number;
}

export interface SystemHealthMetrics {
  totalDecisions: number;
  completedDecisions: number;
  evaluatedOutcomes: number;
  pendingOutcomes: number;
  closedLoopRate: number;
  calibrationScore: number | null;
  calibrationModelVersion: number | null;
  latestCalibrationAt: string | null;
  biasDirection: string | null;
  openAdvisories: number;
  insightsLast24h: number;
  avgConfidence: number | null;
  cronJobs: CronJobHealth[];
}

const CRITICAL_JOBS = [
  "evaluate-outcomes",
  "adaptive-calibration",
  "retention-cleanup",
  "morning-brief",
  "convergence-reconcile",
  "health-check",
  "pipeline-orchestrator",
];

export const useSystemHealth = (orgId: string | null) => {
  const [health, setHealth] = useState<SystemHealthMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchHealth = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);

    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Batch all queries in parallel
      const [
        decisionsRes,
        outcomesRes,
        calibrationRes,
        advisoriesRes,
        insightsRes,
        cronLogsRes,
      ] = await Promise.all([
        supabase
          .from("decision_ledger")
          .select("id, execution_status, capped_confidence", { count: "exact", head: false })
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("decision_outcomes")
          .select("id, outcome_status", { count: "exact", head: false })
          .eq("organization_id", orgId)
          .limit(1000),
        supabase
          .from("calibration_models")
          .select("overall_calibration_score, model_version, overall_bias_direction, computed_at")
          .eq("organization_id", orgId)
          .order("computed_at", { ascending: false })
          .limit(1),
        supabase
          .from("advisory_instances")
          .select("id")
          .eq("organization_id", orgId)
          .eq("status", "open"),
        supabase
          .from("insights")
          .select("id")
          .eq("organization_id", orgId)
          .gte("created_at", twentyFourHoursAgo),
        supabase
          .from("cron_run_log")
          .select("job_name, status, completed_at, duration_ms, error_message, started_at")
          .gte("started_at", twentyFourHoursAgo)
          .order("started_at", { ascending: false })
          .limit(500),
      ]);

      const decisions = decisionsRes.data || [];
      const outcomes = outcomesRes.data || [];
      const calModel = calibrationRes.data?.[0];
      const cronLogs = cronLogsRes.data || [];

      const totalDecisions = decisions.length;
      const completedDecisions = decisions.filter(d => d.execution_status === "completed").length;
      const evaluatedOutcomes = outcomes.filter(o => o.outcome_status !== "pending").length;
      const pendingOutcomes = outcomes.filter(o => o.outcome_status === "pending").length;

      const closedLoopRate = totalDecisions > 0
        ? (evaluatedOutcomes / totalDecisions) * 100
        : 0;

      const confidenceValues = decisions
        .map(d => d.capped_confidence)
        .filter((v): v is number => v !== null);
      const avgConfidence = confidenceValues.length > 0
        ? confidenceValues.reduce((s, v) => s + v, 0) / confidenceValues.length
        : null;

      // Build cron job health from logs
      const cronJobs: CronJobHealth[] = CRITICAL_JOBS.map(jobName => {
        const jobLogs = cronLogs.filter(l => l.job_name === jobName);
        const latest = jobLogs[0];
        const failures = jobLogs.filter(l => l.status === "failed").length;

        return {
          job_name: jobName,
          last_status: latest?.status || "no_data",
          last_completed_at: latest?.completed_at || null,
          last_duration_ms: latest?.duration_ms || null,
          last_error: latest?.status === "failed" ? latest?.error_message || null : null,
          runs_last_24h: jobLogs.filter(l => l.status !== "skipped_overlap").length,
          failures_last_24h: failures,
        };
      });

      setHealth({
        totalDecisions,
        completedDecisions,
        evaluatedOutcomes,
        pendingOutcomes,
        closedLoopRate: Math.round(closedLoopRate * 10) / 10,
        calibrationScore: calModel?.overall_calibration_score ?? null,
        calibrationModelVersion: calModel?.model_version ?? null,
        latestCalibrationAt: calModel?.computed_at ?? null,
        biasDirection: calModel?.overall_bias_direction ?? null,
        openAdvisories: advisoriesRes.data?.length ?? 0,
        insightsLast24h: insightsRes.data?.length ?? 0,
        avgConfidence: avgConfidence ? Math.round(avgConfidence * 10) / 10 : null,
        cronJobs,
      });
    } catch (err) {
      console.error("System health fetch error:", err);
    }

    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return { health, loading, refresh: fetchHealth };
};

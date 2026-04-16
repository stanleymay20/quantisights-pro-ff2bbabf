/**
 * Post-decision execution — plan creation, outcome tracking, async tasks
 */
import { supabase } from "@/integrations/supabase/client";
import { captureError } from "@/lib/sentry";
import { writeAuditLog } from "./audit";
import { checkEvaluability } from "./evaluability";
import type { EvaluabilityResult } from "./evaluability";

interface PostApprovalParams {
  decisionId: string;
  organizationId: string;
  userId: string | null;
  recommendedAction: string;
  confidence: number | null;
  datasetId?: string | null;
  expectedMetric?: string | null;
  evaluationWindowDays?: number;
  suggestedOwner?: string | null;
}

/**
 * Run after a decision is approved — creates:
 * 1. Audit log entry
 * 2. Execution plan
 * 3. Decision outcome (for learning loop)
 * 4. Async embedding + prediction (non-blocking)
 */
export async function onDecisionApproved(params: PostApprovalParams) {
  const {
    decisionId, organizationId, userId, recommendedAction, confidence,
    datasetId, expectedMetric, evaluationWindowDays = 30, suggestedOwner,
  } = params;

  // 1. Audit log
  await writeAuditLog({
    organization_id: organizationId,
    actor_id: userId,
    action_type: "decision_approved",
    resource_type: "decision",
    resource_id: decisionId,
    payload: {
      recommended_action: recommendedAction,
      confidence_at_decision: confidence,
      dataset_id: datasetId ?? null,
    },
  });

  // 2. Execution plan
  try {
    await supabase.from("execution_plans").insert({
      decision_id: decisionId,
      organization_id: organizationId,
      action_title: recommendedAction.substring(0, 200),
      action_description: `Execution plan for: ${recommendedAction}`,
      owner_user_id: userId,
      priority: "medium",
      status: "pending",
      trigger_type: "manual",
      trigger_config: {
        suggested_owner: suggestedOwner ?? null,
        evaluation_window_days: evaluationWindowDays,
      },
    });
  } catch (err) {
    console.error("[lifecycle] Failed to create execution plan:", err);
    captureError(err instanceof Error ? err : new Error("Execution plan creation failed"), { decisionId, context: "onDecisionApproved" });
  }

  // 3. Decision outcome (for learning loop) — with metric validation
  if (expectedMetric) {
    try {
      // Validate that the expected_metric exists in the org's actual metrics
      let validatedMetric = expectedMetric;
      if (datasetId) {
        const { data: metricCheck } = await supabase
          .from("metrics")
          .select("metric_type")
          .eq("organization_id", organizationId)
          .eq("dataset_id", datasetId)
          .eq("metric_type", expectedMetric)
          .limit(1)
          .maybeSingle();

        if (!metricCheck) {
          // Metric doesn't exist — try to find the closest match in this dataset
          const { data: availableMetrics } = await supabase
            .from("metric_summaries")
            .select("metric_type, row_count")
            .eq("organization_id", organizationId)
            .eq("dataset_id", datasetId)
            .order("row_count", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (availableMetrics) {
            validatedMetric = availableMetrics.metric_type;
          }
          // If no metrics at all, proceed anyway — evaluate-outcomes will handle gracefully
        }
      }

      await supabase.from("decision_outcomes").insert({
        decision_id: decisionId,
        organization_id: organizationId,
        dataset_id: datasetId ?? null,
        expected_metric: validatedMetric,
        expected_direction: "increase",
        evaluation_window_days: evaluationWindowDays,
      });
    } catch (err) {
      console.error("[lifecycle] Failed to create decision outcome:", err);
      captureError(err instanceof Error ? err : new Error("Decision outcome creation failed"), { decisionId, context: "onDecisionApproved" });
    }
  }

  // 4. Non-blocking async tasks
  try {
    supabase.functions.invoke("embed-decisions", {
      body: { organization_id: organizationId, mode: "specific", entity_ids: [decisionId] },
    }).catch((err) => {
      console.warn("[lifecycle] Embedding invocation failed:", err);
      captureError(err instanceof Error ? err : new Error("embed-decisions invocation failed"), { decisionId, context: "post-approval-embedding" });
    });

    supabase.functions.invoke("predict-outcome", {
      body: { organization_id: organizationId, decision_id: decisionId },
    }).catch((err) => {
      console.warn("[lifecycle] Prediction invocation failed:", err);
      captureError(err instanceof Error ? err : new Error("predict-outcome invocation failed"), { decisionId, context: "post-approval-prediction" });
    });
  } catch (err) {
    console.warn("[lifecycle] Non-critical post-approval task failed:", err);
    captureError(err instanceof Error ? err : new Error("Post-approval tasks failed"), { decisionId, context: "post-approval-async" });
  }
}

/** Log a decision dismissal to audit trail */
export async function onDecisionDismissed(params: {
  decisionId: string;
  organizationId: string;
  userId: string | null;
  reason: string;
  recommendedAction: string;
}) {
  await writeAuditLog({
    organization_id: params.organizationId,
    actor_id: params.userId,
    action_type: "decision_dismissed",
    resource_type: "decision",
    resource_id: params.decisionId,
    payload: {
      reason: params.reason,
      recommended_action: params.recommendedAction,
    },
  });
}

/** Log execution status change */
export async function onExecutionStatusChanged(params: {
  decisionId: string;
  organizationId: string;
  userId: string | null;
  newStatus: string;
}) {
  await writeAuditLog({
    organization_id: params.organizationId,
    actor_id: params.userId,
    action_type: `execution_${params.newStatus}`,
    resource_type: "decision",
    resource_id: params.decisionId,
    payload: { new_status: params.newStatus },
  });
}

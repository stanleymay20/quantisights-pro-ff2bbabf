/**
 * Decision Lifecycle Side Effects
 * 
 * Centralizes all post-decision audit logging, execution plan creation,
 * and outcome tracking to ensure the learning loop is always fed.
 */
import { supabase } from "@/integrations/supabase/client";
import { captureError } from "@/lib/sentry";

interface AuditLogEntry {
  organization_id: string;
  actor_id: string | null;
  action_type: string;
  resource_type: string;
  resource_id: string;
  payload?: Record<string, unknown>;
}

/** Write an immutable audit log entry */
export async function writeAuditLog(entry: AuditLogEntry) {
  try {
    await supabase.from("audit_log").insert([{
      organization_id: entry.organization_id,
      actor_id: entry.actor_id,
      actor_type: "user",
      action_type: entry.action_type,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id,
      payload: entry.payload ? JSON.parse(JSON.stringify(entry.payload)) : null,
    }]);
  } catch (err) {
    console.error("[audit] Failed to write audit log:", err);
    captureError(
      err instanceof Error ? err : new Error("Audit log write failed"),
      { action_type: entry.action_type, resource_id: entry.resource_id }
    );
  }
}

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
 */
export async function onDecisionApproved(params: PostApprovalParams) {
  const {
    decisionId,
    organizationId,
    userId,
    recommendedAction,
    confidence,
    datasetId,
    expectedMetric,
    evaluationWindowDays = 30,
    suggestedOwner,
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

  // 2. Execution plan (always create — even if lightweight)
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
    captureError(
      err instanceof Error ? err : new Error("Execution plan creation failed"),
      { decisionId, context: "onDecisionApproved" }
    );
  }

  // 3. Decision outcome (for learning loop — only if we have a metric to track)
  if (expectedMetric) {
    try {
      await supabase.from("decision_outcomes").insert({
        decision_id: decisionId,
        organization_id: organizationId,
        dataset_id: datasetId ?? null,
        expected_metric: expectedMetric,
        expected_direction: "increase",
        evaluation_window_days: evaluationWindowDays,
      });
    } catch (err) {
      console.error("[lifecycle] Failed to create decision outcome:", err);
      captureError(
        err instanceof Error ? err : new Error("Decision outcome creation failed"),
        { decisionId, context: "onDecisionApproved" }
      );
    }
  }

  // 4. Trigger async embedding + prediction (non-blocking, but observable)
  try {
    supabase.functions.invoke("embed-decisions", {
      body: { organization_id: organizationId, mode: "specific", entity_ids: [decisionId] },
    }).catch((err) => {
      console.warn("[lifecycle] Embedding invocation failed:", err);
      captureError(
        err instanceof Error ? err : new Error("embed-decisions invocation failed"),
        { decisionId, context: "post-approval-embedding" }
      );
    });

    supabase.functions.invoke("predict-outcome", {
      body: { organization_id: organizationId, decision_id: decisionId },
    }).catch((err) => {
      console.warn("[lifecycle] Prediction invocation failed:", err);
      captureError(
        err instanceof Error ? err : new Error("predict-outcome invocation failed"),
        { decisionId, context: "post-approval-prediction" }
      );
    });
  } catch (err) {
    console.warn("[lifecycle] Non-critical post-approval task failed:", err);
    captureError(
      err instanceof Error ? err : new Error("Post-approval tasks failed"),
      { decisionId, context: "post-approval-async" }
    );
  }
}

/**
 * Trigger embedding for a batch of insights after generation
 */
export async function embedInsightsBatch(organizationId: string) {
  try {
    supabase.functions.invoke("embed-decisions", {
      body: { organization_id: organizationId, mode: "insights" },
    }).catch((err) => {
      console.warn("[lifecycle] Insights embedding failed:", err);
      captureError(
        err instanceof Error ? err : new Error("Insights embedding invocation failed"),
        { organizationId, context: "embedInsightsBatch" }
      );
    });
  } catch (err) {
    console.warn("[lifecycle] embedInsightsBatch outer error:", err);
  }
}

/**
 * Trigger embedding for advisories after generation
 */
export async function embedAdvisoriesBatch(organizationId: string) {
  try {
    supabase.functions.invoke("embed-decisions", {
      body: { organization_id: organizationId, mode: "advisories" },
    }).catch((err) => {
      console.warn("[lifecycle] Advisories embedding failed:", err);
      captureError(
        err instanceof Error ? err : new Error("Advisories embedding invocation failed"),
        { organizationId, context: "embedAdvisoriesBatch" }
      );
    });
  } catch (err) {
    console.warn("[lifecycle] embedAdvisoriesBatch outer error:", err);
  }
}

/**
 * Log a decision dismissal to audit trail
 */
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

/**
 * Log execution status change
 */
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

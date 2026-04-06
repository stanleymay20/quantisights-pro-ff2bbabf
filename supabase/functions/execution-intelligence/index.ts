import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, verifyOrgMembership } from "../_shared/auth-guard.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { isValidUUID, isValidString } from "../_shared/input-validation.ts";

const FORMULA_V1 = "score = successRate*40 + (1-failureRate)*25 + max(0,1-avgDelay/14)*20 + reliabilityRate*15";
const MODEL_VERSION = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const correlationId = req.headers.get("x-request-id") || crypto.randomUUID();
  const startTs = Date.now();

  const auth = await authenticateRequest(req);
  if (auth.response) return auth.response;
  const userId = auth.userId;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const { action, organization_id } = body;

  if (!isValidUUID(organization_id as string)) return json({ error: "Invalid organization_id" }, 400);
  if (!isValidString(action as string, 50)) return json({ error: "action required" }, 400);

  const isMember = await verifyOrgMembership(userId, organization_id as string);
  if (!isMember) return json({ error: "Not a member" }, 403);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const orgId = organization_id as string;

  // Helper: log engine run
  const logRun = async (runType: string, runId: string, itemsProcessed: number, itemsCreated: number, status: string, errorMsg?: string, meta?: Record<string, unknown>) => {
    const elapsed = Date.now() - startTs;
    await supabase.from("execution_run_log").insert({
      organization_id: orgId,
      run_type: runType,
      run_id: runId,
      correlation_id: correlationId,
      started_at: new Date(startTs).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: elapsed,
      items_processed: itemsProcessed,
      items_created: itemsCreated,
      status,
      error_message: errorMsg || null,
      metadata: meta || null,
    });
  };

  try {
    switch (action as string) {
      // ─── INTERVENTION ENGINE (atomic + concurrency-safe) ───
      case "scan_interventions": {
        const runId = crypto.randomUUID();
        const { data: plans } = await supabase
          .from("execution_plans")
          .select("id, status, deadline, owner_user_id, decision_id, priority, action_title, created_at")
          .eq("organization_id", orgId)
          .in("status", ["pending", "in_progress"])
          .limit(500);

        if (!plans || plans.length === 0) {
          await logRun("scan_interventions", runId, 0, 0, "completed");
          return json({ interventions_created: 0, skipped: 0, scanned: 0, run_id: runId, correlation_id: correlationId });
        }

        const planIds = plans.map(p => p.id);

        // BATCH: existing unresolved interventions
        const { data: existingInterventions } = await supabase
          .from("execution_interventions")
          .select("execution_plan_id")
          .in("execution_plan_id", planIds)
          .eq("resolved", false);

        const plansWithOpenIntervention = new Set(
          (existingInterventions || []).map(i => i.execution_plan_id)
        );

        // PHASE 3: Exact latest-event retrieval via RPC
        const inProgressIds = plans.filter(p => p.status === "in_progress").map(p => p.id);
        const latestEventByPlan = new Map<string, { at: string; count: number }>();

        if (inProgressIds.length > 0) {
          const { data: eventAgg } = await supabase.rpc("exec_get_latest_events_by_plan", {
            _plan_ids: inProgressIds,
            _org_id: orgId,
          });
          for (const row of eventAgg || []) {
            latestEventByPlan.set(row.execution_plan_id, {
              at: row.latest_event_at,
              count: Number(row.event_count),
            });
          }
        }

        const now = new Date();
        const interventions: Array<Record<string, unknown>> = [];

        for (const plan of plans) {
          if (plansWithOpenIntervention.has(plan.id)) continue;

          // Overdue detection with rationale
          if (plan.deadline && new Date(plan.deadline) < now) {
            const daysOverdue = Math.floor((now.getTime() - new Date(plan.deadline).getTime()) / 86400000);
            let type = "escalation";
            let reason = `Plan "${plan.action_title}" is ${daysOverdue} day(s) overdue`;
            let corrective = "Review and either extend deadline or reassign ownership";

            if (daysOverdue > 7) {
              type = "auto_cancel";
              reason = `Plan "${plan.action_title}" is critically overdue (${daysOverdue} days)`;
              corrective = "Consider cancelling or escalating to executive sponsor";
            } else if (daysOverdue > 3) {
              type = "reassignment";
              reason = `Plan "${plan.action_title}" overdue by ${daysOverdue} days — reassignment recommended`;
              corrective = "Reassign to available team member or escalate";
            }

            interventions.push({
              execution_plan_id: plan.id,
              intervention_type: type,
              trigger_reason: reason,
              previous_owner: plan.owner_user_id,
              corrective_action: corrective,
              auto_triggered: true,
            });
            continue;
          }

          // Stale detection with 3 explicit tiers
          if (plan.status === "in_progress") {
            const eventInfo = latestEventByPlan.get(plan.id);
            if (!eventInfo) {
              // Tier 1: No events ever recorded
              const ageDays = Math.floor((now.getTime() - new Date(plan.created_at).getTime()) / 86400000);
              if (ageDays > 3) {
                interventions.push({
                  execution_plan_id: plan.id,
                  intervention_type: "escalation",
                  trigger_reason: `In-progress plan "${plan.action_title}" has ZERO recorded events over ${ageDays} days`,
                  previous_owner: plan.owner_user_id,
                  corrective_action: "Verify plan is actually being worked on. Consider reassignment.",
                  auto_triggered: true,
                });
              }
            } else {
              const daysSinceActivity = Math.floor((now.getTime() - new Date(eventInfo.at).getTime()) / 86400000);
              if (daysSinceActivity > 7) {
                // Tier 2: No event in 7+ days — serious
                interventions.push({
                  execution_plan_id: plan.id,
                  intervention_type: "reassignment",
                  trigger_reason: `No activity for ${daysSinceActivity} days on "${plan.action_title}" (${eventInfo.count} total events)`,
                  previous_owner: plan.owner_user_id,
                  corrective_action: "Reassign or escalate — extended inactivity indicates blocking issues",
                  auto_triggered: true,
                });
              } else if (daysSinceActivity > 5) {
                // Tier 3: Early warning
                interventions.push({
                  execution_plan_id: plan.id,
                  intervention_type: "escalation",
                  trigger_reason: `No activity for ${daysSinceActivity} days on in-progress plan "${plan.action_title}"`,
                  previous_owner: plan.owner_user_id,
                  corrective_action: "Check with owner for blockers or reassign",
                  auto_triggered: true,
                });
              }
            }
          }
        }

        // PHASE 1+2: Atomic bulk insert with concurrency-safe dedupe via RPC
        let created = 0;
        let skipped = 0;
        if (interventions.length > 0) {
          const { data: result } = await supabase.rpc("exec_create_interventions_atomic", {
            _interventions: JSON.stringify(interventions),
            _org_id: orgId,
          });
          created = result?.created || 0;
          skipped = result?.skipped || 0;
        }

        await logRun("scan_interventions", runId, plans.length, created, "completed", undefined, { skipped });
        return json({ interventions_created: created, skipped, scanned: plans.length, run_id: runId, correlation_id: correlationId });
      }

      // PHASE 1: Atomic resolve via RPC
      case "resolve_intervention": {
        const { intervention_id } = body;
        if (!isValidUUID(intervention_id as string)) return json({ error: "Invalid intervention_id" }, 400);

        const { data: result } = await supabase.rpc("exec_resolve_intervention_atomic", {
          _intervention_id: intervention_id,
          _org_id: orgId,
          _actor_id: userId,
        });

        if (result && !result.success) return json({ error: result.error }, 400);
        return json(result);
      }

      // PHASE 1: Atomic reassign via RPC
      case "reassign_plan": {
        const { plan_id, new_owner_id, reason } = body;
        if (!isValidUUID(plan_id as string) || !isValidUUID(new_owner_id as string)) return json({ error: "Invalid IDs" }, 400);

        const { data: result } = await supabase.rpc("exec_reassign_plan_atomic", {
          _plan_id: plan_id,
          _org_id: orgId,
          _new_owner_id: new_owner_id,
          _actor_id: userId,
          _reason: (reason as string) || "Manual reassignment",
        });

        if (result && !result.success) return json({ error: result.error }, 404);
        return json(result);
      }

      case "get_interventions": {
        const { data } = await supabase
          .from("execution_interventions")
          .select("*, execution_plans(action_title, status, priority, deadline)")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(50);
        return json(data || []);
      }

      // ─── EXECUTION SCORING (append-only + governance metadata) ───
      case "compute_scores": {
        const runId = crypto.randomUUID();
        const { data: plans } = await supabase
          .from("execution_plans")
          .select("id, status, deadline, owner_user_id, decision_id, created_at, updated_at")
          .eq("organization_id", orgId)
          .limit(1000);

        if (!plans || plans.length === 0) {
          await logRun("compute_scores", runId, 0, 0, "completed");
          return json({ scores: [], run_id: runId });
        }

        const now = new Date();
        const completed = plans.filter(p => p.status === "completed");
        const failed = plans.filter(p => p.status === "failed");
        const cancelled = plans.filter(p => p.status === "cancelled");
        const total = plans.length;

        const successRate = total > 0 ? completed.length / total : 0;
        const failureRate = total > 0 ? failed.length / total : 0;
        const reliabilityRate = total > 0 ? (completed.length + cancelled.length) / total : 0;

        const completedWithDeadline = completed.filter(p => p.deadline);
        let avgDelay = 0;
        if (completedWithDeadline.length > 0) {
          const totalDelay = completedWithDeadline.reduce((sum, p) => {
            const deadline = new Date(p.deadline!);
            const completedAt = new Date(p.updated_at);
            return sum + Math.max(0, (completedAt.getTime() - deadline.getTime()) / 86400000);
          }, 0);
          avgDelay = totalDelay / completedWithDeadline.length;
        }

        const score = Math.round(
          (successRate * 40 + (1 - failureRate) * 25 + Math.max(0, 1 - avgDelay / 14) * 20 + reliabilityRate * 15)
        );

        const scoreExplanation = {
          success_component: Math.round(successRate * 40 * 100) / 100,
          failure_avoidance_component: Math.round((1 - failureRate) * 25 * 100) / 100,
          timeliness_component: Math.round(Math.max(0, 1 - avgDelay / 14) * 20 * 100) / 100,
          reliability_component: Math.round(reliabilityRate * 15 * 100) / 100,
          breakdown: { completed: completed.length, failed: failed.length, cancelled: cancelled.length, pending: total - completed.length - failed.length - cancelled.length },
        };

        const orgScore = {
          organization_id: orgId,
          scope_type: "organization",
          scope_id: orgId,
          score: Math.min(100, Math.max(0, score)),
          reliability_rate: Math.round(reliabilityRate * 100),
          avg_delay_days: Math.round(avgDelay * 10) / 10,
          success_rate: Math.round(successRate * 100),
          failure_rate: Math.round(failureRate * 100),
          plans_evaluated: total,
          scoring_model_version: MODEL_VERSION,
          computed_at: now.toISOString(),
          formula_snapshot: FORMULA_V1,
          computed_by: "system",
          source_window_days: 90,
          score_explanation: scoreExplanation,
        };

        // Per-user scores
        const userMap = new Map<string, typeof plans>();
        for (const p of plans) {
          if (!p.owner_user_id) continue;
          const arr = userMap.get(p.owner_user_id) || [];
          arr.push(p);
          userMap.set(p.owner_user_id, arr);
        }

        const userScores: Array<Record<string, unknown>> = [];
        for (const [uid, userPlans] of userMap) {
          const uCompleted = userPlans.filter(p => p.status === "completed").length;
          const uFailed = userPlans.filter(p => p.status === "failed").length;
          const uTotal = userPlans.length;
          const uSuccessRate = uTotal > 0 ? uCompleted / uTotal : 0;
          const uFailureRate = uTotal > 0 ? uFailed / uTotal : 0;
          const uScore = Math.round(uSuccessRate * 50 + (1 - uFailureRate) * 30 + 20);

          userScores.push({
            organization_id: orgId,
            scope_type: "user",
            scope_id: uid,
            score: Math.min(100, Math.max(0, uScore)),
            success_rate: Math.round(uSuccessRate * 100),
            failure_rate: Math.round(uFailureRate * 100),
            plans_evaluated: uTotal,
            scoring_model_version: MODEL_VERSION,
            computed_at: now.toISOString(),
            formula_snapshot: "score = successRate*50 + (1-failureRate)*30 + 20",
            computed_by: "system",
            source_window_days: 90,
            score_explanation: {
              success_component: Math.round(uSuccessRate * 50 * 100) / 100,
              failure_avoidance_component: Math.round((1 - uFailureRate) * 30 * 100) / 100,
              base: 20,
            },
          });
        }

        const allScores = [orgScore, ...userScores];
        await supabase.from("execution_scores").insert(allScores);

        await logRun("compute_scores", runId, total, allScores.length, "completed");
        return json({ org_score: orgScore, user_scores: userScores, run_id: runId });
      }

      case "get_scores": {
        const { scope_type, include_history } = body;
        let query = supabase
          .from("execution_scores")
          .select("*")
          .eq("organization_id", orgId)
          .order("computed_at", { ascending: false });

        if (scope_type) query = query.eq("scope_type", scope_type as string);

        const limit = include_history ? 100 : 20;
        const { data } = await query.limit(limit);

        if (!include_history && data) {
          const latestByScope = new Map<string, (typeof data)[0]>();
          for (const row of data) {
            const key = `${row.scope_type}:${row.scope_id}`;
            if (!latestByScope.has(key)) latestByScope.set(key, row);
          }
          return json(Array.from(latestByScope.values()));
        }
        return json(data || []);
      }

      case "get_score_trend": {
        const { scope_type: st, scope_id: si, limit: trendLimit } = body;
        if (!st || !isValidUUID(si as string)) return json({ error: "scope_type and scope_id required" }, 400);

        const { data } = await supabase
          .from("execution_scores")
          .select("score, success_rate, failure_rate, avg_delay_days, plans_evaluated, computed_at, score_explanation, scoring_model_version")
          .eq("organization_id", orgId)
          .eq("scope_type", st as string)
          .eq("scope_id", si as string)
          .order("computed_at", { ascending: false })
          .limit(Math.min((trendLimit as number) || 30, 100));

        return json(data || []);
      }

      // PHASE 5: Score change explanation between two points
      case "explain_score_change": {
        const { scope_type: est, scope_id: esi } = body;
        if (!est || !isValidUUID(esi as string)) return json({ error: "scope_type and scope_id required" }, 400);

        const { data: recentScores } = await supabase
          .from("execution_scores")
          .select("score, score_explanation, computed_at, scoring_model_version")
          .eq("organization_id", orgId)
          .eq("scope_type", est as string)
          .eq("scope_id", esi as string)
          .order("computed_at", { ascending: false })
          .limit(2);

        if (!recentScores || recentScores.length < 2) {
          return json({ explanation: "Not enough score history to compare", current: recentScores?.[0] || null, previous: null });
        }

        const [current, previous] = recentScores;
        const delta = current.score - previous.score;
        const curExp = current.score_explanation as Record<string, number> | null;
        const prevExp = previous.score_explanation as Record<string, number> | null;

        const componentDeltas: Record<string, number> = {};
        if (curExp && prevExp) {
          for (const key of Object.keys(curExp)) {
            if (typeof curExp[key] === "number" && typeof prevExp[key] === "number") {
              componentDeltas[key] = Math.round((curExp[key] - prevExp[key]) * 100) / 100;
            }
          }
        }

        return json({
          score_delta: delta,
          current,
          previous,
          component_deltas: componentDeltas,
          direction: delta > 0 ? "improved" : delta < 0 ? "declined" : "unchanged",
        });
      }

      // ─── PREDICTIVE EXECUTION AI (append-only history via RPC) ───
      case "predict_risks": {
        const runId = crypto.randomUUID();
        const { data: activePlans } = await supabase
          .from("execution_plans")
          .select("id, status, deadline, owner_user_id, priority, action_title, created_at, trigger_config, blocked_by_plan_id, is_critical_path")
          .eq("organization_id", orgId)
          .in("status", ["pending", "in_progress"])
          .limit(200);

        if (!activePlans || activePlans.length === 0) {
          await logRun("predict_risks", runId, 0, 0, "completed");
          return json({ predictions: [], total: 0, run_id: runId });
        }

        // BATCH: historical patterns
        const { data: historicalPlans } = await supabase
          .from("execution_plans")
          .select("status, deadline, priority, created_at, updated_at, owner_user_id")
          .eq("organization_id", orgId)
          .in("status", ["completed", "failed"])
          .limit(500);

        const histByPriority: Record<string, { total: number; failed: number; avgDays: number }> = {};
        const histByOwner: Record<string, { total: number; failed: number }> = {};

        for (const hp of historicalPlans || []) {
          const pe = histByPriority[hp.priority] || { total: 0, failed: 0, avgDays: 0 };
          pe.total++;
          if (hp.status === "failed") pe.failed++;
          if (hp.deadline && hp.updated_at) {
            const days = (new Date(hp.updated_at).getTime() - new Date(hp.created_at).getTime()) / 86400000;
            pe.avgDays = (pe.avgDays * (pe.total - 1) + days) / pe.total;
          }
          histByPriority[hp.priority] = pe;

          if (hp.owner_user_id) {
            const oe = histByOwner[hp.owner_user_id] || { total: 0, failed: 0 };
            oe.total++;
            if (hp.status === "failed") oe.failed++;
            histByOwner[hp.owner_user_id] = oe;
          }
        }

        const now = new Date();
        const predictions: Array<Record<string, unknown>> = [];

        for (const plan of activePlans) {
          const riskFactors: Array<{ factor: string; weight: number }> = [];
          let riskScore = 0;

          // Factor 1: Overdue / deadline proximity
          if (plan.deadline) {
            const daysToDeadline = (new Date(plan.deadline).getTime() - now.getTime()) / 86400000;
            if (daysToDeadline < 0) {
              const w = Math.min(40, 25 + Math.abs(Math.round(daysToDeadline)));
              riskScore += w;
              riskFactors.push({ factor: `Overdue by ${Math.abs(Math.round(daysToDeadline))} days`, weight: w });
            } else if (daysToDeadline < 2) {
              riskScore += 20;
              riskFactors.push({ factor: "Deadline imminent (< 2 days)", weight: 20 });
            }
          } else {
            riskScore += 10;
            riskFactors.push({ factor: "No deadline set", weight: 10 });
          }

          // Factor 2: Priority-based failure rate
          const hist = histByPriority[plan.priority];
          if (hist && hist.total >= 3) {
            const failRate = hist.failed / hist.total;
            const w = Math.round(failRate * 25);
            if (w > 5) {
              riskScore += w;
              riskFactors.push({ factor: `Historical ${plan.priority} failure rate: ${Math.round(failRate * 100)}%`, weight: w });
            }
          }

          // Factor 3: Owner failure rate
          if (plan.owner_user_id && histByOwner[plan.owner_user_id]) {
            const ow = histByOwner[plan.owner_user_id];
            if (ow.total >= 3) {
              const ownerFailRate = ow.failed / ow.total;
              const w = Math.round(ownerFailRate * 15);
              if (w > 3) {
                riskScore += w;
                riskFactors.push({ factor: `Owner historical failure rate: ${Math.round(ownerFailRate * 100)}%`, weight: w });
              }
            }
          }

          // Factor 4: No owner
          if (!plan.owner_user_id) {
            riskScore += 15;
            riskFactors.push({ factor: "No owner assigned", weight: 15 });
          }

          // Factor 5: Age/staleness
          const ageDays = (now.getTime() - new Date(plan.created_at).getTime()) / 86400000;
          if (ageDays > 14 && plan.status === "pending") {
            riskScore += 20;
            riskFactors.push({ factor: `Pending for ${Math.round(ageDays)} days without starting`, weight: 20 });
          } else if (ageDays > 7 && plan.status === "pending") {
            riskScore += 10;
            riskFactors.push({ factor: `Pending for ${Math.round(ageDays)} days`, weight: 10 });
          }

          // Factor 6: Critical priority amplifier
          if (plan.priority === "critical") {
            riskScore = Math.min(100, Math.round(riskScore * 1.2));
            riskFactors.push({ factor: "Critical priority amplifier (+20%)", weight: 5 });
          }

          // Factor 7: Blocked by another plan
          if (plan.blocked_by_plan_id) {
            riskScore += 15;
            riskFactors.push({ factor: "Blocked by upstream dependency", weight: 15 });
          }

          riskScore = Math.min(100, Math.max(0, riskScore));

          let predictedOutcome = "on_track";
          let recommendation = "No action needed — plan is progressing normally.";
          let delayPredicted = 0;

          if (riskScore >= 70) {
            predictedOutcome = "likely_failure";
            recommendation = "Immediate intervention required. Consider reassignment, scope reduction, or executive escalation.";
            delayPredicted = Math.round(ageDays * 0.5 + 7);
          } else if (riskScore >= 50) {
            predictedOutcome = "at_risk";
            recommendation = "Review plan with owner. Consider additional resources or deadline extension.";
            delayPredicted = Math.round(ageDays * 0.3 + 3);
          } else if (riskScore >= 30) {
            predictedOutcome = "delayed";
            recommendation = "Monitor closely. Minor adjustments may prevent escalation.";
            delayPredicted = Math.round(ageDays * 0.15 + 1);
          }

          predictions.push({
            execution_plan_id: plan.id,
            risk_score: riskScore,
            predicted_outcome: predictedOutcome,
            delay_days_predicted: delayPredicted,
            risk_factors: riskFactors,
            recommendation,
            model_version: MODEL_VERSION,
            feature_summary: {
              factors_count: riskFactors.length,
              top_factor: riskFactors.length > 0 ? riskFactors.sort((a, b) => b.weight - a.weight)[0].factor : null,
              is_blocked: !!plan.blocked_by_plan_id,
              is_critical_path: plan.is_critical_path,
            },
          });
        }

        // PHASE 4: Atomic supersede via RPC (append-only, no delete)
        const planIds = activePlans.map(p => p.id);
        const { data: supersedeResult } = await supabase.rpc("exec_supersede_predictions", {
          _plan_ids: planIds,
          _org_id: orgId,
          _new_run_id: runId,
          _predictions: JSON.stringify(predictions),
        });

        await logRun("predict_risks", runId, activePlans.length, supersedeResult?.inserted || predictions.length, "completed");
        return json({ predictions, total: predictions.length, run_id: runId, superseded: supersedeResult?.superseded || 0 });
      }

      case "get_predictions": {
        const { include_history, plan_id: filterPlanId } = body;
        let query = supabase
          .from("execution_predictions")
          .select("*, execution_plans(action_title, status, priority, deadline, owner_user_id)")
          .eq("organization_id", orgId);

        if (filterPlanId && isValidUUID(filterPlanId as string)) {
          query = query.eq("execution_plan_id", filterPlanId as string);
        } else if (!include_history) {
          query = query.eq("is_active", true);
        }

        query = query.order("risk_score", { ascending: false }).limit(include_history ? 200 : 100);
        const { data } = await query;
        return json(data || []);
      }

      // PHASE 4: Prediction history for a single plan
      case "get_prediction_history": {
        const { plan_id: histPlanId } = body;
        if (!isValidUUID(histPlanId as string)) return json({ error: "plan_id required" }, 400);

        const { data } = await supabase
          .from("execution_predictions")
          .select("risk_score, predicted_outcome, risk_factors, recommendation, model_version, is_active, generated_at, superseded_at, feature_summary, run_id")
          .eq("execution_plan_id", histPlanId as string)
          .eq("organization_id", orgId)
          .order("generated_at", { ascending: false })
          .limit(50);

        return json(data || []);
      }

      // ─── PHASE 7: EXECUTIVE OVERRIDES ───
      case "executive_override": {
        const { plan_id: ovPlanId, override_type, reason: ovReason, changes } = body;
        if (!isValidUUID(ovPlanId as string)) return json({ error: "plan_id required" }, 400);
        if (!isValidString(override_type as string, 30)) return json({ error: "override_type required" }, 400);
        if (!isValidString(ovReason as string, 500)) return json({ error: "reason required" }, 400);

        const validTypes = ["force_reassign", "force_cancel", "extend_deadline", "escalate", "mark_blocked"];
        if (!validTypes.includes(override_type as string)) return json({ error: `Invalid override_type. Must be: ${validTypes.join(", ")}` }, 400);

        const { data: result } = await supabase.rpc("exec_log_override", {
          _plan_id: ovPlanId,
          _org_id: orgId,
          _actor_id: userId,
          _override_type: override_type,
          _reason: ovReason,
          _changes: changes || {},
        });

        if (result && !result.success) return json({ error: result.error }, 400);
        return json(result);
      }

      case "get_overrides": {
        const { plan_id: ovFilterPlanId } = body;
        let query = supabase
          .from("execution_overrides")
          .select("*")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false });

        if (ovFilterPlanId && isValidUUID(ovFilterPlanId as string)) {
          query = query.eq("execution_plan_id", ovFilterPlanId as string);
        }

        const { data } = await query.limit(50);
        return json(data || []);
      }

      // ─── PHASE 6: DEPENDENCY GRAPH ───
      case "get_dependency_graph": {
        const { data: plans } = await supabase
          .from("execution_plans")
          .select("id, action_title, status, priority, deadline, owner_user_id, decision_id, blocked_by_plan_id, unlocks_plan_ids, dependency_type, is_critical_path")
          .eq("organization_id", orgId)
          .in("status", ["pending", "in_progress", "blocked"])
          .limit(200);

        if (!plans || plans.length === 0) return json({ graph: [], blocked_chains: [], critical_path: [] });

        const blocked = plans.filter(p => p.blocked_by_plan_id);
        const criticalPath = plans.filter(p => p.is_critical_path);

        // Detect cascading delay chains
        const planMap = new Map(plans.map(p => [p.id, p]));
        const blockedChains: Array<{ chain: string[]; depth: number }> = [];

        for (const plan of blocked) {
          const chain: string[] = [plan.id];
          let current = plan.blocked_by_plan_id;
          let depth = 0;
          while (current && depth < 10) {
            chain.unshift(current);
            const upstream = planMap.get(current);
            current = upstream?.blocked_by_plan_id || null;
            depth++;
          }
          if (chain.length > 1) {
            blockedChains.push({ chain, depth: chain.length });
          }
        }

        return json({
          graph: plans,
          blocked_chains: blockedChains.sort((a, b) => b.depth - a.depth),
          critical_path: criticalPath,
          stats: {
            total: plans.length,
            blocked: blocked.length,
            critical: criticalPath.length,
            with_dependencies: plans.filter(p => p.blocked_by_plan_id || (p.unlocks_plan_ids && p.unlocks_plan_ids.length > 0)).length,
          },
        });
      }

      // ─── PHASE 10: FORENSIC TRACE for single plan ───
      case "forensic_trace": {
        const { plan_id: tracePlanId } = body;
        if (!isValidUUID(tracePlanId as string)) return json({ error: "plan_id required" }, 400);

        const [
          { data: plan },
          { data: events },
          { data: interventions },
          { data: predictions },
          { data: scores },
          { data: overrides },
        ] = await Promise.all([
          supabase.from("execution_plans")
            .select("*")
            .eq("id", tracePlanId as string).eq("organization_id", orgId).single(),
          supabase.from("execution_events")
            .select("*").eq("execution_plan_id", tracePlanId as string).eq("organization_id", orgId)
            .order("created_at", { ascending: true }).limit(100),
          supabase.from("execution_interventions")
            .select("*").eq("execution_plan_id", tracePlanId as string).eq("organization_id", orgId)
            .order("created_at", { ascending: true }).limit(50),
          supabase.from("execution_predictions")
            .select("risk_score, predicted_outcome, model_version, is_active, generated_at, superseded_at, risk_factors, feature_summary")
            .eq("execution_plan_id", tracePlanId as string).eq("organization_id", orgId)
            .order("generated_at", { ascending: false }).limit(20),
          supabase.from("execution_scores")
            .select("score, computed_at, score_explanation")
            .eq("organization_id", orgId).eq("scope_type", "organization")
            .order("computed_at", { ascending: false }).limit(5),
          supabase.from("execution_overrides")
            .select("*").eq("execution_plan_id", tracePlanId as string).eq("organization_id", orgId)
            .order("created_at", { ascending: true }).limit(20),
        ]);

        return json({
          plan: plan || null,
          timeline: {
            events: events || [],
            interventions: interventions || [],
            overrides: overrides || [],
          },
          predictions: predictions || [],
          org_score_snapshots: scores || [],
          lineage: {
            total_events: (events || []).length,
            total_interventions: (interventions || []).length,
            total_predictions: (predictions || []).length,
            total_overrides: (overrides || []).length,
          },
        });
      }

      // ─── PHASE 8: ENGINE HEALTH ───
      case "engine_health": {
        const { data: recentRuns } = await supabase
          .from("execution_run_log")
          .select("run_type, status, duration_ms, items_processed, items_created, started_at, error_message")
          .eq("organization_id", orgId)
          .order("started_at", { ascending: false })
          .limit(20);

        const runs = recentRuns || [];
        const byType: Record<string, { latest: string; status: string; avg_duration: number; runs: number; errors: number }> = {};

        for (const r of runs) {
          const entry = byType[r.run_type] || { latest: "", status: "unknown", avg_duration: 0, runs: 0, errors: 0 };
          if (!entry.latest || r.started_at > entry.latest) {
            entry.latest = r.started_at;
            entry.status = r.status;
          }
          entry.runs++;
          entry.avg_duration = (entry.avg_duration * (entry.runs - 1) + (r.duration_ms || 0)) / entry.runs;
          if (r.status === "failed") entry.errors++;
          byType[r.run_type] = entry;
        }

        return json({
          engines: byType,
          recent_runs: runs.slice(0, 10),
          overall_health: Object.values(byType).some(e => e.errors > 0) ? "degraded" : "healthy",
        });
      }

      // ─── EXECUTIVE COMMAND SUMMARY ───
      case "command_summary": {
        const runId = crypto.randomUUID();
        const [
          { data: scores },
          { data: preds },
          { data: openInterventions },
          { data: activePlans },
          { data: recentOverrides },
          { data: recentRuns },
        ] = await Promise.all([
          supabase.from("execution_scores")
            .select("*").eq("organization_id", orgId).eq("scope_type", "organization")
            .order("computed_at", { ascending: false }).limit(1),
          supabase.from("execution_predictions")
            .select("risk_score, predicted_outcome, execution_plan_id")
            .eq("organization_id", orgId).eq("is_active", true)
            .order("risk_score", { ascending: false }).limit(200),
          supabase.from("execution_interventions")
            .select("id, intervention_type, resolved")
            .eq("organization_id", orgId).eq("resolved", false).limit(50),
          supabase.from("execution_plans")
            .select("id, status, priority, decision_id, blocked_by_plan_id, is_critical_path")
            .eq("organization_id", orgId).in("status", ["pending", "in_progress", "blocked"]).limit(500),
          supabase.from("execution_overrides")
            .select("id, override_type, created_at")
            .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(5),
          supabase.from("execution_run_log")
            .select("run_type, status, started_at, duration_ms")
            .eq("organization_id", orgId).order("started_at", { ascending: false }).limit(5),
        ]);

        const orgScore = scores?.[0] || null;
        const predictions = preds || [];
        const atRiskCount = predictions.filter(p => p.predicted_outcome === "at_risk" || p.predicted_outcome === "likely_failure").length;
        const active = activePlans || [];
        const criticalPlans = active.filter(p => p.priority === "critical").length;
        const blockedPlans = active.filter(p => p.blocked_by_plan_id).length;

        const decisionGroups = new Map<string, number>();
        for (const p of active) {
          decisionGroups.set(p.decision_id, (decisionGroups.get(p.decision_id) || 0) + 1);
        }
        const multiPlanDecisions = Array.from(decisionGroups.entries())
          .filter(([, count]) => count > 1)
          .sort((a, b) => b[1] - a[1])
          .map(([decisionId, count]) => ({ decision_id: decisionId, plan_count: count }));

        await logRun("command_summary", runId, active.length, 0, "completed");

        return json({
          org_score: orgScore,
          at_risk_plans: atRiskCount,
          open_interventions: (openInterventions || []).length,
          critical_active: criticalPlans,
          blocked_active: blockedPlans,
          total_active: active.length,
          multi_plan_decisions: multiPlanDecisions,
          risk_distribution: {
            likely_failure: predictions.filter(p => p.predicted_outcome === "likely_failure").length,
            at_risk: predictions.filter(p => p.predicted_outcome === "at_risk").length,
            delayed: predictions.filter(p => p.predicted_outcome === "delayed").length,
            on_track: predictions.filter(p => p.predicted_outcome === "on_track").length,
          },
          recent_overrides: recentOverrides || [],
          last_runs: recentRuns || [],
          generated_at: new Date().toISOString(),
          correlation_id: correlationId,
        });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error(`execution-intelligence error [${correlationId}]:`, errorMsg);
    return json({ error: errorMsg, correlation_id: correlationId }, 500);
  }
});

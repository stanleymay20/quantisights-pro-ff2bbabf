import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, verifyOrgMembership } from "../_shared/auth-guard.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { isValidUUID, isValidString } from "../_shared/input-validation.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const auth = await authenticateRequest(req);
  if (auth.response) return auth.response;
  const userId = auth.userId;

  const body = await req.json();
  const { action, organization_id } = body;

  if (!isValidUUID(organization_id)) return json({ error: "Invalid organization_id" }, 400);
  if (!isValidString(action, 50)) return json({ error: "action required" }, 400);

  const isMember = await verifyOrgMembership(userId, organization_id);
  if (!isMember) return json({ error: "Not a member" }, 403);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    switch (action) {
      // ─── INTERVENTION ENGINE ───
      case "scan_interventions": {
        // Find overdue/failing plans and auto-create interventions
        const { data: plans } = await supabase
          .from("execution_plans")
          .select("id, status, deadline, owner_user_id, decision_id, priority, action_title")
          .eq("organization_id", organization_id)
          .in("status", ["pending", "in_progress"])
          .limit(500);

        if (!plans || plans.length === 0) return json({ interventions_created: 0, scanned: 0 });

        const now = new Date();
        const interventions: Array<Record<string, unknown>> = [];

        for (const plan of plans) {
          // Check if intervention already exists (avoid duplicates)
          const { data: existing } = await supabase
            .from("execution_interventions")
            .select("id")
            .eq("execution_plan_id", plan.id)
            .eq("resolved", false)
            .limit(1);

          if (existing && existing.length > 0) continue;

          // Overdue detection
          if (plan.deadline && new Date(plan.deadline) < now) {
            const daysOverdue = Math.floor((now.getTime() - new Date(plan.deadline).getTime()) / 86400000);
            let type = "escalation";
            let reason = `Plan "${plan.action_title}" is ${daysOverdue} day(s) overdue`;
            let corrective = `Review and either extend deadline or reassign ownership`;

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
              organization_id,
              intervention_type: type,
              trigger_reason: reason,
              previous_owner: plan.owner_user_id,
              corrective_action: corrective,
              auto_triggered: true,
            });
          }

          // Stale in_progress (no activity for > 5 days — check events)
          if (plan.status === "in_progress") {
            const { data: recentEvents } = await supabase
              .from("execution_events")
              .select("created_at")
              .eq("execution_plan_id", plan.id)
              .order("created_at", { ascending: false })
              .limit(1);

            const lastActivity = recentEvents?.[0]?.created_at;
            if (lastActivity) {
              const daysSinceActivity = Math.floor((now.getTime() - new Date(lastActivity).getTime()) / 86400000);
              if (daysSinceActivity > 5) {
                interventions.push({
                  execution_plan_id: plan.id,
                  organization_id,
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

        if (interventions.length > 0) {
          await supabase.from("execution_interventions").insert(interventions);
          // Log to audit
          for (const iv of interventions) {
            await supabase.from("audit_log").insert({
              organization_id,
              actor_id: null,
              actor_type: "system",
              action_type: "auto_intervention_created",
              resource_type: "execution_plan",
              resource_id: iv.execution_plan_id,
              payload: { intervention_type: iv.intervention_type, reason: iv.trigger_reason },
            });
          }
        }

        return json({ interventions_created: interventions.length, scanned: plans.length });
      }

      case "resolve_intervention": {
        const { intervention_id } = body;
        if (!isValidUUID(intervention_id)) return json({ error: "Invalid intervention_id" }, 400);

        const { data, error } = await supabase
          .from("execution_interventions")
          .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: userId })
          .eq("id", intervention_id)
          .eq("organization_id", organization_id)
          .select()
          .single();

        if (error) throw error;
        return json(data);
      }

      case "reassign_plan": {
        const { plan_id, new_owner_id, reason } = body;
        if (!isValidUUID(plan_id) || !isValidUUID(new_owner_id)) return json({ error: "Invalid IDs" }, 400);

        const { data: plan } = await supabase
          .from("execution_plans")
          .select("owner_user_id, action_title")
          .eq("id", plan_id)
          .eq("organization_id", organization_id)
          .single();

        if (!plan) return json({ error: "Plan not found" }, 404);

        await supabase.from("execution_plans").update({ owner_user_id: new_owner_id }).eq("id", plan_id);

        await supabase.from("execution_interventions").insert({
          execution_plan_id: plan_id,
          organization_id,
          intervention_type: "reassignment",
          trigger_reason: reason || "Manual reassignment",
          previous_owner: plan.owner_user_id,
          new_owner: new_owner_id,
          auto_triggered: false,
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: userId,
        });

        await supabase.from("execution_events").insert({
          execution_plan_id: plan_id,
          organization_id,
          event_type: "reassigned",
          actor_id: userId,
          metadata: { previous_owner: plan.owner_user_id, new_owner: new_owner_id, reason },
        });

        return json({ success: true });
      }

      case "get_interventions": {
        const { data } = await supabase
          .from("execution_interventions")
          .select("*, execution_plans(action_title, status, priority, deadline)")
          .eq("organization_id", organization_id)
          .order("created_at", { ascending: false })
          .limit(50);

        return json(data || []);
      }

      // ─── EXECUTION SCORING ───
      case "compute_scores": {
        const { data: plans } = await supabase
          .from("execution_plans")
          .select("id, status, deadline, owner_user_id, decision_id, created_at, updated_at")
          .eq("organization_id", organization_id)
          .limit(1000);

        if (!plans || plans.length === 0) return json({ scores: [] });

        const now = new Date();
        const completed = plans.filter(p => p.status === "completed");
        const failed = plans.filter(p => p.status === "failed");
        const total = plans.length;

        const successRate = total > 0 ? completed.length / total : 0;
        const failureRate = total > 0 ? failed.length / total : 0;
        const reliabilityRate = total > 0 ? (completed.length + plans.filter(p => p.status === "cancelled").length) / total : 0;

        // Avg delay for completed plans with deadlines
        const completedWithDeadline = completed.filter(p => p.deadline);
        let avgDelay = 0;
        if (completedWithDeadline.length > 0) {
          const totalDelay = completedWithDeadline.reduce((sum, p) => {
            const deadline = new Date(p.deadline!);
            const completedAt = new Date(p.updated_at);
            const delay = Math.max(0, (completedAt.getTime() - deadline.getTime()) / 86400000);
            return sum + delay;
          }, 0);
          avgDelay = totalDelay / completedWithDeadline.length;
        }

        // Composite score (0-100)
        const score = Math.round(
          (successRate * 40) + 
          ((1 - failureRate) * 25) + 
          (Math.max(0, 1 - avgDelay / 14) * 20) + 
          (reliabilityRate * 15)
        ) * 100 / 100;

        // Upsert org-level score
        const orgScore = {
          organization_id,
          scope_type: "organization",
          scope_id: organization_id,
          score: Math.min(100, Math.max(0, score)),
          reliability_rate: Math.round(reliabilityRate * 100),
          avg_delay_days: Math.round(avgDelay * 10) / 10,
          success_rate: Math.round(successRate * 100),
          failure_rate: Math.round(failureRate * 100),
          plans_evaluated: total,
          scoring_model_version: 1,
          computed_at: now.toISOString(),
        };

        // Delete old and insert fresh
        await supabase.from("execution_scores")
          .delete()
          .eq("organization_id", organization_id)
          .eq("scope_type", "organization")
          .eq("scope_id", organization_id);

        await supabase.from("execution_scores").insert(orgScore);

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
          const uScore = Math.round((uSuccessRate * 50 + (1 - uFailureRate) * 30 + 20) * 100) / 100;

          userScores.push({
            organization_id,
            scope_type: "user",
            scope_id: uid,
            score: Math.min(100, Math.max(0, uScore)),
            success_rate: Math.round(uSuccessRate * 100),
            failure_rate: Math.round(uFailureRate * 100),
            plans_evaluated: uTotal,
            scoring_model_version: 1,
            computed_at: now.toISOString(),
          });
        }

        if (userScores.length > 0) {
          await supabase.from("execution_scores")
            .delete()
            .eq("organization_id", organization_id)
            .eq("scope_type", "user");
          await supabase.from("execution_scores").insert(userScores);
        }

        return json({ org_score: orgScore, user_scores: userScores });
      }

      case "get_scores": {
        const { scope_type } = body;
        let query = supabase
          .from("execution_scores")
          .select("*")
          .eq("organization_id", organization_id)
          .order("computed_at", { ascending: false });

        if (scope_type) query = query.eq("scope_type", scope_type);

        const { data } = await query.limit(50);
        return json(data || []);
      }

      // ─── PREDICTIVE EXECUTION AI ───
      case "predict_risks": {
        const { data: activePlans } = await supabase
          .from("execution_plans")
          .select("id, status, deadline, owner_user_id, priority, action_title, created_at, trigger_config")
          .eq("organization_id", organization_id)
          .in("status", ["pending", "in_progress"])
          .limit(200);

        if (!activePlans || activePlans.length === 0) return json({ predictions: [] });

        // Get historical patterns for risk modeling
        const { data: historicalPlans } = await supabase
          .from("execution_plans")
          .select("status, deadline, priority, created_at, updated_at")
          .eq("organization_id", organization_id)
          .in("status", ["completed", "failed"])
          .limit(500);

        // Compute historical failure rates by priority
        const histByPriority: Record<string, { total: number; failed: number; avgDays: number }> = {};
        for (const hp of historicalPlans || []) {
          const entry = histByPriority[hp.priority] || { total: 0, failed: 0, avgDays: 0 };
          entry.total++;
          if (hp.status === "failed") entry.failed++;
          if (hp.deadline && hp.updated_at) {
            const days = (new Date(hp.updated_at).getTime() - new Date(hp.created_at).getTime()) / 86400000;
            entry.avgDays = (entry.avgDays * (entry.total - 1) + days) / entry.total;
          }
          histByPriority[hp.priority] = entry;
        }

        const now = new Date();
        const predictions: Array<Record<string, unknown>> = [];

        for (const plan of activePlans) {
          const riskFactors: Array<{ factor: string; weight: number }> = [];
          let riskScore = 0;

          // Factor 1: Overdue
          if (plan.deadline) {
            const daysToDeadline = (new Date(plan.deadline).getTime() - now.getTime()) / 86400000;
            if (daysToDeadline < 0) {
              riskScore += 35;
              riskFactors.push({ factor: `Overdue by ${Math.abs(Math.round(daysToDeadline))} days`, weight: 35 });
            } else if (daysToDeadline < 2) {
              riskScore += 20;
              riskFactors.push({ factor: "Deadline imminent (< 2 days)", weight: 20 });
            }
          } else {
            riskScore += 10;
            riskFactors.push({ factor: "No deadline set", weight: 10 });
          }

          // Factor 2: Priority-based historical failure rate
          const hist = histByPriority[plan.priority];
          if (hist && hist.total >= 3) {
            const failRate = hist.failed / hist.total;
            const contribution = Math.round(failRate * 25);
            riskScore += contribution;
            if (contribution > 5) {
              riskFactors.push({ factor: `Historical ${plan.priority} priority failure rate: ${Math.round(failRate * 100)}%`, weight: contribution });
            }
          }

          // Factor 3: No owner assigned
          if (!plan.owner_user_id) {
            riskScore += 15;
            riskFactors.push({ factor: "No owner assigned", weight: 15 });
          }

          // Factor 4: Age of plan (stale plans fail more)
          const ageDays = (now.getTime() - new Date(plan.created_at).getTime()) / 86400000;
          if (ageDays > 14 && plan.status === "pending") {
            riskScore += 20;
            riskFactors.push({ factor: `Pending for ${Math.round(ageDays)} days without starting`, weight: 20 });
          }

          // Factor 5: Critical priority amplifier
          if (plan.priority === "critical") {
            riskScore = Math.min(100, Math.round(riskScore * 1.2));
            riskFactors.push({ factor: "Critical priority amplifier", weight: 5 });
          }

          riskScore = Math.min(100, Math.max(0, riskScore));

          let predictedOutcome = "on_track";
          let recommendation = "No action needed";
          let delayPredicted = 0;

          if (riskScore >= 70) {
            predictedOutcome = "likely_failure";
            recommendation = "Immediate intervention required. Consider reassignment or scope reduction.";
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
            organization_id,
            risk_score: riskScore,
            predicted_outcome: predictedOutcome,
            delay_days_predicted: delayPredicted,
            risk_factors: riskFactors,
            recommendation,
            model_version: 1,
          });
        }

        // Upsert predictions (delete old, insert new)
        const planIds = activePlans.map(p => p.id);
        await supabase.from("execution_predictions").delete().in("execution_plan_id", planIds);
        if (predictions.length > 0) {
          await supabase.from("execution_predictions").insert(predictions);
        }

        return json({ predictions, total: predictions.length });
      }

      case "get_predictions": {
        const { data } = await supabase
          .from("execution_predictions")
          .select("*, execution_plans(action_title, status, priority, deadline, owner_user_id)")
          .eq("organization_id", organization_id)
          .order("risk_score", { ascending: false })
          .limit(100);

        return json(data || []);
      }

      // ─── EXECUTIVE COMMAND SUMMARY ───
      case "command_summary": {
        // Aggregate everything for the executive control layer
        const [
          { data: scores },
          { data: predictions },
          { data: interventions },
          { data: activePlans },
        ] = await Promise.all([
          supabase.from("execution_scores").select("*").eq("organization_id", organization_id).eq("scope_type", "organization").order("computed_at", { ascending: false }).limit(1),
          supabase.from("execution_predictions").select("risk_score, predicted_outcome, execution_plan_id").eq("organization_id", organization_id).order("risk_score", { ascending: false }).limit(100),
          supabase.from("execution_interventions").select("id, intervention_type, resolved").eq("organization_id", organization_id).eq("resolved", false).limit(50),
          supabase.from("execution_plans").select("id, status, priority, decision_id").eq("organization_id", organization_id).in("status", ["pending", "in_progress"]).limit(500),
        ]);

        const orgScore = scores?.[0] || null;
        const atRiskCount = (predictions || []).filter(p => p.predicted_outcome === "at_risk" || p.predicted_outcome === "likely_failure").length;
        const openInterventions = (interventions || []).length;
        const criticalPlans = (activePlans || []).filter(p => p.priority === "critical").length;

        // Cross-decision dependency: group active plans by decision
        const decisionGroups = new Map<string, number>();
        for (const p of activePlans || []) {
          decisionGroups.set(p.decision_id, (decisionGroups.get(p.decision_id) || 0) + 1);
        }
        const multiPlanDecisions = Array.from(decisionGroups.entries())
          .filter(([, count]) => count > 1)
          .map(([decisionId, count]) => ({ decision_id: decisionId, plan_count: count }));

        return json({
          org_score: orgScore,
          at_risk_plans: atRiskCount,
          open_interventions: openInterventions,
          critical_active: criticalPlans,
          total_active: (activePlans || []).length,
          multi_plan_decisions: multiPlanDecisions,
          risk_distribution: {
            likely_failure: (predictions || []).filter(p => p.predicted_outcome === "likely_failure").length,
            at_risk: (predictions || []).filter(p => p.predicted_outcome === "at_risk").length,
            delayed: (predictions || []).filter(p => p.predicted_outcome === "delayed").length,
            on_track: (predictions || []).filter(p => p.predicted_outcome === "on_track").length,
          },
        });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("execution-intelligence error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

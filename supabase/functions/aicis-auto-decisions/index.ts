// AICIS Auto-Decision Pipeline
// Scans new high-risk predictions + high-urgency recommendations from the
// projected AICIS tables and creates pending decisions in decision_ledger.
// Idempotent: skips if a decision already linked to the same source.
//
// Thresholds (Balanced):
//   - Prediction: risk_probability > 0.60
//   - Recommendation: urgency_hours <= 72  (i.e. "act within 3 days")
//
// Auth: requires owner/admin role on the org (decision creation is privileged).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { getGovernanceProfile, approvalChainForModel } from "../_shared/governance-profile.ts";
import { getThreshold } from "../_shared/threshold-registry.ts";
import { recordGovernanceUse, buildGovernanceContext } from "../_shared/governance-audit.ts";

// Phase 6A: defaults only — per-org values come from governance_profiles + governance_thresholds.
const DEFAULT_RISK_THRESHOLD = 0.60;
const DEFAULT_URGENCY_HOURS_THRESHOLD = 72;
const MAX_DECISIONS_PER_RUN = 50;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface AutoRunResult {
  scanned_predictions: number;
  scanned_recommendations: number;
  decisions_created: number;
  skipped_existing: number;
  skipped_below_threshold: number;
  errors: number;
  correlation_id: string;
  duration_ms: number;
}

const log = (level: string, msg: string, ctx: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ level, msg, ts: new Date().toISOString(), ...ctx }));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);
  const json = (d: unknown, s = 200) =>
    new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const correlationId = req.headers.get("x-request-id") || crypto.randomUUID();
  const startedAt = Date.now();

  // ── Parse body first (cron mode needs body) ──
  let body: { organization_id?: string; dry_run?: boolean; cron?: boolean } = {};
  try { body = await req.json(); } catch { /* allow empty */ }

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Cron mode: shared secret bypasses user auth, iterates all orgs ──
  const cronSecretHeader = req.headers.get("x-cron-secret");
  const cronSecretEnv = Deno.env.get("CRON_SHARED_SECRET") ?? Deno.env.get("INGEST_CRON_SECRET");
  const isCronMode = body.cron === true && cronSecretHeader && cronSecretEnv && cronSecretHeader === cronSecretEnv;

  let userId: string;
  let orgsToProcess: string[] = [];
  const dryRun = body.dry_run === true;

  if (isCronMode) {
    userId = "00000000-0000-0000-0000-000000000000"; // system actor
    // Find orgs that actually have AICIS data above thresholds
    const { data: candidateOrgs } = await service
      .from("aicis_predictions")
      .select("organization_id")
      .gte("risk_probability", DEFAULT_RISK_THRESHOLD);
    const set = new Set<string>((candidateOrgs ?? []).map(r => r.organization_id as string));
    const { data: recOrgs } = await service
      .from("aicis_recommendations")
      .select("organization_id")
      .lte("urgency_hours", DEFAULT_URGENCY_HOURS_THRESHOLD);
    for (const r of recOrgs ?? []) set.add(r.organization_id as string);
    orgsToProcess = Array.from(set);
    log("info", "cron_mode_started", { org_count: orgsToProcess.length, correlation_id: correlationId });
  } else {
    // ── User-mode auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    if (!body.organization_id) return json({ error: "organization_id required" }, 400);

    const { data: member } = await service
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", body.organization_id)
      .maybeSingle();

    if (!member || !["owner", "admin"].includes(member.role)) {
      return json({ error: "Forbidden — owner or admin required" }, 403);
    }
    userId = user.id;
    orgsToProcess = [body.organization_id];
  }

  const result: AutoRunResult = {
    scanned_predictions: 0,
    scanned_recommendations: 0,
    decisions_created: 0,
    skipped_existing: 0,
    skipped_below_threshold: 0,
    errors: 0,
    correlation_id: correlationId,
    duration_ms: 0,
  };

  const perOrgResults: Array<{ org_id: string; created: number; skipped: number; errors: number }> = [];

  try {
    for (const orgId of orgsToProcess) {
      const orgRes = { org_id: orgId, created: 0, skipped: 0, errors: 0 };
      try {
        // ── 1. Predictions above risk threshold ──
        const { data: preds, error: predErr } = await service
          .from("aicis_predictions")
          .select("id, external_id, country_iso3, domain, risk_probability, confidence_lower, confidence_upper, horizon_days, evidence_count, generated_at")
          .eq("organization_id", orgId)
          .gte("risk_probability", RISK_THRESHOLD)
          .order("risk_probability", { ascending: false })
          .limit(MAX_DECISIONS_PER_RUN);
        if (predErr) throw new Error(`predictions query failed: ${predErr.message}`);
        result.scanned_predictions += preds?.length ?? 0;

        // ── 2. Recommendations within urgency window ──
        const { data: recs, error: recErr } = await service
          .from("aicis_recommendations")
          .select("id, external_id, country_iso3, domain, intervention_type, intervention_title, rationale_md, urgency_hours, urgency_window, confidence, estimated_cost_eur, estimated_roi_eur, generated_at")
          .eq("organization_id", orgId)
          .lte("urgency_hours", URGENCY_HOURS_THRESHOLD)
          .order("urgency_hours", { ascending: true })
          .limit(MAX_DECISIONS_PER_RUN);
        if (recErr) throw new Error(`recommendations query failed: ${recErr.message}`);
        result.scanned_recommendations += recs?.length ?? 0;

        // ── 3. Existing linkage (idempotency) ──
        const { data: existing } = await service
          .from("decision_ledger")
          .select("linked_aicis_prediction_id, linked_aicis_recommendation_id")
          .eq("organization_id", orgId)
          .or("linked_aicis_prediction_id.not.is.null,linked_aicis_recommendation_id.not.is.null");
        const linkedPredIds = new Set((existing ?? []).map(r => r.linked_aicis_prediction_id).filter(Boolean));
        const linkedRecIds = new Set((existing ?? []).map(r => r.linked_aicis_recommendation_id).filter(Boolean));

        // ── 4. Build decision rows ──
        const toInsert: Record<string, unknown>[] = [];

        for (const p of preds ?? []) {
          if (linkedPredIds.has(p.id)) { result.skipped_existing++; orgRes.skipped++; continue; }
          const country = p.country_iso3 ? ` in ${p.country_iso3}` : "";
          const horizon = p.horizon_days ? ` (${p.horizon_days}d horizon)` : "";
          toInsert.push({
            organization_id: orgId,
            decision_type: "risk_response",
            decision_status: "pending",
            execution_status: "not_started",
            decision_origin: "aicis_auto",
            recommended_action: `Review elevated ${p.domain ?? "risk"} forecast${country}${horizon}`,
            notes: `AICIS predicts ${(Number(p.risk_probability) * 100).toFixed(1)}% risk probability` +
                   (p.confidence_lower != null && p.confidence_upper != null
                     ? ` (CI: ${(Number(p.confidence_lower) * 100).toFixed(0)}–${(Number(p.confidence_upper) * 100).toFixed(0)}%)`
                     : "") +
                   `. Evidence count: ${p.evidence_count ?? "n/a"}.`,
            raw_confidence: p.confidence_upper ? Number(p.confidence_upper) * 100 : null,
            capped_confidence: p.confidence_upper ? Math.min(Number(p.confidence_upper) * 100, 85) : null,
            confidence_at_decision: p.confidence_upper ? Number(p.confidence_upper) * 100 : null,
            confidence_cap_reason: p.confidence_upper && Number(p.confidence_upper) * 100 > 85 ? "ext_data_cap" : null,
            linked_aicis_prediction_id: p.id,
            recommendation_logic_type: "aicis_risk_prediction",
            source_insight_summary: `AICIS prediction ${p.external_id}`,
            evidence_sources: [{
              source_type: "external",
              source_name: "AICIS",
              source_id: p.external_id,
              contribution_weight: 1.0,
              confidence: p.confidence_upper ? Number(p.confidence_upper) * 100 : 60,
              recency_days: p.generated_at
                ? Math.floor((Date.now() - new Date(p.generated_at).getTime()) / 86400000)
                : 0,
            }],
            explanation_metadata: {
              source: "aicis_auto", surface: "predictions",
              risk_probability: Number(p.risk_probability),
              domain: p.domain, country_iso3: p.country_iso3,
              horizon_days: p.horizon_days, evidence_count: p.evidence_count,
              threshold_used: RISK_THRESHOLD, correlation_id: correlationId,
            },
          });
        }

        for (const r of recs ?? []) {
          if (linkedRecIds.has(r.id)) { result.skipped_existing++; orgRes.skipped++; continue; }
          const cost = r.estimated_cost_eur ? `€${Number(r.estimated_cost_eur).toLocaleString()}` : "TBD";
          const roi = r.estimated_roi_eur ? `€${Number(r.estimated_roi_eur).toLocaleString()}` : "TBD";
          toInsert.push({
            organization_id: orgId,
            decision_type: "intervention",
            decision_status: "pending",
            execution_status: "not_started",
            decision_origin: "aicis_auto",
            recommended_action: r.intervention_title ?? `Execute ${r.intervention_type ?? "intervention"}`,
            notes: `${r.rationale_md ?? ""}\n\n— Estimated cost: ${cost} · Estimated ROI: ${roi} · Window: ${r.urgency_window ?? `${r.urgency_hours}h`}`.trim(),
            raw_confidence: r.confidence != null ? Number(r.confidence) * 100 : null,
            capped_confidence: r.confidence != null ? Math.min(Number(r.confidence) * 100, 85) : null,
            confidence_at_decision: r.confidence != null ? Number(r.confidence) * 100 : null,
            confidence_cap_reason: r.confidence != null && Number(r.confidence) * 100 > 85 ? "ext_data_cap" : null,
            linked_aicis_recommendation_id: r.id,
            recommendation_logic_type: "aicis_recommendation",
            source_insight_summary: `AICIS recommendation ${r.external_id}`,
            predicted_net_impact: r.estimated_roi_eur ? Number(r.estimated_roi_eur) - Number(r.estimated_cost_eur ?? 0) : null,
            evidence_sources: [{
              source_type: "external",
              source_name: "AICIS",
              source_id: r.external_id,
              contribution_weight: 1.0,
              confidence: r.confidence != null ? Number(r.confidence) * 100 : 60,
              recency_days: r.generated_at
                ? Math.floor((Date.now() - new Date(r.generated_at).getTime()) / 86400000)
                : 0,
            }],
            explanation_metadata: {
              source: "aicis_auto", surface: "recommendations",
              intervention_type: r.intervention_type,
              urgency_hours: r.urgency_hours, urgency_window: r.urgency_window,
              domain: r.domain, country_iso3: r.country_iso3,
              estimated_cost_eur: r.estimated_cost_eur,
              estimated_roi_eur: r.estimated_roi_eur,
              threshold_used: URGENCY_HOURS_THRESHOLD,
              correlation_id: correlationId,
            },
          });
        }

        if (dryRun) {
          orgRes.created = toInsert.length; // would-be
          perOrgResults.push(orgRes);
          continue;
        }

        // ── 5. Bulk insert ──
        if (toInsert.length > 0) {
          const CHUNK = 25;
          for (let i = 0; i < toInsert.length; i += CHUNK) {
            const slice = toInsert.slice(i, i + CHUNK);
            const { data: inserted, error: insErr } = await service
              .from("decision_ledger").insert(slice).select("id");
            if (insErr) {
              log("error", "decision_insert_failed", { org_id: orgId, err: insErr.message, chunk_size: slice.length });
              result.errors += slice.length; orgRes.errors += slice.length;
            } else {
              const n = inserted?.length ?? 0;
              result.decisions_created += n; orgRes.created += n;
            }
          }
        }

        // ── 6. Audit log ──
        await service.from("audit_log").insert({
          organization_id: orgId,
          actor_id: isCronMode ? null : userId,
          actor_type: isCronMode ? "system" : "user",
          action_type: "aicis_auto_decisions_run",
          resource_type: "decision_ledger",
          resource_id: correlationId,
          payload: {
            cron: isCronMode,
            scanned_predictions: preds?.length ?? 0,
            scanned_recommendations: recs?.length ?? 0,
            decisions_created: orgRes.created,
            skipped_existing: orgRes.skipped,
            errors: orgRes.errors,
            risk_threshold: RISK_THRESHOLD,
            urgency_threshold_hours: URGENCY_HOURS_THRESHOLD,
          },
        });

        perOrgResults.push(orgRes);
      } catch (orgErr: unknown) {
        const msg = orgErr instanceof Error ? orgErr.message : String(orgErr);
        log("error", "org_failed", { org_id: orgId, err: msg, correlation_id: correlationId });
        result.errors += 1;
        orgRes.errors += 1;
        perOrgResults.push(orgRes);
      }
    }

    result.duration_ms = Date.now() - startedAt;
    log("info", "aicis_auto_decisions_done", { ...result, orgs: perOrgResults.length, cron: isCronMode });
    return json({ ...result, dry_run: dryRun, per_org: perOrgResults });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    result.duration_ms = Date.now() - startedAt;
    log("error", "aicis_auto_decisions_failed", { err: msg, correlation_id: correlationId });
    return json({ error: msg, ...result }, 500);
  }
});

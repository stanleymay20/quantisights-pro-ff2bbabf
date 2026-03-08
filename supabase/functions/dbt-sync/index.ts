import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-request-id",
};

/**
 * dbt Model Sync Endpoint
 * 
 * Accepts dbt manifest.json or run_results.json artifacts and syncs model metadata,
 * test results, and freshness checks into Quantivis for data quality monitoring.
 * 
 * POST /dbt-sync
 * Body: { artifact_type: "manifest" | "run_results" | "sources", artifact: {...}, organization_id }
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceKey);

  const respond = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    // Auth: JWT or API key
    const authHeader = req.headers.get("authorization");
    const apiKey = req.headers.get("x-api-key");
    let orgId: string | null = null;

    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await userClient.auth.getUser();
      if (error || !user) return respond({ error: "Unauthorized" }, 401);
      const { data: profile } = await svc.from("profiles").select("organization_id").eq("user_id", user.id).maybeSingle();
      orgId = profile?.organization_id;
    } else if (apiKey) {
      const encoded = new TextEncoder().encode(apiKey);
      const hash = await crypto.subtle.digest("SHA-256", encoded);
      const keyHash = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
      const { data: source } = await svc.from("data_sources")
        .select("id, organization_id")
        .eq("credentials_key_hash", keyHash)
        .eq("status", "active")
        .maybeSingle();
      if (!source) return respond({ error: "Invalid API key" }, 401);
      orgId = source.organization_id;
    } else {
      return respond({ error: "Authorization or x-api-key required" }, 401);
    }

    if (!orgId) return respond({ error: "Organization not found" }, 403);

    const body = await req.json();
    const { artifact_type, artifact } = body;

    if (!artifact_type || !artifact) {
      return respond({ error: "artifact_type and artifact required" }, 400);
    }

    const results: any = { artifact_type, processed_at: new Date().toISOString() };

    switch (artifact_type) {
      case "manifest": {
        // Parse dbt manifest.json — extract model metadata
        const nodes = artifact.nodes || {};
        const sources = artifact.sources || {};
        const models: any[] = [];

        for (const [key, node] of Object.entries(nodes) as [string, any][]) {
          if (node.resource_type !== "model") continue;
          models.push({
            model_name: node.name,
            schema: node.schema,
            database: node.database,
            materialization: node.config?.materialized || "view",
            description: node.description || null,
            columns: Object.keys(node.columns || {}),
            tags: node.tags || [],
            depends_on: node.depends_on?.nodes || [],
            path: node.path,
          });
        }

        // Store as data quality check for lineage tracking
        await svc.from("data_quality_checks").insert({
          organization_id: orgId,
          check_type: "dbt_manifest_sync",
          status: "completed",
          score: 100,
          records_checked: models.length,
          details: {
            models,
            sources_count: Object.keys(sources).length,
            dbt_version: artifact.metadata?.dbt_version,
            generated_at: artifact.metadata?.generated_at,
          },
        });

        results.models_synced = models.length;
        results.sources_found = Object.keys(sources).length;
        break;
      }

      case "run_results": {
        // Parse dbt run_results.json — extract test/run outcomes
        const runResults = artifact.results || [];
        let passed = 0, failed = 0, errored = 0, skipped = 0;
        const failures: any[] = [];

        for (const result of runResults) {
          switch (result.status) {
            case "pass": passed++; break;
            case "fail": failed++; failures.push({ node: result.unique_id, message: result.message }); break;
            case "error": errored++; failures.push({ node: result.unique_id, message: result.message }); break;
            case "skip": skipped++; break;
          }
        }

        const score = runResults.length > 0
          ? Math.round((passed / runResults.length) * 100)
          : 0;

        await svc.from("data_quality_checks").insert({
          organization_id: orgId,
          check_type: "dbt_run_results",
          status: failed > 0 || errored > 0 ? "warning" : "completed",
          score,
          records_checked: runResults.length,
          records_failed: failed + errored,
          details: {
            passed, failed, errored, skipped,
            failures: failures.slice(0, 20),
            elapsed_time: artifact.elapsed_time,
            generated_at: artifact.metadata?.generated_at,
          },
        });

        // Alert on failures
        if (failed > 0 || errored > 0) {
          await svc.from("audit_log").insert({
            organization_id: orgId,
            actor_type: "system",
            action_type: "dbt_test_failure",
            resource_type: "data_quality",
            payload: { failed, errored, failures: failures.slice(0, 5) },
          });
        }

        results.total = runResults.length;
        results.passed = passed;
        results.failed = failed;
        results.errored = errored;
        results.score = score;
        break;
      }

      case "sources": {
        // Parse dbt source freshness results
        const sourceResults = artifact.results || [];
        const freshness: any[] = [];

        for (const src of sourceResults) {
          freshness.push({
            source: src.unique_id,
            status: src.status,
            max_loaded_at: src.max_loaded_at,
            snapshotted_at: src.snapshotted_at,
            criteria: src.criteria,
          });
        }

        const staleCount = sourceResults.filter((s: any) => s.status === "error" || s.status === "warn").length;
        const score = sourceResults.length > 0
          ? Math.round(((sourceResults.length - staleCount) / sourceResults.length) * 100)
          : 0;

        await svc.from("data_quality_checks").insert({
          organization_id: orgId,
          check_type: "dbt_source_freshness",
          status: staleCount > 0 ? "warning" : "completed",
          score,
          records_checked: sourceResults.length,
          records_failed: staleCount,
          details: { freshness, stale_sources: staleCount },
        });

        results.sources_checked = sourceResults.length;
        results.stale = staleCount;
        results.score = score;
        break;
      }

      default:
        return respond({ error: `Unknown artifact_type: ${artifact_type}. Supported: manifest, run_results, sources` }, 400);
    }

    return respond({ success: true, ...results });
  } catch (err: unknown) {
    console.error("dbt-sync error:", err);
    return respond({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

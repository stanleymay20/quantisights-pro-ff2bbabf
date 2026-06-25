import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

const PUBLIC_JOBS = new Set([
  "evaluate-outcomes",
  "adaptive-calibration",
  "refresh-aggregates",
  "compute-rollups",
  "retention-cleanup",
  "weekly-calibration-digest",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from("cron_run_log")
    .select("job_name,status,started_at,completed_at,duration_ms,error_message,records_processed")
    .in("job_name", [...PUBLIC_JOBS])
    .order("started_at", { ascending: false })
    .limit(60);

  if (error) {
    return new Response(
      JSON.stringify({ error: "scheduler_evidence_unavailable" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } },
    );
  }

  return new Response(
    JSON.stringify({ generated_at: new Date().toISOString(), jobs: data ?? [] }),
    { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=30" } },
  );
});

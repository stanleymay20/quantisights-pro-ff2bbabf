/**
 * Active Data Contract enforcement for Edge Functions.
 * Validates dataset_id is present, belongs to the org, and optionally supports dry_run mode.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export interface DatasetContractResult {
  valid: boolean;
  dataset_id: string;
  organization_id: string;
  dry_run: boolean;
  response?: Response;
}

/**
 * Enforces that dataset_id is present in the request body and belongs to the given organization.
 * If dry_run is true, returns a validation-only response without executing the function logic.
 */
export async function enforceDatasetContract(
  body: Record<string, unknown>,
  serviceClient: { from: (table: string) => any },
): Promise<DatasetContractResult> {
  const { organization_id, dataset_id, dry_run } = body;

  if (!organization_id) {
    return {
      valid: false,
      dataset_id: "",
      organization_id: "",
      dry_run: false,
      response: new Response(
        JSON.stringify({ error: "organization_id required by Active Data Contract" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  if (!dataset_id) {
    return {
      valid: false,
      dataset_id: "",
      organization_id: organization_id as string,
      dry_run: false,
      response: new Response(
        JSON.stringify({ error: "dataset_id required by Active Data Contract" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  // Verify dataset belongs to org
  const { data: ds, error: dsErr } = await serviceClient
    .from("datasets")
    .select("id, organization_id")
    .eq("id", dataset_id)
    .eq("organization_id", organization_id)
    .maybeSingle();

  if (dsErr || !ds) {
    return {
      valid: false,
      dataset_id: dataset_id as string,
      organization_id: organization_id as string,
      dry_run: false,
      response: new Response(
        JSON.stringify({ error: "dataset_id does not belong to this organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  if (dry_run) {
    return {
      valid: true,
      dataset_id: dataset_id as string,
      organization_id: organization_id as string,
      dry_run: true,
      response: new Response(
        JSON.stringify({
          dry_run: true,
          status: "PASS",
          dataset_id,
          organization_id,
          message: "Active Data Contract validated: dataset_id belongs to organization",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  return {
    valid: true,
    dataset_id: dataset_id as string,
    organization_id: organization_id as string,
    dry_run: false,
  };
}

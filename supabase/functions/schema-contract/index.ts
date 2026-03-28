import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

/**
 * Schema Contract Enforcement Engine
 * 
 * Define expected schemas for data sources and validate incoming data against them.
 * Supports: create/update contracts, validate payloads, list violations.
 * 
 * POST /schema-contract
 * Body: { action: "create" | "validate" | "list" | "violations", ... }
 */

interface SchemaField {
  name: string;
  type: "string" | "number" | "date" | "boolean" | "enum";
  required: boolean;
  min?: number;
  max?: number;
  enum_values?: string[];
  pattern?: string;
  description?: string;
}

interface SchemaContract {
  name: string;
  version: number;
  fields: SchemaField[];
  strict_mode: boolean; // reject unknown fields
  min_records?: number;
  max_records?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceKey);

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return respond({ error: "Authorization required" }, 401);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return respond({ error: "Unauthorized" }, 401);

    const { data: profile } = await svc.from("profiles").select("organization_id").eq("user_id", user.id).maybeSingle();
    if (!profile?.organization_id) return respond({ error: "Organization not found" }, 403);
    const orgId = profile.organization_id;

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "create": {
        const { name, data_source_id, fields, strict_mode, min_records, max_records } = body;
        if (!name || !fields || !Array.isArray(fields)) {
          return respond({ error: "name and fields[] required" }, 400);
        }

        // Store contract as data quality check with type schema_contract
        const contract: SchemaContract = {
          name,
          version: 1,
          fields,
          strict_mode: strict_mode ?? false,
          min_records,
          max_records,
        };

        await svc.from("data_quality_checks").insert({
          organization_id: orgId,
          dataset_id: data_source_id || null,
          check_type: "schema_contract",
          status: "completed",
          score: 100,
          details: {
            contract,
            created_by: user.id,
            created_at: new Date().toISOString(),
          },
        });

        return respond({ success: true, contract });
      }

      case "validate": {
        const { contract_name, records } = body;
        if (!contract_name || !records) return respond({ error: "contract_name and records required" }, 400);

        // Find latest contract
        const { data: checks } = await svc.from("data_quality_checks")
          .select("details")
          .eq("organization_id", orgId)
          .eq("check_type", "schema_contract")
          .order("created_at", { ascending: false })
          .limit(50);

        const contractCheck = checks?.find((c: any) => c.details?.contract?.name === contract_name);
        if (!contractCheck) return respond({ error: `Contract "${contract_name}" not found` }, 404);

        const contract = (contractCheck.details as any).contract as SchemaContract;
        const violations: any[] = [];
        const recordArray = Array.isArray(records) ? records : [records];

        // Record count validation
        if (contract.min_records && recordArray.length < contract.min_records) {
          violations.push({ type: "min_records", message: `Expected at least ${contract.min_records} records, got ${recordArray.length}` });
        }
        if (contract.max_records && recordArray.length > contract.max_records) {
          violations.push({ type: "max_records", message: `Expected at most ${contract.max_records} records, got ${recordArray.length}` });
        }

        // Per-record validation
        for (let i = 0; i < Math.min(recordArray.length, 1000); i++) {
          const record = recordArray[i];
          const recordKeys = Object.keys(record);

          // Check strict mode (no unknown fields)
          if (contract.strict_mode) {
            const knownFields = new Set(contract.fields.map(f => f.name));
            for (const key of recordKeys) {
              if (!knownFields.has(key)) {
                violations.push({ record: i, field: key, type: "unknown_field", message: `Unknown field "${key}" in strict mode` });
              }
            }
          }

          // Validate each field
          for (const field of contract.fields) {
            const val = record[field.name];

            if (field.required && (val === undefined || val === null || val === "")) {
              violations.push({ record: i, field: field.name, type: "missing_required", message: `Required field "${field.name}" is missing` });
              continue;
            }

            if (val === undefined || val === null) continue;

            switch (field.type) {
              case "number": {
                const num = parseFloat(val);
                if (isNaN(num)) {
                  violations.push({ record: i, field: field.name, type: "type_mismatch", message: `Expected number, got "${val}"` });
                } else {
                  if (field.min !== undefined && num < field.min) {
                    violations.push({ record: i, field: field.name, type: "range", message: `Value ${num} below minimum ${field.min}` });
                  }
                  if (field.max !== undefined && num > field.max) {
                    violations.push({ record: i, field: field.name, type: "range", message: `Value ${num} above maximum ${field.max}` });
                  }
                }
                break;
              }
              case "date": {
                if (isNaN(Date.parse(String(val)))) {
                  violations.push({ record: i, field: field.name, type: "type_mismatch", message: `Invalid date: "${val}"` });
                }
                break;
              }
              case "enum": {
                if (field.enum_values && !field.enum_values.includes(String(val))) {
                  violations.push({ record: i, field: field.name, type: "enum_violation", message: `"${val}" not in allowed values: ${field.enum_values.join(", ")}` });
                }
                break;
              }
              case "boolean": {
                if (typeof val !== "boolean" && !["true", "false", "0", "1"].includes(String(val).toLowerCase())) {
                  violations.push({ record: i, field: field.name, type: "type_mismatch", message: `Expected boolean, got "${val}"` });
                }
                break;
              }
              case "string": {
                if (field.pattern) {
                  try {
                    if (!new RegExp(field.pattern).test(String(val))) {
                      violations.push({ record: i, field: field.name, type: "pattern", message: `Value "${val}" doesn't match pattern /${field.pattern}/` });
                    }
                  } catch { /* skip invalid regex */ }
                }
                break;
              }
            }
          }
        }

        const isValid = violations.length === 0;
        const score = recordArray.length > 0
          ? Math.max(0, Math.round(100 - (violations.length / recordArray.length) * 100))
          : 0;

        // Log validation result
        await svc.from("data_quality_checks").insert({
          organization_id: orgId,
          check_type: "schema_validation",
          status: isValid ? "completed" : "warning",
          score,
          records_checked: recordArray.length,
          records_failed: violations.length,
          details: {
            contract_name,
            contract_version: contract.version,
            violations: violations.slice(0, 100),
            total_violations: violations.length,
          },
        });

        return respond({
          valid: isValid,
          score,
          records_checked: recordArray.length,
          violation_count: violations.length,
          violations: violations.slice(0, 50),
        });
      }

      case "list": {
        const { data: checks } = await svc.from("data_quality_checks")
          .select("details, created_at")
          .eq("organization_id", orgId)
          .eq("check_type", "schema_contract")
          .order("created_at", { ascending: false })
          .limit(50);

        const contracts = (checks || []).map((c: any) => ({
          ...c.details?.contract,
          created_at: c.details?.created_at || c.created_at,
          created_by: c.details?.created_by,
        }));

        return respond({ contracts });
      }

      case "violations": {
        const { data: checks } = await svc.from("data_quality_checks")
          .select("*")
          .eq("organization_id", orgId)
          .eq("check_type", "schema_validation")
          .order("created_at", { ascending: false })
          .limit(20);

        return respond({ validations: checks || [] });
      }

      default:
        return respond({ error: `Unknown action: ${action}. Supported: create, validate, list, violations` }, 400);
    }
  } catch (err: unknown) {
    console.error("schema-contract error:", err);
    return respond({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

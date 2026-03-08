import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ConnectorRequest {
  action: "test" | "discover" | "preview" | "sync";
  connector_config_id?: string;
  organization_id: string;
  // For test/create
  host?: string;
  port?: number;
  database_name?: string;
  schema_name?: string;
  username?: string;
  password?: string;
  ssl_mode?: string;
  connector_type?: string;
  // For sync
  data_source_id?: string;
  selected_tables?: string[];
  metric_mappings?: Array<{
    source_table: string;
    source_column: string;
    metric_type: string;
    date_column: string;
    aggregation?: string;
  }>;
}

// ─── PostgreSQL via Deno postgres ───
async function pgConnect(config: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}) {
  // Use the postgres npm package available in Deno
  const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");

  const sql = postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: 1,
    idle_timeout: 10,
    connect_timeout: 15,
  });

  return sql;
}

async function testConnection(config: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}): Promise<{ success: boolean; message: string; version?: string }> {
  let sql: any;
  try {
    sql = await pgConnect(config);
    const result = await sql`SELECT version()`;
    const version = result[0]?.version || "Connected";
    await sql.end();
    return { success: true, message: "Connection successful", version };
  } catch (err: unknown) {
    try { if (sql) await sql.end(); } catch {}
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Connection failed: ${msg}` };
  }
}

async function discoverSchema(config: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  schema: string;
}): Promise<{ tables: Array<{ table_name: string; columns: Array<{ column_name: string; data_type: string; is_nullable: string }>; row_count: number }> }> {
  let sql: any;
  try {
    sql = await pgConnect(config);

    // Get tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ${config.schema} 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
      LIMIT 100
    `;

    const result: any[] = [];

    for (const t of tables) {
      const columns = await sql`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = ${config.schema} 
          AND table_name = ${t.table_name}
        ORDER BY ordinal_position
      `;

      // Get approximate row count
      const countResult = await sql`
        SELECT reltuples::bigint AS estimate
        FROM pg_class
        WHERE relname = ${t.table_name}
      `;
      const rowCount = Number(countResult[0]?.estimate || 0);

      result.push({
        table_name: t.table_name,
        columns: columns.map((c: any) => ({
          column_name: c.column_name,
          data_type: c.data_type,
          is_nullable: c.is_nullable,
        })),
        row_count: Math.max(0, rowCount),
      });
    }

    await sql.end();
    return { tables: result };
  } catch (err: unknown) {
    try { if (sql) await sql.end(); } catch {}
    throw err;
  }
}

async function previewTable(config: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  schema: string;
}, tableName: string): Promise<{ rows: any[]; count: number }> {
  let sql: any;
  try {
    sql = await pgConnect(config);
    // Sanitize table name
    const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, "");
    const safeSchema = config.schema.replace(/[^a-zA-Z0-9_]/g, "");
    
    const rows = await sql.unsafe(`SELECT * FROM "${safeSchema}"."${safeTable}" LIMIT 25`);
    const countResult = await sql.unsafe(`SELECT COUNT(*) as total FROM "${safeSchema}"."${safeTable}"`);
    const count = Number(countResult[0]?.total || 0);

    await sql.end();
    return { rows: Array.from(rows), count };
  } catch (err: unknown) {
    try { if (sql) await sql.end(); } catch {}
    throw err;
  }
}

async function syncData(
  config: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
    schema: string;
  },
  mappings: Array<{
    source_table: string;
    source_column: string;
    metric_type: string;
    date_column: string;
    aggregation?: string;
  }>,
  organizationId: string,
  dataSourceId: string,
  serviceClient: any,
): Promise<{ records: number; errors: string[] }> {
  let sql: any;
  const errors: string[] = [];
  const metrics: any[] = [];

  try {
    sql = await pgConnect(config);
    const safeSchema = config.schema.replace(/[^a-zA-Z0-9_]/g, "");

    for (const mapping of mappings) {
      try {
        const safeTable = mapping.source_table.replace(/[^a-zA-Z0-9_]/g, "");
        const safeCol = mapping.source_column.replace(/[^a-zA-Z0-9_]/g, "");
        const safeDateCol = mapping.date_column.replace(/[^a-zA-Z0-9_]/g, "");
        const agg = mapping.aggregation || "sum";

        // Validate aggregation
        const allowedAgg = ["sum", "avg", "count", "min", "max"];
        const safeAgg = allowedAgg.includes(agg) ? agg : "sum";

        // Fetch aggregated data by date
        const query = `
          SELECT 
            DATE_TRUNC('month', "${safeDateCol}"::timestamp)::date as period,
            ${safeAgg}("${safeCol}"::numeric) as value
          FROM "${safeSchema}"."${safeTable}"
          WHERE "${safeDateCol}" IS NOT NULL AND "${safeCol}" IS NOT NULL
          GROUP BY DATE_TRUNC('month', "${safeDateCol}"::timestamp)
          ORDER BY period
          LIMIT 10000
        `;

        const rows = await sql.unsafe(query);

        for (const row of rows) {
          if (row.period && row.value != null) {
            const dateStr = new Date(row.period).toISOString().split("T")[0];
            metrics.push({
              organization_id: organizationId,
              metric_type: mapping.metric_type,
              value: Number(row.value),
              date: dateStr,
              source_type: "connector",
              source_id: dataSourceId,
              quality_score: 90,
            });
          }
        }
      } catch (err: unknown) {
        errors.push(`Table ${mapping.source_table}.${mapping.source_column}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await sql.end();
  } catch (err: unknown) {
    try { if (sql) await sql.end(); } catch {}
    errors.push(`Connection error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Insert metrics
  if (metrics.length > 0) {
    for (let i = 0; i < metrics.length; i += 500) {
      const batch = metrics.slice(i, i + 500);
      const { error } = await serviceClient.from("metrics").upsert(batch, {
        onConflict: "organization_id,metric_type,date,source_id",
        ignoreDuplicates: false,
      });
      if (error) errors.push(`DB upsert batch ${i}: ${error.message}`);
    }
  }

  // Update last_synced_at
  if (dataSourceId) {
    await serviceClient.from("data_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", dataSourceId);
  }

  return { records: metrics.length, errors };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body: ConnectorRequest = await req.json();
    const { action, organization_id } = body;

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build connection config
    let connConfig: any;

    if (body.connector_config_id) {
      // Fetch from DB
      const { data: cc, error: ccErr } = await serviceClient
        .from("connector_configs")
        .select("*")
        .eq("id", body.connector_config_id)
        .eq("organization_id", organization_id)
        .single();
      if (ccErr || !cc) {
        return new Response(JSON.stringify({ error: "Connector config not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      connConfig = {
        host: cc.host,
        port: cc.port || 5432,
        database: cc.database_name,
        user: cc.username,
        password: body.password || "",
        ssl: (cc.ssl_mode || "require") !== "disable",
        schema: cc.schema_name || "public",
      };
    } else {
      connConfig = {
        host: body.host || "",
        port: body.port || 5432,
        database: body.database_name || "",
        user: body.username || "",
        password: body.password || "",
        ssl: (body.ssl_mode || "require") !== "disable",
        schema: body.schema_name || "public",
      };
    }

    // Route action
    switch (action) {
      case "test": {
        const result = await testConnection(connConfig);

        // If test passes and connector_config_id exists, update status
        if (result.success && body.connector_config_id) {
          await serviceClient.from("connector_configs").update({
            connection_status: "connected",
            last_tested_at: new Date().toISOString(),
          }).eq("id", body.connector_config_id);
        }

        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "discover": {
        const schema = await discoverSchema(connConfig);

        // Store discovered schema if config exists
        if (body.connector_config_id) {
          await serviceClient.from("connector_configs").update({
            discovered_schema: schema,
            connection_status: "connected",
          }).eq("id", body.connector_config_id);
        }

        return new Response(JSON.stringify(schema), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "preview": {
        if (!body.selected_tables?.[0]) {
          return new Response(JSON.stringify({ error: "selected_tables[0] required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const preview = await previewTable(connConfig, body.selected_tables[0]);
        return new Response(JSON.stringify(preview), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "sync": {
        if (!body.metric_mappings?.length) {
          return new Response(JSON.stringify({ error: "metric_mappings required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (!body.data_source_id) {
          return new Response(JSON.stringify({ error: "data_source_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Create sync job
        const { data: syncJob } = await serviceClient.from("data_sync_jobs").insert({
          data_source_id: body.data_source_id,
          organization_id,
          status: "running",
          started_at: new Date().toISOString(),
        }).select("id").single();

        const result = await syncData(connConfig, body.metric_mappings, organization_id, body.data_source_id, serviceClient);

        // Update sync job
        if (syncJob?.id) {
          await serviceClient.from("data_sync_jobs").update({
            status: result.errors.length > 0 && result.records === 0 ? "failed" : "completed",
            records_synced: result.records,
            error_message: result.errors.length > 0 ? result.errors.join("; ") : null,
            completed_at: new Date().toISOString(),
          }).eq("id", syncJob.id);
        }

        // Log to audit
        await serviceClient.from("audit_log").insert({
          organization_id,
          actor_id: user.id,
          actor_type: "user",
          action_type: "data_sync",
          resource_type: "data_source",
          resource_id: body.data_source_id,
          payload: { records: result.records, errors_count: result.errors.length, connector_type: body.connector_type || "postgresql" },
        });

        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err: unknown) {
    console.error("db-connector error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

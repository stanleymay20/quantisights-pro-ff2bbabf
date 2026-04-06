import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarMobileToggle } from "@/components/layout/ProtectedShell";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Database, Server, Cloud, FileSpreadsheet, Plus, Check, X,
  RefreshCw, ArrowRight, ArrowLeft, Eye, Loader2, Shield,
  Table2, Columns3, Zap, Clock, AlertCircle, CheckCircle2,
  Cable, Plug, TestTube, Layers, Link2, BarChart3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───
type ConnectorType = "postgresql" | "mysql" | "sqlserver" | "snowflake" | "bigquery" | "powerbi" | "csv";
type WizardStep = "select" | "credentials" | "testing" | "schema" | "tables" | "mapping" | "schedule" | "syncing" | "done";

interface ConnectorDef {
  type: ConnectorType;
  label: string;
  icon: React.ElementType;
  description: string;
  category: "database" | "warehouse" | "bi" | "file";
  defaultPort?: string;
}

interface DiscoveredTable {
  table_name: string;
  columns: Array<{ column_name: string; data_type: string; is_nullable: string }>;
  row_count: number;
}

interface MetricMapping {
  source_table: string;
  source_column: string;
  metric_type: string;
  date_column: string;
  aggregation: string;
}

const CONNECTORS: ConnectorDef[] = [
  { type: "postgresql", label: "PostgreSQL", icon: Database, description: "Connect to any PostgreSQL database", category: "database", defaultPort: "5432" },
  { type: "mysql", label: "MySQL", icon: Database, description: "Connect to MySQL / MariaDB databases", category: "database", defaultPort: "3306" },
  { type: "sqlserver", label: "SQL Server", icon: Server, description: "Microsoft SQL Server connection", category: "database", defaultPort: "1433" },
  { type: "snowflake", label: "Snowflake", icon: Cloud, description: "Snowflake cloud data warehouse", category: "warehouse" },
  { type: "bigquery", label: "BigQuery", icon: Cloud, description: "Google BigQuery datasets", category: "warehouse" },
  { type: "powerbi", label: "Power BI", icon: BarChart3, description: "Microsoft Power BI datasets", category: "bi" },
  { type: "csv", label: "CSV Upload", icon: FileSpreadsheet, description: "Upload CSV files (demo/testing)", category: "file" },
];

const METRIC_TYPES = [
  "revenue", "cost", "customers", "churn", "retention", "conversion_rate",
  "mrr", "arr", "headcount", "deals", "pipeline", "support_tickets",
  "sessions", "users", "orders", "refunds", "margin", "custom",
];

const AGGREGATIONS = ["sum", "avg", "count", "min", "max"];

// ─── Connector-specific credential fields ───
interface ConnectorCredentials {
  // Common DB fields
  host: string;
  port: string;
  dbName: string;
  schemaName: string;
  username: string;
  password: string;
  sslMode: string;
  // Snowflake
  account: string;
  warehouse: string;
  role: string;
  // BigQuery
  projectId: string;
  datasetId: string;
  serviceAccountJson: string;
  // Power BI
  tenantId: string;
  clientId: string;
  clientSecret: string;
  workspaceId: string;
}

const defaultCredentials: ConnectorCredentials = {
  host: "", port: "5432", dbName: "", schemaName: "public",
  username: "", password: "", sslMode: "require",
  account: "", warehouse: "COMPUTE_WH", role: "PUBLIC",
  projectId: "", datasetId: "", serviceAccountJson: "",
  tenantId: "", clientId: "", clientSecret: "", workspaceId: "",
};

// ─── Component ───
const DataConnectors = () => {
  const { user } = useAuth();
  const { currentOrgId } = useOrganization();
  const { currentWorkspaceId } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<WizardStep>("select");
  const [selectedType, setSelectedType] = useState<ConnectorType | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [creds, setCreds] = useState<ConnectorCredentials>({ ...defaultCredentials });

  const [testResult, setTestResult] = useState<{ success: boolean; message: string; version?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const [tables, setTables] = useState<DiscoveredTable[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<{ rows: any[]; count: number } | null>(null);
  const [previewTable, setPreviewTable] = useState<string | null>(null);

  const [mappings, setMappings] = useState<MetricMapping[]>([]);
  const [syncFrequency, setSyncFrequency] = useState("daily");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ records: number; errors: string[] } | null>(null);

  const [dataSourceId, setDataSourceId] = useState<string | null>(null);
  const [existingConnectors, setExistingConnectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOrgId) fetchExisting();
  }, [currentOrgId]);

  const fetchExisting = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    const { data } = await (supabase.from("connector_configs") as any)
      .select("*, data_sources(*)")
      .eq("organization_id", currentOrgId)
      .order("created_at", { ascending: false });
    setExistingConnectors(data || []);
    setLoading(false);
  };

  const getAuthHeaders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data: { session } } = await supabase.auth.getSession();
    return {
      Authorization: `Bearer ${session?.access_token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
  };

  const updateCred = (field: keyof ConnectorCredentials, value: string) => {
    setCreds(prev => ({ ...prev, [field]: value }));
  };

  const buildConnectorPayload = () => {
    const base: any = {
      organization_id: currentOrgId,
      connector_type: selectedType,
    };

    switch (selectedType) {
      case "postgresql":
      case "mysql":
      case "sqlserver":
        return {
          ...base,
          host: creds.host, port: parseInt(creds.port),
          database_name: creds.dbName, schema_name: creds.schemaName,
          username: creds.username, password: creds.password, ssl_mode: creds.sslMode,
        };
      case "snowflake":
        return {
          ...base,
          account: creds.account, warehouse: creds.warehouse,
          database_name: creds.dbName, schema_name: creds.schemaName,
          username: creds.username, password: creds.password, role: creds.role,
        };
      case "bigquery":
        return {
          ...base,
          project_id: creds.projectId, dataset_id: creds.datasetId,
          service_account_json: creds.serviceAccountJson,
        };
      case "powerbi":
        return {
          ...base,
          tenant_id: creds.tenantId, client_id: creds.clientId,
          client_secret: creds.clientSecret, workspace_id: creds.workspaceId,
        };
      default:
        return base;
    }
  };

  const handleSelectConnector = (type: ConnectorType) => {
    if (type === "csv") {
      navigate("/data-upload");
      return;
    }
    setSelectedType(type);
    const def = CONNECTORS.find(c => c.type === type)!;
    setSourceName(`${def.label} Connection`);
    setCreds({ ...defaultCredentials, port: def.defaultPort || "5432" });
    setStep("credentials");
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/db-connector`,
        { method: "POST", headers, body: JSON.stringify({ action: "test", ...buildConnectorPayload() }) }
      );
      const data = await res.json();
      setTestResult(data);
      if (data.success) setStep("testing");
    } catch (err: unknown) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setTesting(false);
    }
  };

  const handleDiscoverSchema = async () => {
    setDiscovering(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/db-connector`,
        { method: "POST", headers, body: JSON.stringify({ action: "discover", ...buildConnectorPayload() }) }
      );
      const data = await res.json();
      setTables(data.tables || []);
      setStep("schema");
    } catch (err: unknown) {
      toast({ title: "Schema discovery failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setDiscovering(false);
    }
  };

  const handlePreviewTable = async (tableName: string) => {
    setPreviewTable(tableName);
    setPreviewData(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/db-connector`,
        { method: "POST", headers, body: JSON.stringify({ action: "preview", ...buildConnectorPayload(), selected_tables: [tableName] }) }
      );
      const data = await res.json();
      setPreviewData(data);
    } catch (err: unknown) {
      toast({ title: "Preview failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  };

  const handleSelectTables = () => {
    if (selectedTables.length === 0) {
      toast({ title: "Select at least one table", variant: "destructive" });
      return;
    }
    const autoMappings: MetricMapping[] = [];
    for (const tableName of selectedTables) {
      const table = tables.find(t => t.table_name === tableName);
      if (!table) continue;
      const numericCols = table.columns.filter(c =>
        ["integer", "bigint", "numeric", "double precision", "real", "decimal", "money", "float64", "int64", "number"].includes(c.data_type.toLowerCase())
      );
      const dateCols = table.columns.filter(c =>
        ["date", "timestamp without time zone", "timestamp with time zone", "timestamptz", "datetime", "timestamp", "date"].includes(c.data_type.toLowerCase())
      );
      const dateCol = dateCols[0]?.column_name || "";
      for (const col of numericCols) {
        autoMappings.push({
          source_table: tableName, source_column: col.column_name,
          metric_type: guessMetricType(col.column_name), date_column: dateCol, aggregation: "sum",
        });
      }
    }
    setMappings(autoMappings);
    setStep("mapping");
  };

  const guessMetricType = (colName: string): string => {
    const lower = colName.toLowerCase();
    if (lower.includes("revenue") || lower.includes("sales") || lower.includes("income")) return "revenue";
    if (lower.includes("cost") || lower.includes("expense") || lower.includes("spend")) return "cost";
    if (lower.includes("customer") || lower.includes("user") || lower.includes("client")) return "customers";
    if (lower.includes("churn")) return "churn";
    if (lower.includes("order") || lower.includes("transaction")) return "orders";
    if (lower.includes("margin") || lower.includes("profit")) return "margin";
    if (lower.includes("retention")) return "retention";
    if (lower.includes("conversion")) return "conversion_rate";
    if (lower.includes("mrr")) return "mrr";
    if (lower.includes("arr")) return "arr";
    return "custom";
  };

  const updateMapping = (idx: number, field: keyof MetricMapping, value: string) => {
    setMappings(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const removeMapping = (idx: number) => {
    setMappings(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreateAndSync = async () => {
    if (!currentOrgId || !user) return;
    setSyncing(true);
    setSyncResult(null);
    setStep("syncing");

    try {
      const connPayload = buildConnectorPayload();
      // 1. Create data source
      const { data: ds, error: dsErr } = await supabase.from("data_sources").insert({
        organization_id: currentOrgId, name: sourceName, source_type: "database",
        created_by: user.id, status: "active",
        config: { connector_type: selectedType, ...connPayload },
      }).select("id").single();
      if (dsErr) throw dsErr;
      setDataSourceId(ds.id);

      // 2. Create connector config
      const { error: ccErr } = await (supabase.from("connector_configs") as any).insert({
        organization_id: currentOrgId, data_source_id: ds.id,
        connector_type: selectedType || "postgresql",
        host: creds.host || null, port: creds.port ? parseInt(creds.port) : null,
        database_name: creds.dbName || null, schema_name: creds.schemaName || null,
        username: creds.username || null, ssl_mode: creds.sslMode || null,
        selected_tables: selectedTables, discovered_schema: { tables },
        connection_status: "connected", last_tested_at: new Date().toISOString(),
      }).select("id").single();
      if (ccErr) throw ccErr;

      // 3. Save metric mappings
      const mappingInserts = mappings.filter(m => m.date_column && m.metric_type).map(m => ({
        organization_id: currentOrgId, data_source_id: ds.id,
        source_table: m.source_table, source_column: m.source_column,
        metric_type: m.metric_type, date_column: m.date_column,
        aggregation: m.aggregation, is_active: true,
      }));
      if (mappingInserts.length > 0) {
        await (supabase.from("metric_mappings") as any).insert(mappingInserts);
      }

      // 4. Create sync schedule
      const now = new Date();
      const nextRun = new Date(now);
      if (syncFrequency === "hourly") nextRun.setHours(nextRun.getHours() + 1);
      else if (syncFrequency === "daily") nextRun.setDate(nextRun.getDate() + 1);
      else nextRun.setDate(nextRun.getDate() + 7);

      await (supabase.from("sync_schedules") as any).insert({
        organization_id: currentOrgId, data_source_id: ds.id,
        frequency: syncFrequency, is_active: true, next_run_at: nextRun.toISOString(),
      });

      // 5. Run initial sync
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/db-connector`,
        {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({
            action: "sync", ...connPayload, data_source_id: ds.id,
            metric_mappings: mappings.filter(m => m.date_column && m.metric_type),
          }),
        }
      );
      const syncData = await res.json();
      setSyncResult(syncData);
      setStep("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Sync failed", description: msg, variant: "destructive" });
      setSyncResult({ records: 0, errors: [msg] });
      setStep("done");
    } finally {
      setSyncing(false);
    }
  };

  const resetWizard = () => {
    setStep("select");
    setSelectedType(null);
    setSourceName("");
    setCreds({ ...defaultCredentials });
    setTestResult(null); setTables([]); setSelectedTables([]);
    setMappings([]); setSyncResult(null); setDataSourceId(null);
    setPreviewData(null); setPreviewTable(null);
  };

  const isCredentialsValid = (): boolean => {
    switch (selectedType) {
      case "postgresql":
      case "mysql":
      case "sqlserver":
        return !!(creds.host && creds.dbName && creds.username);
      case "snowflake":
        return !!(creds.account && creds.dbName && creds.username && creds.warehouse);
      case "bigquery":
        return !!(creds.projectId && creds.datasetId && creds.serviceAccountJson);
      case "powerbi":
        return !!(creds.tenantId && creds.clientId && creds.clientSecret);
      default:
        return false;
    }
  };

  // ─── Render ───
  const stepLabels: Record<WizardStep, string> = {
    select: "Select Connector",
    credentials: "Connection Details",
    testing: "Test Connection",
    schema: "Discover Schema",
    tables: "Select Tables",
    mapping: "Map Metrics",
    schedule: "Sync Schedule",
    syncing: "Syncing Data",
    done: "Complete",
  };

  const stepOrder: WizardStep[] = ["select", "credentials", "testing", "schema", "tables", "mapping", "schedule", "syncing", "done"];
  const currentIdx = stepOrder.indexOf(step);

  const renderCredentialForm = () => {
    switch (selectedType) {
      case "postgresql":
      case "mysql":
      case "sqlserver":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Connection Name</label>
              <Input value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder={`My ${CONNECTORS.find(c => c.type === selectedType)?.label} DB`} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium mb-1.5 block">Host</label>
                <Input value={creds.host} onChange={e => updateCred("host", e.target.value)} placeholder="db.example.com" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Port</label>
                <Input value={creds.port} onChange={e => updateCred("port", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Database</label>
                <Input value={creds.dbName} onChange={e => updateCred("dbName", e.target.value)} placeholder="mydb" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Schema</label>
                <Input value={creds.schemaName} onChange={e => updateCred("schemaName", e.target.value)} placeholder={selectedType === "sqlserver" ? "dbo" : "public"} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Username</label>
                <Input value={creds.username} onChange={e => updateCred("username", e.target.value)} placeholder="readonly_user" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Password</label>
                <Input type="password" value={creds.password} onChange={e => updateCred("password", e.target.value)} placeholder="••••••••" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">SSL Mode</label>
              <Select value={creds.sslMode} onValueChange={v => updateCred("sslMode", v)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="require">Require (recommended)</SelectItem>
                  <SelectItem value="prefer">Prefer</SelectItem>
                  <SelectItem value="disable">Disable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case "snowflake":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Connection Name</label>
              <Input value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="Snowflake Production" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Account Identifier</label>
                <Input value={creds.account} onChange={e => updateCred("account", e.target.value)} placeholder="xy12345.us-east-1" />
                <p className="text-[10px] text-muted-foreground mt-1">e.g. xy12345.us-east-1 or xy12345.snowflakecomputing.com</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Warehouse</label>
                <Input value={creds.warehouse} onChange={e => updateCred("warehouse", e.target.value)} placeholder="COMPUTE_WH" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Database</label>
                <Input value={creds.dbName} onChange={e => updateCred("dbName", e.target.value)} placeholder="ANALYTICS_DB" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Schema</label>
                <Input value={creds.schemaName} onChange={e => updateCred("schemaName", e.target.value)} placeholder="PUBLIC" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Username</label>
                <Input value={creds.username} onChange={e => updateCred("username", e.target.value)} placeholder="QUANTIVIS_READER" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Password</label>
                <Input type="password" value={creds.password} onChange={e => updateCred("password", e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Role</label>
                <Input value={creds.role} onChange={e => updateCred("role", e.target.value)} placeholder="PUBLIC" />
              </div>
            </div>
          </div>
        );

      case "bigquery":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Connection Name</label>
              <Input value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="BigQuery Analytics" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">GCP Project ID</label>
                <Input value={creds.projectId} onChange={e => updateCred("projectId", e.target.value)} placeholder="my-gcp-project-123" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Dataset ID</label>
                <Input value={creds.datasetId} onChange={e => updateCred("datasetId", e.target.value)} placeholder="analytics_dataset" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Service Account JSON Key</label>
              <Textarea
                value={creds.serviceAccountJson}
                onChange={e => updateCred("serviceAccountJson", e.target.value)}
                placeholder='Paste your service account JSON key here...'
                className="font-mono text-xs min-h-[120px]"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Create a service account with BigQuery Data Viewer role in your GCP console.
              </p>
            </div>
          </div>
        );

      case "powerbi":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Connection Name</label>
              <Input value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="Power BI Finance" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Azure Tenant ID</label>
                <Input value={creds.tenantId} onChange={e => updateCred("tenantId", e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Client ID (App Registration)</label>
                <Input value={creds.clientId} onChange={e => updateCred("clientId", e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Client Secret</label>
                <Input type="password" value={creds.clientSecret} onChange={e => updateCred("clientSecret", e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Workspace ID (optional)</label>
                <Input value={creds.workspaceId} onChange={e => updateCred("workspaceId", e.target.value)} placeholder="Power BI workspace GUID" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Register an app in Azure AD with Power BI API permissions (Dataset.Read.All).
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <header className="h-14 border-b border-border/30 flex items-center justify-between px-8 shrink-0 bg-background/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <SidebarMobileToggle />
          <Cable className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold font-display">Data Connectors</h1>
        </div>
        {step !== "select" && (
          <Button variant="outline" size="sm" onClick={resetWizard}>
            <Plus className="w-4 h-4 mr-1.5" /> New Connection
          </Button>
        )}
      </header>

      <main className="flex-1 p-8 overflow-auto">
        {/* Progress bar */}
        {step !== "select" && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              {stepOrder.slice(1, -1).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    i < currentIdx - 1 ? "bg-primary text-primary-foreground" :
                    i === currentIdx - 1 ? "bg-primary text-primary-foreground ring-2 ring-primary/30" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {i < currentIdx - 1 ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  {i < stepOrder.length - 3 && (
                    <div className={`w-8 h-0.5 ${i < currentIdx - 1 ? "bg-primary" : "bg-border"}`} />
                  )}
                </div>
              ))}
            </div>
            <p className="text-sm font-medium text-muted-foreground">{stepLabels[step]}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* ═══ STEP: Select Connector ═══ */}
            {step === "select" && (
              <div>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold font-display mb-2">Connect Your Data</h2>
                  <p className="text-muted-foreground">Choose a data source to power your decision intelligence.</p>
                </div>

                {/* Existing connections */}
                {existingConnectors.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active Connections</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {existingConnectors.map((cc: any) => {
                        const def = CONNECTORS.find(c => c.type === cc.connector_type);
                        const Icon = def?.icon || Database;
                        return (
                          <Card key={cc.id} className="border-border/50">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3 mb-2">
                                <Icon className="w-5 h-5 text-primary" />
                                <span className="font-semibold text-sm">{cc.data_sources?.name || def?.label}</span>
                                <Badge variant={cc.connection_status === "connected" ? "default" : "secondary"} className="ml-auto text-[10px]">
                                  {cc.connection_status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {cc.host ? `${cc.host}:${cc.port} / ${cc.database_name}` : cc.connector_type}
                              </p>
                              {cc.data_sources?.last_synced_at && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Last sync: {new Date(cc.data_sources.last_synced_at).toLocaleDateString()}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Grouped connector cards */}
                {(["database", "warehouse", "bi", "file"] as const).map(category => {
                  const group = CONNECTORS.filter(c => c.category === category);
                  const categoryLabels = { database: "Connect Database", warehouse: "Connect Data Warehouse", bi: "Connect BI Tool", file: "Upload File (Demo)" };
                  return (
                    <div key={category} className="mb-6">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{categoryLabels[category]}</h3>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {group.map((conn) => {
                          const Icon = conn.icon;
                          return (
                            <Card
                              key={conn.type}
                              className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
                              onClick={() => handleSelectConnector(conn.type)}
                            >
                              <CardContent className="p-5">
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Icon className="w-5 h-5 text-primary" />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-sm">{conn.label}</p>
                                    {conn.category === "file" && (
                                      <Badge variant="outline" className="text-[10px]">Demo / Testing</Badge>
                                    )}
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground">{conn.description}</p>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="mt-8 p-4 rounded-xl bg-secondary/50 border border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">Enterprise Security</span>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Credentials encrypted via Vault — never stored in plaintext</li>
                    <li>• Read-only connections — no write access to your data</li>
                    <li>• Full audit trail for every data access event</li>
                    <li>• Organization-level data isolation enforced by RLS</li>
                  </ul>
                </div>
              </div>
            )}

            {/* ═══ STEP: Credentials ═══ */}
            {step === "credentials" && (
              <div className="max-w-2xl">
                <h2 className="text-xl font-bold font-display mb-1">
                  {CONNECTORS.find(c => c.type === selectedType)?.label} Connection
                </h2>
                <p className="text-sm text-muted-foreground mb-6">Enter your credentials. We use read-only access only.</p>

                {renderCredentialForm()}

                {testResult && (
                  <div className={`mt-4 p-3 rounded-lg border ${testResult.success ? "border-primary/30 bg-primary/10" : "border-destructive/30 bg-destructive/10"}`}>
                    <div className="flex items-center gap-2">
                      {testResult.success ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <AlertCircle className="w-4 h-4 text-destructive" />}
                      <span className="text-sm font-medium">{testResult.message}</span>
                    </div>
                    {testResult.version && <p className="text-xs text-muted-foreground mt-1 truncate">{testResult.version}</p>}
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <Button variant="outline" onClick={() => setStep("select")}>
                    <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                  </Button>
                  <Button onClick={handleTestConnection} disabled={testing || !isCredentialsValid()}>
                    {testing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <TestTube className="w-4 h-4 mr-1.5" />}
                    Test Connection
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP: Test Success ═══ */}
            {step === "testing" && (
              <div className="max-w-2xl">
                <div className="p-6 rounded-xl border border-primary/30 bg-primary/5 mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-bold font-display">Connection Successful</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">{testResult?.version || testResult?.message}</p>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Ready to discover your schema and select tables to sync.</p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("credentials")}>
                    <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                  </Button>
                  <Button onClick={handleDiscoverSchema} disabled={discovering}>
                    {discovering ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Layers className="w-4 h-4 mr-1.5" />}
                    Discover Schema
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP: Schema Discovery ═══ */}
            {step === "schema" && (
              <div>
                <h2 className="text-xl font-bold font-display mb-1">Database Schema</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Found {tables.length} tables. Select the tables you want to sync.
                </p>

                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  {tables.map((table) => (
                    <Card
                      key={table.table_name}
                      className={`cursor-pointer transition-all ${
                        selectedTables.includes(table.table_name)
                          ? "border-primary ring-2 ring-primary/20"
                          : "hover:border-primary/40"
                      }`}
                      onClick={() => {
                        setSelectedTables(prev =>
                          prev.includes(table.table_name)
                            ? prev.filter(t => t !== table.table_name)
                            : [...prev, table.table_name]
                        );
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Table2 className="w-4 h-4 text-primary" />
                            <span className="font-semibold text-sm font-mono">{table.table_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">~{table.row_count.toLocaleString()} rows</Badge>
                            {selectedTables.includes(table.table_name) && <Check className="w-4 h-4 text-primary" />}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {table.columns.slice(0, 6).map((col) => (
                            <span key={col.column_name} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
                              {col.column_name}
                              <span className="text-primary/60 ml-0.5">{col.data_type.split(" ")[0]}</span>
                            </span>
                          ))}
                          {table.columns.length > 6 && (
                            <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground">+{table.columns.length - 6} more</span>
                          )}
                        </div>
                        <Button
                          variant="ghost" size="sm"
                          className="mt-2 text-xs h-7"
                          onClick={(e) => { e.stopPropagation(); handlePreviewTable(table.table_name); }}
                        >
                          <Eye className="w-3 h-3 mr-1" /> Preview
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {previewTable && previewData && (
                  <Card className="mb-6">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-mono">{previewTable} — {previewData.count.toLocaleString()} total rows</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr>
                            {previewData.rows[0] && Object.keys(previewData.rows[0]).map(k => (
                              <th key={k} className="text-left p-1.5 border-b border-border font-semibold text-muted-foreground font-mono">{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.rows.slice(0, 10).map((row, i) => (
                            <tr key={i} className="hover:bg-secondary/50">
                              {Object.values(row).map((v: any, j) => (
                                <td key={j} className="p-1.5 border-b border-border/50 truncate max-w-[200px]">{String(v ?? "")}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("testing")}>
                    <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                  </Button>
                  <Button onClick={handleSelectTables} disabled={selectedTables.length === 0}>
                    Continue with {selectedTables.length} table{selectedTables.length !== 1 ? "s" : ""}
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP: Metric Mapping ═══ */}
            {step === "mapping" && (
              <div>
                <h2 className="text-xl font-bold font-display mb-1">Map Metrics</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Define how columns map to standardized metrics for decision intelligence.
                </p>

                <div className="space-y-3 mb-6">
                  {mappings.map((m, idx) => {
                    const table = tables.find(t => t.table_name === m.source_table);
                    return (
                      <Card key={idx} className="border-border/50">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-mono text-muted-foreground">{m.source_table}.</span>
                            <span className="text-sm font-semibold font-mono">{m.source_column}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground mx-1" />
                            <Badge variant="default" className="text-xs">{m.metric_type}</Badge>
                            <Button variant="ghost" size="sm" className="ml-auto h-7 w-7 p-0" onClick={() => removeMapping(idx)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Metric Type</label>
                              <Select value={m.metric_type} onValueChange={v => updateMapping(idx, "metric_type", v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {METRIC_TYPES.map(mt => <SelectItem key={mt} value={mt}>{mt}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Date Column</label>
                              <Select value={m.date_column} onValueChange={v => updateMapping(idx, "date_column", v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {table?.columns.filter(c =>
                                    ["date", "timestamp without time zone", "timestamp with time zone", "timestamptz", "datetime", "timestamp"].includes(c.data_type.toLowerCase())
                                  ).map(c => <SelectItem key={c.column_name} value={c.column_name}>{c.column_name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Aggregation</label>
                              <Select value={m.aggregation} onValueChange={v => updateMapping(idx, "aggregation", v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {AGGREGATIONS.map(a => <SelectItem key={a} value={a}>{a.toUpperCase()}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {mappings.length === 0 && (
                  <div className="p-8 rounded-xl border border-dashed border-border text-center mb-6">
                    <Columns3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No numeric columns found. Please select tables with numeric data.</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("schema")}>
                    <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                  </Button>
                  <Button onClick={() => setStep("schedule")} disabled={mappings.filter(m => m.date_column).length === 0}>
                    Configure Sync <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP: Schedule ═══ */}
            {step === "schedule" && (
              <div className="max-w-2xl">
                <h2 className="text-xl font-bold font-display mb-1">Sync Schedule</h2>
                <p className="text-sm text-muted-foreground mb-6">Choose how often to pull new data.</p>

                <div className="grid grid-cols-3 gap-4 mb-8">
                  {[
                    { value: "hourly", label: "Hourly", desc: "Every hour", icon: Zap },
                    { value: "daily", label: "Daily", desc: "Every 24 hours", icon: Clock },
                    { value: "weekly", label: "Weekly", desc: "Every 7 days", icon: RefreshCw },
                  ].map(opt => {
                    const Icon = opt.icon;
                    return (
                      <Card
                        key={opt.value}
                        className={`cursor-pointer transition-all ${
                          syncFrequency === opt.value ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/40"
                        }`}
                        onClick={() => setSyncFrequency(opt.value)}
                      >
                        <CardContent className="p-5 text-center">
                          <Icon className="w-6 h-6 text-primary mx-auto mb-2" />
                          <p className="font-semibold text-sm">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <Card className="mb-6">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold mb-3">Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Source</span>
                        <span className="font-medium">{sourceName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Connector</span>
                        <span className="font-medium">{CONNECTORS.find(c => c.type === selectedType)?.label}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tables</span>
                        <span className="font-medium">{selectedTables.length} selected</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Metric mappings</span>
                        <span className="font-medium">{mappings.filter(m => m.date_column).length} configured</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sync frequency</span>
                        <span className="font-medium capitalize">{syncFrequency}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("mapping")}>
                    <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                  </Button>
                  <Button onClick={handleCreateAndSync}>
                    <Link2 className="w-4 h-4 mr-1.5" /> Connect & Sync Now
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP: Syncing ═══ */}
            {step === "syncing" && (
              <div className="max-w-lg mx-auto text-center py-12">
                <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
                <h2 className="text-xl font-bold font-display mb-2">Syncing Your Data</h2>
                <p className="text-sm text-muted-foreground">Connecting to {CONNECTORS.find(c => c.type === selectedType)?.label}, pulling data, and creating metrics...</p>
              </div>
            )}

            {/* ═══ STEP: Done ═══ */}
            {step === "done" && (
              <div className="max-w-lg mx-auto text-center py-12">
                {syncResult && syncResult.records > 0 ? (
                  <>
                    <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
                    <h2 className="text-xl font-bold font-display mb-2">Data Connected!</h2>
                    <p className="text-sm text-muted-foreground mb-2">
                      Successfully synced <span className="font-semibold text-foreground">{syncResult.records}</span> metric data points.
                    </p>
                    {syncResult.errors.length > 0 && (
                      <p className="text-xs text-muted-foreground mb-4">{syncResult.errors.length} warning(s): {syncResult.errors[0]}</p>
                    )}
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                    <h2 className="text-xl font-bold font-display mb-2">Sync Issue</h2>
                    <p className="text-sm text-destructive mb-4">
                      {syncResult?.errors?.[0] || "No data could be synced. Check your metric mappings."}
                    </p>
                  </>
                )}
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={resetWizard}>Add Another Source</Button>
                  <Button onClick={() => navigate("/dashboard")}>Go to Dashboard <ArrowRight className="w-4 h-4 ml-1.5" /></Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </>
  );
};

export default DataConnectors;

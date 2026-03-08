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
import {
  Database, Server, Cloud, FileSpreadsheet, Plus, Check, X,
  RefreshCw, ArrowRight, ArrowLeft, Eye, Loader2, Shield,
  Table2, Columns3, Zap, Clock, AlertCircle, CheckCircle2,
  Cable, Plug, TestTube, Layers, Link2,
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
  available: boolean;
  tier?: string;
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
  { type: "postgresql", label: "PostgreSQL", icon: Database, description: "Connect to any PostgreSQL database", available: true },
  { type: "mysql", label: "MySQL", icon: Database, description: "Connect to MySQL databases", available: false, tier: "enterprise" },
  { type: "sqlserver", label: "SQL Server", icon: Server, description: "Microsoft SQL Server connection", available: false, tier: "enterprise" },
  { type: "snowflake", label: "Snowflake", icon: Cloud, description: "Cloud data warehouse", available: false, tier: "enterprise" },
  { type: "bigquery", label: "BigQuery", icon: Cloud, description: "Google BigQuery datasets", available: false, tier: "enterprise" },
  { type: "powerbi", label: "Power BI", icon: Layers, description: "Microsoft Power BI datasets", available: false, tier: "enterprise" },
  { type: "csv", label: "CSV Upload", icon: FileSpreadsheet, description: "Upload CSV files (demo/testing)", available: true },
];

const METRIC_TYPES = [
  "revenue", "cost", "customers", "churn", "retention", "conversion_rate",
  "mrr", "arr", "headcount", "deals", "pipeline", "support_tickets",
  "sessions", "users", "orders", "refunds", "margin", "custom",
];

const AGGREGATIONS = ["sum", "avg", "count", "min", "max"];

// ─── Component ───
const DataConnectors = () => {
  const { user } = useAuth();
  const { currentOrgId } = useOrganization();
  const { currentWorkspaceId } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Wizard state
  const [step, setStep] = useState<WizardStep>("select");
  const [selectedType, setSelectedType] = useState<ConnectorType | null>(null);
  const [sourceName, setSourceName] = useState("");

  // Credentials
  const [host, setHost] = useState("");
  const [port, setPort] = useState("5432");
  const [dbName, setDbName] = useState("");
  const [schemaName, setSchemaName] = useState("public");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sslMode, setSslMode] = useState("require");

  // Testing
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; version?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Schema discovery
  const [tables, setTables] = useState<DiscoveredTable[]>([]);
  const [discovering, setDiscovering] = useState(false);

  // Table selection
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<{ rows: any[]; count: number } | null>(null);
  const [previewTable, setPreviewTable] = useState<string | null>(null);

  // Metric mapping
  const [mappings, setMappings] = useState<MetricMapping[]>([]);

  // Schedule
  const [syncFrequency, setSyncFrequency] = useState("daily");

  // Sync
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ records: number; errors: string[] } | null>(null);

  // Created IDs
  const [dataSourceId, setDataSourceId] = useState<string | null>(null);
  const [connectorConfigId, setConnectorConfigId] = useState<string | null>(null);

  // Existing connectors
  const [existingConnectors, setExistingConnectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOrgId) fetchExisting();
  }, [currentOrgId]);

  const fetchExisting = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("connector_configs")
      .select("*, data_sources(*)")
      .eq("organization_id", currentOrgId)
      .order("created_at", { ascending: false });
    setExistingConnectors(data || []);
    setLoading(false);
  };

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      Authorization: `Bearer ${session?.access_token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
  };

  const handleSelectConnector = (type: ConnectorType) => {
    if (type === "csv") {
      navigate("/data-upload");
      return;
    }
    if (!CONNECTORS.find(c => c.type === type)?.available) {
      toast({ title: "Coming soon", description: `${type} connector is under development.` });
      return;
    }
    setSelectedType(type);
    setSourceName(`${CONNECTORS.find(c => c.type === type)?.label} Connection`);
    setStep("credentials");
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/db-connector`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "test",
            organization_id: currentOrgId,
            host, port: parseInt(port), database_name: dbName,
            schema_name: schemaName, username, password, ssl_mode: sslMode,
          }),
        }
      );
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        setStep("testing");
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
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
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "discover",
            organization_id: currentOrgId,
            host, port: parseInt(port), database_name: dbName,
            schema_name: schemaName, username, password, ssl_mode: sslMode,
          }),
        }
      );
      const data = await res.json();
      setTables(data.tables || []);
      setStep("schema");
    } catch (err: any) {
      toast({ title: "Schema discovery failed", description: err.message, variant: "destructive" });
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
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "preview",
            organization_id: currentOrgId,
            host, port: parseInt(port), database_name: dbName,
            schema_name: schemaName, username, password, ssl_mode: sslMode,
            selected_tables: [tableName],
          }),
        }
      );
      const data = await res.json();
      setPreviewData(data);
    } catch (err: any) {
      toast({ title: "Preview failed", description: err.message, variant: "destructive" });
    }
  };

  const handleSelectTables = () => {
    if (selectedTables.length === 0) {
      toast({ title: "Select at least one table", variant: "destructive" });
      return;
    }
    // Auto-generate initial mappings
    const autoMappings: MetricMapping[] = [];
    for (const tableName of selectedTables) {
      const table = tables.find(t => t.table_name === tableName);
      if (!table) continue;
      const numericCols = table.columns.filter(c =>
        ["integer", "bigint", "numeric", "double precision", "real", "decimal", "money"].includes(c.data_type)
      );
      const dateCols = table.columns.filter(c =>
        ["date", "timestamp without time zone", "timestamp with time zone", "timestamptz"].includes(c.data_type)
      );
      const dateCol = dateCols[0]?.column_name || "";
      for (const col of numericCols) {
        autoMappings.push({
          source_table: tableName,
          source_column: col.column_name,
          metric_type: guessMetricType(col.column_name),
          date_column: dateCol,
          aggregation: "sum",
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
    if (lower.includes("count") || lower.includes("total") || lower.includes("amount")) return "revenue";
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
      // 1. Create data source
      const { data: ds, error: dsErr } = await supabase.from("data_sources").insert({
        organization_id: currentOrgId,
        name: sourceName,
        source_type: "database",
        created_by: user.id,
        config: { connector_type: selectedType, host, database: dbName, schema: schemaName },
        status: "active",
      }).select("id").single();
      if (dsErr) throw dsErr;
      setDataSourceId(ds.id);

      // 2. Create connector config (cast needed until types regenerate)
      const { data: cc, error: ccErr } = await (supabase.from("connector_configs") as any).insert({
        organization_id: currentOrgId,
        data_source_id: ds.id,
        connector_type: selectedType || "postgresql",
        host, port: parseInt(port), database_name: dbName,
        schema_name: schemaName, username,
        ssl_mode: sslMode,
        selected_tables: selectedTables,
        discovered_schema: { tables },
        connection_status: "connected",
        last_tested_at: new Date().toISOString(),
      }).select("id").single();
      if (ccErr) throw ccErr;
      setConnectorConfigId(cc.id);

      // 3. Save metric mappings
      const mappingInserts = mappings.filter(m => m.date_column && m.metric_type).map(m => ({
        organization_id: currentOrgId,
        data_source_id: ds.id,
        source_table: m.source_table,
        source_column: m.source_column,
        metric_type: m.metric_type,
        date_column: m.date_column,
        aggregation: m.aggregation,
        is_active: true,
      }));
      if (mappingInserts.length > 0) {
        await supabase.from("metric_mappings").insert(mappingInserts);
      }

      // 4. Create sync schedule
      const now = new Date();
      const nextRun = new Date(now);
      if (syncFrequency === "hourly") nextRun.setHours(nextRun.getHours() + 1);
      else if (syncFrequency === "daily") nextRun.setDate(nextRun.getDate() + 1);
      else nextRun.setDate(nextRun.getDate() + 7);

      await supabase.from("sync_schedules").insert({
        organization_id: currentOrgId,
        data_source_id: ds.id,
        frequency: syncFrequency,
        is_active: true,
        next_run_at: nextRun.toISOString(),
      });

      // 5. Run initial sync
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/db-connector`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            action: "sync",
            organization_id: currentOrgId,
            data_source_id: ds.id,
            host, port: parseInt(port), database_name: dbName,
            schema_name: schemaName, username, password, ssl_mode: sslMode,
            metric_mappings: mappings.filter(m => m.date_column && m.metric_type),
          }),
        }
      );
      const syncData = await res.json();
      setSyncResult(syncData);
      setStep("done");
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
      setSyncResult({ records: 0, errors: [err.message] });
      setStep("done");
    } finally {
      setSyncing(false);
    }
  };

  const resetWizard = () => {
    setStep("select");
    setSelectedType(null);
    setSourceName("");
    setHost(""); setPort("5432"); setDbName(""); setSchemaName("public");
    setUsername(""); setPassword(""); setSslMode("require");
    setTestResult(null); setTables([]); setSelectedTables([]);
    setMappings([]); setSyncResult(null);
    setDataSourceId(null); setConnectorConfigId(null);
    setPreviewData(null); setPreviewTable(null);
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
                                {cc.host}:{cc.port} / {cc.database_name}
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

                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Add New Connection</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {CONNECTORS.map((conn) => {
                    const Icon = conn.icon;
                    return (
                      <Card
                        key={conn.type}
                        className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-md ${
                          !conn.available ? "opacity-60" : ""
                        }`}
                        onClick={() => handleSelectConnector(conn.type)}
                      >
                        <CardContent className="p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{conn.label}</p>
                              {!conn.available && (
                                <Badge variant="outline" className="text-[10px]">Coming Soon</Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">{conn.description}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

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
                <p className="text-sm text-muted-foreground mb-6">Enter your database credentials. We use read-only access only.</p>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Connection Name</label>
                    <Input value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="My Production DB" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="text-sm font-medium mb-1.5 block">Host</label>
                      <Input value={host} onChange={e => setHost(e.target.value)} placeholder="db.example.com" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Port</label>
                      <Input value={port} onChange={e => setPort(e.target.value)} placeholder="5432" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Database</label>
                      <Input value={dbName} onChange={e => setDbName(e.target.value)} placeholder="mydb" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Schema</label>
                      <Input value={schemaName} onChange={e => setSchemaName(e.target.value)} placeholder="public" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Username</label>
                      <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="readonly_user" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Password</label>
                      <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">SSL Mode</label>
                    <Select value={sslMode} onValueChange={setSslMode}>
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="require">Require (recommended)</SelectItem>
                        <SelectItem value="prefer">Prefer</SelectItem>
                        <SelectItem value="disable">Disable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {testResult && (
                  <div className={`mt-4 p-3 rounded-lg border ${testResult.success ? "border-green-500/30 bg-green-500/10" : "border-destructive/30 bg-destructive/10"}`}>
                    <div className="flex items-center gap-2">
                      {testResult.success ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-destructive" />}
                      <span className="text-sm font-medium">{testResult.message}</span>
                    </div>
                    {testResult.version && <p className="text-xs text-muted-foreground mt-1 truncate">{testResult.version}</p>}
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <Button variant="outline" onClick={() => setStep("select")}>
                    <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                  </Button>
                  <Button onClick={handleTestConnection} disabled={testing || !host || !dbName || !username}>
                    {testing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <TestTube className="w-4 h-4 mr-1.5" />}
                    Test Connection
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP: Test Success → Discover ═══ */}
            {step === "testing" && (
              <div className="max-w-2xl">
                <div className="p-6 rounded-xl border border-green-500/30 bg-green-500/5 mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                    <h2 className="text-xl font-bold font-display">Connection Successful</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">{testResult?.version}</p>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Ready to discover your database schema and select tables to sync.</p>
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
                  Found {tables.length} tables in <code className="px-1.5 py-0.5 rounded bg-secondary text-xs">{schemaName}</code>. Select the tables you want to sync.
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

                {/* Table preview */}
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
                  Define how database columns map to standardized metrics for decision intelligence.
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
                                    ["date", "timestamp without time zone", "timestamp with time zone", "timestamptz"].includes(c.data_type)
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
                <p className="text-sm text-muted-foreground mb-6">Choose how often to pull new data from your database.</p>

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
                <p className="text-sm text-muted-foreground">Connecting to database, pulling data, and creating metrics...</p>
              </div>
            )}

            {/* ═══ STEP: Done ═══ */}
            {step === "done" && (
              <div className="max-w-lg mx-auto text-center py-12">
                {syncResult && syncResult.records > 0 ? (
                  <>
                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold font-display mb-2">Data Connected!</h2>
                    <p className="text-sm text-muted-foreground mb-2">
                      Successfully synced <span className="font-semibold text-foreground">{syncResult.records}</span> metric data points.
                    </p>
                    {syncResult.errors.length > 0 && (
                      <p className="text-xs text-warning mb-4">{syncResult.errors.length} warning(s): {syncResult.errors[0]}</p>
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

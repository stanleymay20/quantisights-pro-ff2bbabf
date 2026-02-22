import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Database, Globe, Webhook, FileSpreadsheet, Plus, Copy, Check,
  RefreshCw, Trash2, Clock, AlertCircle, CheckCircle2, XCircle, Lock
} from "lucide-react";

type SourceType = "csv" | "webhook" | "api" | "database";

interface DataSource {
  id: string;
  name: string;
  source_type: string;
  status: string;
  config: any;
  credentials_key: string | null;
  last_synced_at: string | null;
  created_at: string;
}

interface SyncJob {
  id: string;
  status: string;
  records_synced: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const SOURCE_TYPES: { value: SourceType; label: string; icon: typeof Database; description: string; tierRequired?: string }[] = [
  { value: "csv", label: "CSV Upload", icon: FileSpreadsheet, description: "Upload CSV files manually" },
  { value: "webhook", label: "Webhook", icon: Webhook, description: "Receive data via HTTP endpoint" },
  { value: "api", label: "REST API", icon: Globe, description: "Connect to Stripe, Shopify, HubSpot, GA4", tierRequired: "growth" },
  { value: "database", label: "Database", icon: Database, description: "Connect to Postgres, MySQL", tierRequired: "enterprise" },
];

const DataSources = () => {
  const { user } = useAuth();
  const { currentOrgId } = useOrganization();
  const { tier, subscribed } = useSubscription();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [sources, setSources] = useState<DataSource[]>([]);
  const [syncJobs, setSyncJobs] = useState<Record<string, SyncJob[]>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<SourceType>("webhook");
  const [creating, setCreating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const fetchSources = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("data_sources")
      .select("*")
      .eq("organization_id", currentOrgId)
      .order("created_at", { ascending: false });
    setSources(data || []);
    setLoading(false);
  };

  const fetchJobs = async (sourceId: string) => {
    const { data } = await supabase
      .from("data_sync_jobs")
      .select("*")
      .eq("data_source_id", sourceId)
      .order("created_at", { ascending: false })
      .limit(10);
    setSyncJobs((prev) => ({ ...prev, [sourceId]: data || [] }));
  };

  useEffect(() => {
    fetchSources();
  }, [currentOrgId]);

  useEffect(() => {
    if (selectedSource) fetchJobs(selectedSource);
  }, [selectedSource]);

  const generateApiKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let key = "qv_";
    for (let i = 0; i < 32; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
    return key;
  };

  const handleCreate = async () => {
    if (!currentOrgId || !user || !newName.trim()) return;

    const typeInfo = SOURCE_TYPES.find((t) => t.value === newType);
    if (typeInfo?.tierRequired) {
      const tierOrder = ["starter", "growth", "enterprise"];
      const requiredIdx = tierOrder.indexOf(typeInfo.tierRequired);
      const currentIdx = tier ? tierOrder.indexOf(tier) : -1;
      if (currentIdx < requiredIdx) {
        toast({
          title: "Plan upgrade required",
          description: `${typeInfo.label} connectors require ${typeInfo.tierRequired} plan or higher.`,
          variant: "destructive",
        });
        return;
      }
    }

    setCreating(true);
    const credKey = newType === "webhook" ? generateApiKey() : null;

    const { error } = await supabase.from("data_sources").insert({
      organization_id: currentOrgId,
      name: newName.trim(),
      source_type: newType,
      credentials_key: credKey,
      created_by: user.id,
      config: {
        field_mapping: { date: "date", value: "value", region: "region", segment: "segment", metric_type: "metric_type" },
        default_metric_type: "revenue",
      },
    });

    if (error) {
      toast({ title: "Failed to create", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Data source created" });
      setShowCreate(false);
      setNewName("");
      fetchSources();
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("data_sources").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Data source deleted" });
      setSources((s) => s.filter((src) => src.id !== id));
      if (selectedSource === id) setSelectedSource(null);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-4 h-4 text-success" />;
      case "running": return <RefreshCw className="w-4 h-4 text-primary animate-spin" />;
      case "failed": return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const webhookUrl = `https://itpwpnwzzitkelffttyx.supabase.co/functions/v1/webhook-ingest`;

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b border-border flex items-center justify-between px-8 shrink-0">
          <h1 className="text-xl font-semibold font-display">Data Sources</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Source
          </button>
        </header>

        <main className="flex-1 p-8 overflow-auto">
          {/* Create modal */}
          {showCreate && (
            <div className="glass-card p-6 rounded-xl mb-6 border border-primary/20">
              <h2 className="text-lg font-semibold font-display mb-4">New Data Source</h2>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                {SOURCE_TYPES.map((st) => {
                  const Icon = st.icon;
                  const locked = st.tierRequired && (!tier || ["starter", "growth", "enterprise"].indexOf(tier) < ["starter", "growth", "enterprise"].indexOf(st.tierRequired));
                  return (
                    <button
                      key={st.value}
                      onClick={() => !locked && setNewType(st.value)}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        newType === st.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
                      } ${locked ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold">{st.label}</span>
                        {locked && <Lock className="w-3 h-3 text-muted-foreground" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{st.description}</p>
                      {st.tierRequired && <p className="text-xs text-primary mt-1">Requires {st.tierRequired}+</p>}
                    </button>
                  );
                })}
              </div>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Source name (e.g., Stripe Revenue)"
                className="w-full max-w-md px-4 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Source"}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Sources list */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sources.length === 0 ? (
            <div className="glass-card p-12 rounded-xl flex flex-col items-center justify-center">
              <Database className="w-12 h-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold font-display mb-2">No data sources</h2>
              <p className="text-sm text-muted-foreground mb-4">Create a webhook endpoint or connector to start ingesting data.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all"
              >
                Add Your First Source
              </button>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Source cards */}
              <div className="lg:col-span-2 space-y-4">
                {sources.map((src) => {
                  const Icon = SOURCE_TYPES.find((t) => t.value === src.source_type)?.icon || Database;
                  return (
                    <div
                      key={src.id}
                      onClick={() => setSelectedSource(src.id)}
                      className={`glass-card p-5 rounded-xl cursor-pointer transition-all ${
                        selectedSource === src.id ? "ring-2 ring-primary" : "hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Icon className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold">{src.name}</h3>
                            <p className="text-xs text-muted-foreground capitalize">{src.source_type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            src.status === "active" ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                          }`}>
                            {src.status}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(src.id); }}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {src.source_type === "webhook" && src.credentials_key && (
                        <div className="space-y-2 mt-3 pt-3 border-t border-border">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Webhook URL</p>
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-secondary px-2 py-1 rounded flex-1 truncate">{webhookUrl}</code>
                              <button onClick={(e) => { e.stopPropagation(); copyKey(webhookUrl); }} className="p-1 shrink-0">
                                {copiedKey === webhookUrl ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">API Key (x-api-key header)</p>
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-secondary px-2 py-1 rounded flex-1 truncate">{src.credentials_key}</code>
                              <button onClick={(e) => { e.stopPropagation(); copyKey(src.credentials_key!); }} className="p-1 shrink-0">
                                {copiedKey === src.credentials_key ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {src.last_synced_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Last sync: {new Date(src.last_synced_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Sync jobs panel */}
              <div className="space-y-4">
                <div className="glass-card p-5 rounded-xl">
                  <h3 className="text-sm font-semibold font-display mb-3">
                    {selectedSource ? "Sync History" : "Select a source"}
                  </h3>
                  {selectedSource && (syncJobs[selectedSource] || []).length === 0 && (
                    <p className="text-xs text-muted-foreground">No sync jobs yet</p>
                  )}
                  <div className="space-y-2">
                    {(syncJobs[selectedSource || ""] || []).map((job) => (
                      <div key={job.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                        {statusIcon(job.status)}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{job.records_synced} records</p>
                          <p className="text-xs text-muted-foreground">{new Date(job.created_at).toLocaleString()}</p>
                        </div>
                        {job.error_message && (
                          <span title={job.error_message}>
                            <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick guide */}
                <div className="glass-card p-5 rounded-xl">
                  <h3 className="text-sm font-semibold font-display mb-2">Webhook Quick Start</h3>
                  <div className="text-xs text-muted-foreground space-y-2">
                    <p>1. Create a webhook source above</p>
                    <p>2. Copy the URL and API key</p>
                    <p>3. POST JSON data:</p>
                    <pre className="bg-secondary p-2 rounded text-xs overflow-x-auto">
{`POST /webhook-ingest
x-api-key: qv_...
Content-Type: application/json

[
  { "date": "2025-01-15",
    "value": 42000,
    "metric_type": "revenue",
    "region": "US" }
]`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default DataSources;

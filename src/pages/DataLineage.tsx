import { useState, useEffect, useMemo } from "react";
import { SidebarMobileToggle } from "@/components/layout/ProtectedShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/hooks/useOrganization";
import { useProject } from "@/contexts/ProjectContext";
import { supabase } from "@/integrations/supabase/client";
import { Database, ArrowRight, FileText, Target, BarChart3, Loader2, GitCommitVertical } from "lucide-react";
import DataPipelineStatus from "@/components/dashboard/DataPipelineStatus";
import DatasetRequired from "@/components/layout/DatasetRequired";

interface LineageNode {
  id: string;
  type: "source" | "metric" | "kpi" | "decision";
  label: string;
  detail: string;
  status?: string;
}

interface LineageEdge {
  from: string;
  to: string;
}

const NODE_STYLES: Record<string, { icon: any; bg: string; border: string }> = {
  source: { icon: Database, bg: "bg-blue-500/10", border: "border-blue-500/30" },
  metric: { icon: BarChart3, bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  kpi: { icon: Target, bg: "bg-primary/10", border: "border-primary/30" },
  decision: { icon: FileText, bg: "bg-amber-500/10", border: "border-amber-500/30" },
};

const DataLineage = () => {
  const { currentOrgId } = useOrganization();
  const { activeDatasetId } = useProject();
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [metricTypes, setMetricTypes] = useState<string[]>([]);

  useEffect(() => {
    if (!currentOrgId) return;
    const load = async () => {
      setLoading(true);
      let metricsQuery = supabase.from("metrics").select("metric_type").eq("organization_id", currentOrgId);
      if (activeDatasetId) {
        metricsQuery = metricsQuery.eq("dataset_id", activeDatasetId);
      }
      const [srcRes, kpiRes, decRes, metRes] = await Promise.all([
        supabase.from("data_sources").select("id, name, source_type, status").eq("organization_id", currentOrgId),
        supabase.from("kpis").select("id, name, formula, metric_dependencies").eq("organization_id", currentOrgId).eq("status", "active"),
        supabase.from("decision_ledger").select("id, recommended_action, decision_status, kpi_id").eq("organization_id", currentOrgId).order("created_at", { ascending: false }).limit(20),
        metricsQuery,
      ]);
      setSources(srcRes.data || []);
      setKpis(kpiRes.data || []);
      setDecisions(decRes.data || []);
      const uniqueTypes = [...new Set((metRes.data || []).map((m: any) => m.metric_type))];
      setMetricTypes(uniqueTypes);
      setLoading(false);
    };
    load();
  }, [currentOrgId, activeDatasetId]);

  const { nodes, edges } = useMemo(() => {
    const n: LineageNode[] = [];
    const e: LineageEdge[] = [];

    // Sources
    sources.forEach(s => {
      n.push({ id: `src-${s.id}`, type: "source", label: s.name, detail: s.source_type, status: s.status });
    });

    // Metrics
    metricTypes.forEach(mt => {
      const id = `met-${mt}`;
      n.push({ id, type: "metric", label: mt, detail: "Aggregated metric" });
      // Connect all sources to all metrics (simplified lineage)
      sources.forEach(s => e.push({ from: `src-${s.id}`, to: id }));
    });

    // KPIs
    kpis.forEach(k => {
      const id = `kpi-${k.id}`;
      n.push({ id, type: "kpi", label: k.name, detail: k.formula });
      // Connect metric dependencies
      const deps = Array.isArray(k.metric_dependencies) ? k.metric_dependencies : [];
      deps.forEach((dep: string) => {
        if (metricTypes.includes(dep)) e.push({ from: `met-${dep}`, to: id });
      });
      // If no deps matched, connect all metrics
      if (deps.length === 0) metricTypes.forEach(mt => e.push({ from: `met-${mt}`, to: id }));
    });

    // Decisions
    decisions.forEach(d => {
      const id = `dec-${d.id}`;
      n.push({ id, type: "decision", label: d.recommended_action?.slice(0, 40) || "Decision", detail: d.decision_status, status: d.decision_status });
      if (d.kpi_id) e.push({ from: `kpi-${d.kpi_id}`, to: id });
      else kpis.forEach(k => e.push({ from: `kpi-${k.id}`, to: id }));
    });

    return { nodes: n, edges: e };
  }, [sources, metricTypes, kpis, decisions]);

  const layers: Record<string, LineageNode[]> = {
    source: nodes.filter(n => n.type === "source"),
    metric: nodes.filter(n => n.type === "metric"),
    kpi: nodes.filter(n => n.type === "kpi"),
    decision: nodes.filter(n => n.type === "decision"),
  };

  const layerLabels = ["Data Sources", "Raw Metrics", "KPI Formulas", "Decisions"];
  const layerKeys = ["source", "metric", "kpi", "decision"];

  return (
    <DatasetRequired moduleName="Data Lineage">
    <>
        <header className="h-14 border-b border-border/30 flex items-center justify-between px-8 shrink-0 bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <SidebarMobileToggle />
            <GitCommitVertical className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold font-display">Data Lineage</h1>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-auto space-y-6">
          <DataPipelineStatus orgId={currentOrgId} datasetId={activeDatasetId} />

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : nodes.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No data lineage to display. Upload data and create KPIs first.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {/* Legend */}
              <div className="flex gap-4 mb-6">
                {layerKeys.map((key, i) => {
                  const style = NODE_STYLES[key];
                  const Icon = style.icon;
                  return (
                    <div key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className={`w-6 h-6 rounded flex items-center justify-center ${style.bg} border ${style.border}`}>
                        <Icon className="w-3 h-3" />
                      </div>
                      {layerLabels[i]}
                    </div>
                  );
                })}
              </div>

              {/* Layered graph */}
              <div className="flex gap-6 overflow-x-auto pb-4">
                {layerKeys.map((key, layerIdx) => (
                  <div key={key} className="flex items-start gap-4">
                    <div className="space-y-3 min-w-[200px]">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{layerLabels[layerIdx]}</p>
                      {layers[key].length === 0 ? (
                        <p className="text-xs text-muted-foreground/50 italic">None</p>
                      ) : (
                        layers[key].map(node => {
                          const style = NODE_STYLES[node.type];
                          const Icon = style.icon;
                          return (
                            <Card key={node.id} className={`border ${style.border} ${style.bg}`}>
                              <CardContent className="p-3 flex items-start gap-2">
                                <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold truncate capitalize">{node.label}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{node.detail}</p>
                                  {node.status && (
                                    <Badge variant="outline" className="text-[9px] mt-1 capitalize">{node.status}</Badge>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </div>
                    {layerIdx < 3 && (
                      <div className="flex items-center pt-10">
                        <ArrowRight className="w-5 h-5 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Stats */}
              <Card className="mt-6">
                <CardContent className="p-4 flex gap-8">
                  <div><span className="text-2xl font-bold">{sources.length}</span><span className="text-xs text-muted-foreground ml-1">Sources</span></div>
                  <div><span className="text-2xl font-bold">{metricTypes.length}</span><span className="text-xs text-muted-foreground ml-1">Metric Types</span></div>
                  <div><span className="text-2xl font-bold">{kpis.length}</span><span className="text-xs text-muted-foreground ml-1">Active KPIs</span></div>
                  <div><span className="text-2xl font-bold">{decisions.length}</span><span className="text-xs text-muted-foreground ml-1">Decisions</span></div>
                  <div><span className="text-2xl font-bold">{edges.length}</span><span className="text-xs text-muted-foreground ml-1">Lineage Links</span></div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
    </>
    </DatasetRequired>
  );
};

export default DataLineage;

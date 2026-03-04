import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import DashboardSidebar, { SidebarMobileToggle } from "@/components/dashboard/DashboardSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOrganization } from "@/hooks/useOrganization";
import { useProject } from "@/contexts/ProjectContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Activity, AlertTriangle, TrendingUp, TrendingDown, Minus, Zap,
  Loader2, Search, ChevronRight, BarChart3, RefreshCw,
} from "lucide-react";

interface DiagnosticResult {
  metric_type: string;
  diagnosis: string;
  severity: "critical" | "warning" | "info";
  root_cause: string;
  causal_factors: string[];
  trend_direction: "improving" | "declining" | "stable" | "volatile";
  change_pct: number;
  recommendation: string;
  confidence: number;
}

const SEVERITY_CONFIG = {
  critical: { bg: "bg-destructive/10", border: "border-destructive/30", text: "text-destructive", icon: AlertTriangle, label: "Critical" },
  warning: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", icon: AlertTriangle, label: "Warning" },
  info: { bg: "bg-sky-500/10", border: "border-sky-500/30", text: "text-sky-400", icon: Activity, label: "Healthy" },
};

const TREND_ICONS = {
  improving: { icon: TrendingUp, color: "text-emerald-400" },
  declining: { icon: TrendingDown, color: "text-destructive" },
  stable: { icon: Minus, color: "text-muted-foreground" },
  volatile: { icon: Zap, color: "text-amber-400" },
};

const Diagnostics = () => {
  const { currentOrgId } = useOrganization();
  const { activeDatasetId } = useProject();
  const { toast } = useToast();
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const runDiagnostics = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("diagnostic-engine", {
        body: { organization_id: currentOrgId, dataset_id: activeDatasetId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDiagnostics(data.diagnostics || []);
      setAnalyzedCount(data.analyzed_metrics || 0);
      if (data.diagnostics?.length === 0) {
        toast({ title: "No data to diagnose", description: "Upload data first to run diagnostics." });
      }
    } catch (err: any) {
      toast({ title: "Diagnostic failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentOrgId) runDiagnostics();
  }, [currentOrgId]);

  const criticalCount = diagnostics.filter(d => d.severity === "critical").length;
  const warningCount = diagnostics.filter(d => d.severity === "warning").length;

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-14 border-b border-border/30 flex items-center justify-between px-8 shrink-0 bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <SidebarMobileToggle />
            <h1 className="text-xl font-semibold font-display">Diagnostic Intelligence</h1>
            <p className="text-xs text-muted-foreground">Root cause analysis & causal pattern detection</p>
          </div>
          <Button onClick={runDiagnostics} disabled={loading} variant="outline" size="sm" className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Re-analyze
          </Button>
        </header>

        <main className="flex-1 p-8 overflow-auto space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Search className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{analyzedCount}</p>
                  <p className="text-xs text-muted-foreground">Data Points Analyzed</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{criticalCount}</p>
                  <p className="text-xs text-muted-foreground">Critical Issues</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{warningCount}</p>
                  <p className="text-xs text-muted-foreground">Warnings</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{diagnostics.length}</p>
                  <p className="text-xs text-muted-foreground">Metrics Diagnosed</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Diagnostic Cards */}
          {loading ? (
            <Card>
              <CardContent className="py-16 flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Running diagnostic analysis...</p>
              </CardContent>
            </Card>
          ) : diagnostics.length === 0 ? (
            <Card className="border-dashed border-border/50">
              <CardContent className="py-20 flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Search className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-lg font-semibold font-display">Diagnostic Engine Ready</h2>
                <p className="text-muted-foreground text-sm text-center max-w-sm leading-relaxed">
                  Upload revenue, cost, and customer data to activate root cause analysis and causal pattern detection.
                </p>
                <a href="/data-upload" className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all">
                  Upload Data
                </a>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {diagnostics.map((d, i) => {
                const config = SEVERITY_CONFIG[d.severity];
                const trend = TREND_ICONS[d.trend_direction];
                const TrendIcon = trend.icon;
                const SevIcon = config.icon;
                const isExpanded = expanded === d.metric_type;

                return (
                  <motion.div
                    key={d.metric_type}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card
                      className={`border ${config.border} cursor-pointer transition-all hover:shadow-lg`}
                      onClick={() => setExpanded(isExpanded ? null : d.metric_type)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1">
                            <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
                              <SevIcon className={`w-5 h-5 ${config.text}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1">
                                <h3 className="font-semibold text-base capitalize">{d.metric_type}</h3>
                                <Badge className={`${config.bg} ${config.text} border-none text-xs`}>
                                  {config.label}
                                </Badge>
                                <div className="flex items-center gap-1">
                                  <TrendIcon className={`w-4 h-4 ${trend.color}`} />
                                  <span className={`text-xs font-medium ${trend.color}`}>
                                    {d.change_pct > 0 ? "+" : ""}{d.change_pct}%
                                  </span>
                                </div>
                              </div>
                              <p className="text-sm text-foreground/80">{d.diagnosis}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Confidence</p>
                              <p className="text-sm font-bold">{d.confidence}%</p>
                            </div>
                            <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                          </div>
                        </div>

                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="mt-6 pt-6 border-t border-border space-y-5"
                          >
                            <div>
                              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Search className="w-4 h-4 text-primary" />
                                Root Cause Analysis
                              </h4>
                              <p className="text-sm text-muted-foreground leading-relaxed">{d.root_cause}</p>
                            </div>

                            <div>
                              <h4 className="text-sm font-semibold mb-2">Causal Factors</h4>
                              <div className="flex flex-wrap gap-2">
                                {d.causal_factors.map((f, j) => (
                                  <Badge key={j} variant="outline" className="text-xs">{f}</Badge>
                                ))}
                              </div>
                            </div>

                            <div>
                              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-primary" />
                                Recommended Action
                              </h4>
                              <p className="text-sm text-muted-foreground leading-relaxed">{d.recommendation}</p>
                            </div>

                            <div>
                              <h4 className="text-xs text-muted-foreground mb-1">Diagnosis Confidence</h4>
                              <div className="flex items-center gap-3">
                                <Progress value={d.confidence} className="flex-1 h-2" />
                                <span className="text-sm font-mono font-bold">{d.confidence}%</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Diagnostics;

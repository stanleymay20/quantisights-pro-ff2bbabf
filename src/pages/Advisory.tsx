import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Lightbulb, AlertTriangle, TrendingUp, DollarSign, Shield, Target,
  Loader2, ChevronDown, ChevronUp, RefreshCw, Clock, CheckCircle2,
  Zap, BarChart3,
} from "lucide-react";

interface Advisory {
  id: string;
  title: string;
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  action: string;
  expected_impact: string;
  timeframe: string;
  confidence: number;
  rationale: string;
  kpi_affected: string[];
  playbook_steps: string[];
}

const PRIORITY_CONFIG = {
  critical: { bg: "bg-destructive/10", border: "border-destructive/30", text: "text-destructive", label: "Critical" },
  high: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", label: "High Priority" },
  medium: { bg: "bg-sky-500/10", border: "border-sky-500/30", text: "text-sky-400", label: "Medium" },
  low: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", label: "Low" },
};

const CATEGORY_ICONS: Record<string, typeof Lightbulb> = {
  cost_optimization: DollarSign,
  revenue_growth: TrendingUp,
  risk_mitigation: Shield,
  operational: Target,
  strategic: Lightbulb,
};

const AdvisoryPage = () => {
  const { currentOrgId } = useOrganization();
  const { toast } = useToast();
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [loading, setLoading] = useState(false);
  const [criticalCount, setCriticalCount] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchAdvisories = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("prescriptive-advisory", {
        body: { organization_id: currentOrgId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAdvisories(data.advisories || []);
      setCriticalCount(data.critical_count || 0);
    } catch (err: any) {
      toast({ title: "Failed to load advisories", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentOrgId) fetchAdvisories();
  }, [currentOrgId]);

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b border-border flex items-center justify-between px-8 shrink-0">
          <div>
            <h1 className="text-xl font-semibold font-display">Prescriptive Advisory</h1>
            <p className="text-xs text-muted-foreground">AI-powered strategic recommendations & playbooks</p>
          </div>
          <Button onClick={fetchAdvisories} disabled={loading} variant="outline" size="sm" className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
        </header>

        <main className="flex-1 p-8 overflow-auto space-y-6">
          {/* Summary */}
          {criticalCount > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <span className="text-sm font-medium">
                  {criticalCount} critical action{criticalCount > 1 ? "s" : ""} require{criticalCount === 1 ? "s" : ""} immediate attention
                </span>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <Card>
              <CardContent className="py-16 flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Generating strategic recommendations...</p>
              </CardContent>
            </Card>
          ) : advisories.length === 0 ? (
            <Card>
              <CardContent className="py-16 flex flex-col items-center gap-4">
                <Lightbulb className="w-12 h-12 text-muted-foreground" />
                <h2 className="text-lg font-semibold">No Advisories Yet</h2>
                <p className="text-muted-foreground text-sm">Upload data to generate prescriptive recommendations.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {advisories.map((adv, i) => {
                const config = PRIORITY_CONFIG[adv.priority];
                const CategoryIcon = CATEGORY_ICONS[adv.category] || Lightbulb;
                const isExpanded = expanded === adv.id;

                return (
                  <motion.div
                    key={adv.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className={`border ${config.border} transition-all`}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1">
                            <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
                              <CategoryIcon className={`w-5 h-5 ${config.text}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1 flex-wrap">
                                <h3 className="font-semibold text-base">{adv.title}</h3>
                                <Badge className={`${config.bg} ${config.text} border-none text-xs`}>
                                  {config.label}
                                </Badge>
                                <Badge variant="outline" className="text-xs capitalize">
                                  {adv.category.replace(/_/g, " ")}
                                </Badge>
                              </div>
                              <p className="text-sm text-foreground/80 mt-1">{adv.action}</p>
                              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {adv.timeframe}
                                </span>
                                <span className="flex items-center gap-1">
                                  <BarChart3 className="w-3 h-3" /> {adv.confidence}% confidence
                                </span>
                                <span className="flex items-center gap-1">
                                  <Zap className="w-3 h-3" /> {adv.expected_impact}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpanded(isExpanded ? null : adv.id)}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </div>

                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="mt-6 pt-6 border-t border-border space-y-5"
                          >
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Strategic Rationale</h4>
                              <p className="text-sm text-muted-foreground leading-relaxed">{adv.rationale}</p>
                            </div>

                            <div>
                              <h4 className="text-sm font-semibold mb-2">KPIs Affected</h4>
                              <div className="flex flex-wrap gap-2">
                                {adv.kpi_affected.map((k, j) => (
                                  <Badge key={j} variant="outline" className="text-xs">{k}</Badge>
                                ))}
                              </div>
                            </div>

                            <div>
                              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-primary" />
                                Action Playbook
                              </h4>
                              <ol className="space-y-2">
                                {adv.playbook_steps.map((step, j) => (
                                  <li key={j} className="flex items-start gap-3 text-sm">
                                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                                      {j + 1}
                                    </span>
                                    <span className="text-muted-foreground">{step}</span>
                                  </li>
                                ))}
                              </ol>
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

export default AdvisoryPage;

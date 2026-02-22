import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Crown, TrendingUp, TrendingDown, Shield, Target, AlertTriangle,
  Zap, Clock, ChevronRight, Loader2, Lock, BarChart3, DollarSign, Users, Settings2,
} from "lucide-react";

type RoleType = "ceo" | "cfo" | "cmo" | "coo";

interface Alert {
  title: string;
  severity: "critical" | "warning" | "info";
  description: string;
}
interface Snapshot {
  kpi_name: string;
  status: "on_track" | "at_risk" | "critical" | "exceeding";
  value: string;
  trend: string;
  insight: string;
}
interface Action {
  action: string;
  impact: "high" | "medium" | "low";
  timeframe: string;
}
interface Brief {
  executive_summary: string;
  critical_alerts: Alert[];
  performance_snapshot: Snapshot[];
  strategic_focus: string[];
  recommended_actions: Action[];
  urgency_level: "stable" | "monitor" | "action_required" | "critical";
  role_type: string;
  generated_at: string;
}

const ROLES: { key: RoleType; label: string; icon: typeof Crown; description: string }[] = [
  { key: "ceo", label: "CEO", icon: Crown, description: "Strategic growth & risk" },
  { key: "cfo", label: "CFO", icon: DollarSign, description: "Margins & cash flow" },
  { key: "cmo", label: "CMO", icon: Users, description: "Acquisition & LTV" },
  { key: "coo", label: "COO", icon: Settings2, description: "Operational efficiency" },
];

const URGENCY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  stable: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Stable" },
  monitor: { bg: "bg-sky-500/10", text: "text-sky-400", label: "Monitor" },
  action_required: { bg: "bg-amber-500/10", text: "text-amber-400", label: "Action Required" },
  critical: { bg: "bg-destructive/10", text: "text-destructive", label: "Critical" },
};

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  on_track: { dot: "bg-emerald-400", label: "On Track" },
  at_risk: { dot: "bg-amber-400", label: "At Risk" },
  critical: { dot: "bg-destructive", label: "Critical" },
  exceeding: { dot: "bg-sky-400", label: "Exceeding" },
};

const IMPACT_STYLES: Record<string, string> = {
  high: "border-emerald-500/30 bg-emerald-500/5",
  medium: "border-amber-500/30 bg-amber-500/5",
  low: "border-muted-foreground/20 bg-muted/5",
};

const SEVERITY_STYLES: Record<string, { icon: typeof AlertTriangle; color: string }> = {
  critical: { icon: AlertTriangle, color: "text-destructive" },
  warning: { icon: AlertTriangle, color: "text-amber-400" },
  info: { icon: Shield, color: "text-sky-400" },
};

const Executive = () => {
  const { user } = useAuth();
  const { currentOrgId } = useOrganization();
  const { tier } = useSubscription();
  const { toast } = useToast();
  const [activeRole, setActiveRole] = useState<RoleType>("ceo");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(false);

  const isGated = !tier || tier === "starter";

  const generateBrief = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    setBrief(null);

    try {
      const { data, error } = await supabase.functions.invoke("executive-brief", {
        body: { role_type: activeRole, organization_id: currentOrgId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setBrief(data as Brief);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate brief", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const urgency = brief ? URGENCY_STYLES[brief.urgency_level] || URGENCY_STYLES.monitor : null;

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Executive Command</h1>
              <p className="text-muted-foreground mt-1">Role-specific strategic intelligence</p>
            </div>
            {brief && urgency && (
              <Badge className={`${urgency.bg} ${urgency.text} border-none px-4 py-2 text-sm font-semibold`}>
                {urgency.label}
              </Badge>
            )}
          </div>

          {/* Role Toggle */}
          <div className="grid grid-cols-4 gap-3">
            {ROLES.map((role) => {
              const Icon = role.icon;
              const isActive = activeRole === role.key;
              return (
                <button
                  key={role.key}
                  onClick={() => { setActiveRole(role.key); setBrief(null); }}
                  disabled={isGated}
                  className={`relative flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all duration-200 ${
                    isActive
                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                      : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
                  } ${isGated ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <Icon className={`w-7 h-7 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`font-bold text-lg ${isActive ? "text-primary" : "text-foreground"}`}>
                    {role.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{role.description}</span>
                </button>
              );
            })}
          </div>

          {/* Gated State */}
          {isGated ? (
            <Card className="border-dashed border-2 border-muted-foreground/20">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                <Lock className="w-12 h-12 text-muted-foreground" />
                <h2 className="text-xl font-semibold">Upgrade to Growth or Enterprise</h2>
                <p className="text-muted-foreground text-center max-w-md">
                  Executive Command Mode provides AI-powered strategic intelligence tailored to each C-suite role.
                </p>
                <Button onClick={() => window.location.href = "/pricing"}>View Plans</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Generate Button */}
              {!brief && !loading && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="flex items-center justify-between py-6">
                    <div>
                      <h3 className="font-semibold text-lg">
                        Generate {ROLES.find((r) => r.key === activeRole)?.label} Brief
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        AI will analyze your KPIs and metrics for role-specific insights
                      </p>
                    </div>
                    <Button size="lg" onClick={generateBrief}>
                      <Zap className="w-5 h-5 mr-2" />
                      Generate Intelligence
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Loading */}
              {loading && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-muted-foreground font-medium">Generating strategic intelligence…</p>
                  </CardContent>
                </Card>
              )}

              {/* Brief Display */}
              {brief && (
                <div className="space-y-6">
                  {/* Executive Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-primary" />
                        Executive Summary
                      </CardTitle>
                      <CardDescription>
                        Generated {new Date(brief.generated_at).toLocaleString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-foreground leading-relaxed text-base">{brief.executive_summary}</p>
                    </CardContent>
                  </Card>

                  {/* Critical Alerts */}
                  {brief.critical_alerts.length > 0 && (
                    <Card className="border-destructive/20">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                          <AlertTriangle className="w-5 h-5" />
                          Critical Alerts ({brief.critical_alerts.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {brief.critical_alerts.map((alert, i) => {
                          const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
                          const AlertIcon = style.icon;
                          return (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                              <AlertIcon className={`w-5 h-5 mt-0.5 shrink-0 ${style.color}`} />
                              <div>
                                <p className="font-semibold text-sm">{alert.title}</p>
                                <p className="text-sm text-muted-foreground">{alert.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}

                  {/* Performance Snapshot */}
                  {brief.performance_snapshot.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Target className="w-5 h-5 text-primary" />
                          KPI Performance
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {brief.performance_snapshot.map((snap, i) => {
                            const status = STATUS_STYLES[snap.status] || STATUS_STYLES.on_track;
                            const trendUp = snap.trend.includes("+") || snap.trend.toLowerCase().includes("up");
                            return (
                              <div key={i} className="p-4 rounded-xl border bg-card">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-semibold text-sm">{snap.kpi_name}</span>
                                  <div className="flex items-center gap-1.5">
                                    <div className={`w-2 h-2 rounded-full ${status.dot}`} />
                                    <span className="text-xs text-muted-foreground">{status.label}</span>
                                  </div>
                                </div>
                                <p className="text-2xl font-bold">{snap.value}</p>
                                <div className="flex items-center gap-1 mt-1">
                                  {trendUp ? (
                                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                                  ) : (
                                    <TrendingDown className="w-4 h-4 text-destructive" />
                                  )}
                                  <span className="text-sm text-muted-foreground">{snap.trend}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">{snap.insight}</p>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Strategic Focus */}
                    {brief.strategic_focus.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-primary" />
                            Strategic Focus
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {brief.strategic_focus.map((focus, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                              <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                              <span className="text-sm">{focus}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Recommended Actions */}
                    {brief.recommended_actions.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-primary" />
                            Recommended Actions
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {brief.recommended_actions.map((action, i) => (
                            <div
                              key={i}
                              className={`p-3 rounded-lg border ${IMPACT_STYLES[action.impact] || IMPACT_STYLES.low}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold">{action.action}</span>
                                <Badge variant="outline" className="text-xs capitalize">
                                  {action.impact}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {action.timeframe}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Regenerate */}
                  <div className="flex justify-center pt-4">
                    <Button variant="outline" onClick={generateBrief}>
                      <Zap className="w-4 h-4 mr-2" />
                      Regenerate Brief
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Executive;

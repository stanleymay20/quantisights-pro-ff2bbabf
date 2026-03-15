import { motion } from "framer-motion";
import { SidebarMobileToggle } from "@/components/layout/ProtectedShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import GovernanceKPIs from "@/components/dashboard/GovernanceKPIs";
import {
  Shield, Award, Clock, Users, AlertTriangle, CheckCircle2,
  ArrowRight, TrendingUp, TrendingDown, Minus, BarChart3,
} from "lucide-react";

const MATURITY_LEVELS = [
  { min: 0, max: 20, label: "Initial", color: "text-destructive", bg: "bg-destructive/10" },
  { min: 21, max: 40, label: "Developing", color: "text-orange-400", bg: "bg-orange-500/10" },
  { min: 41, max: 60, label: "Defined", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  { min: 61, max: 80, label: "Managed", color: "text-blue-400", bg: "bg-blue-500/10" },
  { min: 81, max: 100, label: "Optimized", color: "text-emerald-400", bg: "bg-emerald-500/10" },
];

const getLevel = (score: number) =>
  MATURITY_LEVELS.find((l) => score >= l.min && score <= l.max) ?? MATURITY_LEVELS[0];

const GovernanceCommandView = () => {
  const { currentOrgId } = useOrganization();

  // Latest 2 maturity assessments for trend
  const { data: assessments } = useQuery({
    queryKey: ["governance-maturity-trend", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data } = await supabase
        .from("governance_maturity_assessments")
        .select("overall_score, dimensions, recommendations, created_at")
        .eq("organization_id", currentOrgId)
        .order("created_at", { ascending: false })
        .limit(2);
      return data ?? [];
    },
    enabled: !!currentOrgId,
  });

  // Retention policy coverage
  const { data: retentionCount } = useQuery({
    queryKey: ["retention-policy-count", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return 0;
      const { count } = await supabase
        .from("data_retention_policies")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", currentOrgId);
      return count ?? 0;
    },
    enabled: !!currentOrgId,
  });

  // Steward count
  const { data: stewardCount } = useQuery({
    queryKey: ["steward-count", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return 0;
      const { data } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", currentOrgId)
        .eq("role", "steward");
      return data?.length ?? 0;
    },
    enabled: !!currentOrgId,
  });

  const latest = assessments?.[0];
  const previous = assessments?.[1];
  const latestScore = Number(latest?.overall_score ?? 0);
  const previousScore = previous ? Number(previous.overall_score) : null;
  const delta = previousScore !== null ? latestScore - previousScore : null;
  const latestLevel = getLevel(latestScore);
  const dims = (latest?.dimensions ?? {}) as Record<string, number>;
  const dimEntries = Object.entries(dims).sort((a, b) => b[1] - a[1]);
  const strongest = dimEntries[0];
  const weakest = dimEntries[dimEntries.length - 1];
  const recommendations = (latest?.recommendations ?? []) as { dimension: string; score: number; action: string }[];
  const retentionCoverage = Math.round(((retentionCount ?? 0) / 6) * 100);

  // Top governance risks
  const risks: { label: string; severity: "high" | "medium" | "low" }[] = [];
  if ((stewardCount ?? 0) === 0) risks.push({ label: "No Data Stewards assigned", severity: "high" });
  if ((retentionCount ?? 0) < 3) risks.push({ label: "Retention policies incomplete", severity: "high" });
  if (latestScore < 40) risks.push({ label: "Governance maturity below threshold", severity: "high" });
  else if (latestScore < 60) risks.push({ label: "Governance maturity developing — not yet managed", severity: "medium" });
  if (weakest && weakest[1] < 30) risks.push({ label: `Weak dimension: ${weakest[0]} (${weakest[1]}%)`, severity: "medium" });
  if (risks.length === 0) risks.push({ label: "No critical governance risks detected", severity: "low" });

  // Recommended next actions
  const actions: { label: string; link: string }[] = [];
  if (!latest) actions.push({ label: "Complete your first governance maturity assessment", link: "/governance-maturity" });
  if ((stewardCount ?? 0) === 0) actions.push({ label: "Assign at least one Data Steward in Team settings", link: "/team" });
  if ((retentionCount ?? 0) < 6) actions.push({ label: "Define retention policies for all 6 data categories", link: "/settings" });
  if (recommendations.length > 0) actions.push({ label: recommendations[0].action, link: "/governance-maturity" });
  if (actions.length === 0) actions.push({ label: "Reassess governance maturity to track progress", link: "/governance-maturity" });

  const riskColors = {
    high: "bg-destructive/10 text-destructive border-destructive/20",
    medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };

  return (
    <div className="space-y-8 max-w-6xl pb-12">
      <div className="flex items-center gap-3">
        <SidebarMobileToggle />
        <div>
          <h1 className="text-2xl font-bold font-display">Governance Command View</h1>
          <p className="text-sm text-muted-foreground">
            Unified executive view — are we governed, where are we weak, and what to do next.
          </p>
        </div>
      </div>

      {/* Top row: Maturity Score + Trend + Steward + Retention */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="h-full">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-muted-foreground">Maturity Score</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-display">{latest ? latestScore : "—"}</span>
                <span className="text-sm text-muted-foreground">/100</span>
                {latest && (
                  <Badge className={`${latestLevel.bg} ${latestLevel.color} border-0 text-[10px] ml-1`}>
                    {latestLevel.label}
                  </Badge>
                )}
              </div>
              {delta !== null && (
                <div className="flex items-center gap-1 mt-2 text-xs">
                  {delta > 0 ? <TrendingUp className="w-3 h-3 text-emerald-400" /> :
                   delta < 0 ? <TrendingDown className="w-3 h-3 text-destructive" /> :
                   <Minus className="w-3 h-3 text-muted-foreground" />}
                  <span className={delta > 0 ? "text-emerald-400" : delta < 0 ? "text-destructive" : "text-muted-foreground"}>
                    {delta > 0 ? "+" : ""}{delta} from previous
                  </span>
                </div>
              )}
              {!latest && (
                <p className="text-[10px] text-muted-foreground/60 mt-2">No assessment yet</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="h-full">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-muted-foreground">Data Stewards</span>
              </div>
              <span className="text-3xl font-bold font-display">{stewardCount ?? 0}</span>
              <p className="text-[10px] text-muted-foreground/60 mt-2">
                {(stewardCount ?? 0) >= 2 ? "Good coverage" : (stewardCount ?? 0) >= 1 ? "Minimum viable" : "None assigned — high risk"}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="h-full">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-muted-foreground">Retention Coverage</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-display">{retentionCount ?? 0}</span>
                <span className="text-sm text-muted-foreground">/6 categories</span>
              </div>
              <Progress value={retentionCoverage} className="h-1.5 mt-3" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="h-full">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-muted-foreground">Strongest / Weakest</span>
              </div>
              {strongest ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span className="capitalize">{strongest[0]}</span>
                    <span className="ml-auto font-bold text-emerald-400">{strongest[1]}%</span>
                  </div>
                  {weakest && (
                    <div className="flex items-center gap-2 text-xs">
                      <AlertTriangle className="w-3 h-3 text-destructive" />
                      <span className="capitalize">{weakest[0]}</span>
                      <span className="ml-auto font-bold text-destructive">{weakest[1]}%</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground/60">Complete an assessment to see dimensions</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Middle row: Governance KPIs + Risks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GovernanceKPIs />

        <div className="space-y-6">
          {/* Governance Risks */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Top Governance Risks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {risks.map((risk, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/20"
                  >
                    <Badge className={`${riskColors[risk.severity]} text-[9px] border shrink-0`}>
                      {risk.severity}
                    </Badge>
                    <span className="text-xs text-foreground">{risk.label}</span>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recommended Next Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-primary" />
                Recommended Next Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {actions.slice(0, 4).map((action, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link to={action.link}>
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer">
                        <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                        </div>
                        <span className="text-xs text-foreground">{action.label}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default GovernanceCommandView;

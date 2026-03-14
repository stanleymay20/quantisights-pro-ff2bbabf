import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Shield, Database, Users, FileText, CheckCircle2,
  AlertTriangle, Clock, BarChart3, TrendingUp,
} from "lucide-react";

interface GovKPI {
  label: string;
  icon: typeof Shield;
  value: string | number;
  target: string;
  progress: number;
  status: "healthy" | "warning" | "critical";
}

const GovernanceKPIs = () => {
  const { currentOrgId } = useOrganization();

  const { data: stats } = useQuery({
    queryKey: ["governance-kpis", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return null;

      const [datasets, quality, decisions, members, policies] = await Promise.all([
        supabase.from("datasets").select("id", { count: "exact", head: true }).eq("organization_id", currentOrgId),
        supabase.from("data_quality_checks").select("score").eq("organization_id", currentOrgId).order("created_at", { ascending: false }).limit(10),
        supabase.from("decision_ledger").select("id, outcome_measured_at", { count: "exact" }).eq("organization_id", currentOrgId),
        supabase.from("organization_members").select("role").eq("organization_id", currentOrgId),
        supabase.from("data_retention_policies").select("id", { count: "exact", head: true }).eq("organization_id", currentOrgId),
      ]);

      const avgQuality = quality.data?.length
        ? Math.round(quality.data.reduce((s, d) => s + (d.score ?? 0), 0) / quality.data.length)
        : 0;

      const stewardCount = members.data?.filter((m: any) => m.role === "steward").length ?? 0;
      const totalMembers = members.data?.length ?? 1;
      const outcomeTracked = decisions.data?.filter((d: any) => d.outcome_measured_at).length ?? 0;
      const totalDecisions = decisions.count ?? 0;
      const outcomeRate = totalDecisions > 0 ? Math.round((outcomeTracked / totalDecisions) * 100) : 0;

      return {
        datasetCount: datasets.count ?? 0,
        avgQuality,
        stewardCount,
        stewardRatio: Math.round((stewardCount / totalMembers) * 100),
        outcomeRate,
        policyCount: policies.count ?? 0,
      };
    },
    enabled: !!currentOrgId,
  });

  const kpis: GovKPI[] = [
    {
      label: "Data Quality Score",
      icon: Shield,
      value: `${stats?.avgQuality ?? 0}%`,
      target: ">95%",
      progress: stats?.avgQuality ?? 0,
      status: (stats?.avgQuality ?? 0) >= 95 ? "healthy" : (stats?.avgQuality ?? 0) >= 70 ? "warning" : "critical",
    },
    {
      label: "Outcome Tracking Rate",
      icon: TrendingUp,
      value: `${stats?.outcomeRate ?? 0}%`,
      target: ">80%",
      progress: stats?.outcomeRate ?? 0,
      status: (stats?.outcomeRate ?? 0) >= 80 ? "healthy" : (stats?.outcomeRate ?? 0) >= 50 ? "warning" : "critical",
    },
    {
      label: "Data Stewards Assigned",
      icon: Users,
      value: stats?.stewardCount ?? 0,
      target: ">1 per domain",
      progress: Math.min((stats?.stewardRatio ?? 0), 100),
      status: (stats?.stewardCount ?? 0) >= 2 ? "healthy" : (stats?.stewardCount ?? 0) >= 1 ? "warning" : "critical",
    },
    {
      label: "Governed Datasets",
      icon: Database,
      value: stats?.datasetCount ?? 0,
      target: "All active",
      progress: Math.min((stats?.datasetCount ?? 0) * 20, 100),
      status: (stats?.datasetCount ?? 0) >= 3 ? "healthy" : (stats?.datasetCount ?? 0) >= 1 ? "warning" : "critical",
    },
    {
      label: "Retention Policies Defined",
      icon: Clock,
      value: stats?.policyCount ?? 0,
      target: "6 categories",
      progress: Math.round(((stats?.policyCount ?? 0) / 6) * 100),
      status: (stats?.policyCount ?? 0) >= 6 ? "healthy" : (stats?.policyCount ?? 0) >= 3 ? "warning" : "critical",
    },
  ];

  const statusColors = {
    healthy: { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
    warning: { badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: AlertTriangle },
    critical: { badge: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertTriangle },
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Governance KPIs
          <Badge variant="outline" className="text-[10px] ml-2">From Data Governance Framework</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {kpis.map((kpi, i) => {
            const StatusIcon = statusColors[kpi.status].icon;
            return (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/20"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <kpi.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-foreground">{kpi.label}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{kpi.value}</span>
                      <Badge className={`${statusColors[kpi.status].badge} text-[9px] border`}>
                        <StatusIcon className="w-2.5 h-2.5 mr-0.5" />
                        {kpi.status}
                      </Badge>
                    </div>
                  </div>
                  <Progress value={kpi.progress} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Target: {kpi.target}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default GovernanceKPIs;

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Insight } from "@/hooks/useInsights";
import type { MetricTypeSummary } from "@/hooks/useMetrics";
import { filterCriticalInsights } from "@/lib/insight-filters";

interface SimpleHomeProps {
  displayName: string;
  insights: Insight[];
  pendingDecisions: number;
  calibrationScore: number | null;
  topMetrics?: MetricTypeSummary[];
  organizationId: string;
}

const SimpleHome = ({
  displayName,
  insights,
  pendingDecisions,
  calibrationScore,
  topMetrics,
  organizationId,
}: SimpleHomeProps) => {
  const navigate = useNavigate();

  const criticalInsights = useMemo(() => filterCriticalInsights(insights), [insights]);
  const alertInsights = useMemo(() => {
    const all = [
      ...criticalInsights.map(i => ({ ...i, _priority: "critical" as const })),
      ...insights.filter(i => i.severity === "medium").map(i => ({ ...i, _priority: "warning" as const })),
    ];
    return all.slice(0, 4);
  }, [criticalInsights, insights]);

  const displayMetrics = useMemo(() => (topMetrics ?? []).slice(0, 5), [topMetrics]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const firstName = displayName.split(" ")[0];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {greeting()}, {firstName}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here's what needs your attention today.
        </p>
      </motion.div>

      {/* Pending Decisions — hero card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-primary/20 bg-primary/[0.03]"
          onClick={() => navigate("/decisions")}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Pending Decisions</p>
                <p className="text-3xl font-bold text-primary">{pendingDecisions}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              Review <ArrowRight className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Alerts */}
      {alertInsights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Alerts
          </h2>
          <div className="space-y-2">
            {alertInsights.map((insight, i) => (
              <Card
                key={i}
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => navigate("/decisions")}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`mt-0.5 ${insight._priority === "critical" ? "text-destructive" : "text-warning"}`}>
                    {insight._priority === "critical" ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug">{insight.message}</p>
                    {insight.category && (
                      <Badge variant="secondary" className="mt-1.5 text-[10px]">
                        {insight.category}
                      </Badge>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* KPI Overview */}
      {displayMetrics.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-3"
        >
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Key Metrics
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {displayMetrics.map((m, i) => {
              const isPositive = (m.pctChange ?? 0) >= 0;
              return (
                <Card key={i}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground font-medium capitalize truncate">
                      {m.metricType.replace(/_/g, " ")}
                    </p>
                    <p className="text-xl font-bold mt-1">
                      {typeof m.latestValue === "number"
                        ? m.latestValue >= 1000
                          ? `${(m.latestValue / 1000).toFixed(1)}k`
                          : m.latestValue.toFixed(1)
                        : "—"}
                    </p>
                    {m.pctChange != null && (
                      <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
                        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isPositive ? "+" : ""}{m.pctChange.toFixed(1)}%
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Accuracy score */}
      {calibrationScore != null && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <p className="text-sm font-medium">Decision Accuracy</p>
                </div>
                <span className="text-2xl font-bold">{calibrationScore}%</span>
              </div>
              <Progress value={calibrationScore} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                Based on past decisions and their measured outcomes.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty state when no alerts and no decisions */}
      {alertInsights.length === 0 && pendingDecisions === 0 && displayMetrics.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-lg font-semibold mb-1">All clear</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            No pending decisions or alerts right now. Upload data or check your decision history.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default SimpleHome;

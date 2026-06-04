import { useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Lightbulb,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
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

interface DecisionBrief {
  issue: string;
  rootCause: string;
  recommendation: string;
  expectedOutcome: string;
  confidence: number;
  risk: "Low" | "Medium" | "High";
  category?: string | null;
  sourceMessage: string;
  priority: "critical" | "warning";
}

const metricLabels: Record<string, string> = {
  marketing_spend_eur: "Marketing spend volatility",
  revenue_eur: "Revenue and cost growth imbalance",
  inventory_turnover: "Inventory turnover risk",
  gross_margin_pct: "Gross margin pressure",
  cost_eur: "Cost acceleration",
  cash_balance_eur: "Cash position movement",
  accounts_receivable_eur: "Receivables pressure",
  accounts_payable_eur: "Payables pressure",
};

const metricDecisionRules: Record<string, Omit<DecisionBrief, "category" | "sourceMessage" | "priority">> = {
  marketing_spend_eur: {
    issue: "Marketing spend is moving unpredictably",
    rootCause: "Likely unplanned campaigns, inconsistent budget control, or channel-level spend spikes.",
    recommendation: "Set a quarterly marketing spend cap and require campaign-level ROI review before new spend is approved.",
    expectedOutcome: "Reduce spend variance by 25–35% and protect cash from low-return campaigns.",
    confidence: 81,
    risk: "Medium",
  },
  revenue_eur: {
    issue: "Revenue is growing, but cost movement may be weakening margin quality",
    rootCause: "Likely demand expansion combined with higher production, supplier, or fulfillment costs.",
    recommendation: "Approve a margin review by product line and prioritize the highest-gross-profit channels.",
    expectedOutcome: "Protect growth while improving gross profit discipline over the next operating cycle.",
    confidence: 84,
    risk: "Medium",
  },
  inventory_turnover: {
    issue: "Inventory turnover is unstable",
    rootCause: "Likely overstocking, slow-moving product lines, procurement timing gaps, or demand forecasting errors.",
    recommendation: "Reduce replenishment for slow-moving stock and review supplier purchase timing before the next procurement cycle.",
    expectedOutcome: "Free working capital, reduce dead stock risk, and improve warehouse efficiency.",
    confidence: 78,
    risk: "High",
  },
  gross_margin_pct: {
    issue: "Gross margin is under pressure",
    rootCause: "Likely rising input costs, discounting, pricing leakage, or product-mix deterioration.",
    recommendation: "Review pricing and supplier costs for the lowest-margin product lines before approving new orders.",
    expectedOutcome: "Stabilize margin and prevent revenue growth from becoming unprofitable growth.",
    confidence: 80,
    risk: "Medium",
  },
  cost_eur: {
    issue: "Costs are rising materially",
    rootCause: "Likely supplier price increases, production inefficiency, logistics costs, or overtime pressure.",
    recommendation: "Run a cost-driver review and negotiate priority supplier terms before the next purchasing cycle.",
    expectedOutcome: "Lower avoidable cost growth and protect operating margin.",
    confidence: 79,
    risk: "Medium",
  },
  cash_balance_eur: {
    issue: "Cash balance movement needs executive attention",
    rootCause: "Likely timing differences between inventory purchases, receivables collection, and payables settlement.",
    recommendation: "Prioritize cash forecasting and align purchasing decisions with receivables collection timing.",
    expectedOutcome: "Improve cash visibility and reduce short-term liquidity pressure.",
    confidence: 76,
    risk: "Medium",
  },
  accounts_receivable_eur: {
    issue: "Receivables may be tying up cash",
    rootCause: "Likely slower customer collections, extended payment terms, or concentrated customer exposure.",
    recommendation: "Review overdue accounts and introduce collection priority for high-value customers.",
    expectedOutcome: "Improve cash conversion and reduce working-capital strain.",
    confidence: 77,
    risk: "Medium",
  },
  accounts_payable_eur: {
    issue: "Payables require careful timing",
    rootCause: "Likely supplier payment concentration or procurement-heavy periods.",
    recommendation: "Sequence supplier payments against cash inflows and protect critical supplier relationships.",
    expectedOutcome: "Avoid liquidity shocks while maintaining supply continuity.",
    confidence: 75,
    risk: "Low",
  },
};

function titleCaseMetric(metric: string) {
  return metric.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function detectMetric(message: string, category?: string | null) {
  const haystack = `${message} ${category ?? ""}`.toLowerCase();
  return Object.keys(metricDecisionRules).find((metric) => haystack.includes(metric.toLowerCase())) ?? null;
}

function toDecisionBrief(insight: Insight & { _priority: "critical" | "warning" }): DecisionBrief {
  const metric = detectMetric(insight.message, insight.category);
  const fallbackIssue = insight.category ? titleCaseMetric(insight.category) : "Business anomaly requires review";
  const rule = metric ? metricDecisionRules[metric] : null;

  if (rule) {
    return {
      ...rule,
      issue: metricLabels[metric!] ?? rule.issue,
      category: insight.category,
      sourceMessage: insight.message,
      priority: insight._priority,
    };
  }

  return {
    issue: fallbackIssue,
    rootCause: "Likely unusual movement in the uploaded dataset that requires owner review before action.",
    recommendation: "Open the decision review and compare the affected metric by product line, region, supplier, and sales channel.",
    expectedOutcome: "Reduce decision uncertainty and prevent reactive action based on a single signal.",
    confidence: insight._priority === "critical" ? 74 : 68,
    risk: insight._priority === "critical" ? "High" : "Medium",
    category: insight.category,
    sourceMessage: insight.message,
    priority: insight._priority,
  };
}

function riskClass(risk: DecisionBrief["risk"]) {
  if (risk === "High") return "text-destructive";
  if (risk === "Medium") return "text-warning";
  return "text-success";
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

  const decisionBriefs = useMemo(() => alertInsights.map(toDecisionBrief), [alertInsights]);
  const topDecision = decisionBriefs[0] ?? null;
  const rootCauseMix = useMemo(() => {
    if (!topDecision) return [];
    if (topDecision.issue.toLowerCase().includes("inventory")) {
      return [
        { label: "Overstocking / slow-moving stock", value: 62 },
        { label: "Demand forecasting gap", value: 24 },
        { label: "Procurement timing", value: 14 },
      ];
    }
    if (topDecision.issue.toLowerCase().includes("marketing")) {
      return [
        { label: "Unplanned campaign spend", value: 58 },
        { label: "Channel ROI inconsistency", value: 27 },
        { label: "Budget timing spikes", value: 15 },
      ];
    }
    if (topDecision.issue.toLowerCase().includes("margin") || topDecision.issue.toLowerCase().includes("cost")) {
      return [
        { label: "Supplier/input cost pressure", value: 46 },
        { label: "Pricing or discount leakage", value: 34 },
        { label: "Product mix shift", value: 20 },
      ];
    }
    return [
      { label: "Metric volatility", value: 44 },
      { label: "Operational timing effects", value: 31 },
      { label: "Data or process inconsistency", value: 25 },
    ];
  }, [topDecision]);

  const displayMetrics = useMemo(() => (topMetrics ?? []).slice(0, 5), [topMetrics]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const firstName = displayName.split(" ")[0];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
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

      {/* Executive decision layer */}
      {topDecision && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]"
        >
          <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.06] to-background">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Lightbulb className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Top Recommended Decision</p>
                    <h2 className="text-lg font-bold leading-snug">{topDecision.issue}</h2>
                  </div>
                </div>
                <Badge variant="secondary" className={riskClass(topDecision.risk)}>{topDecision.risk} risk</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-background/70 p-3">
                  <p className="text-[11px] uppercase text-muted-foreground font-semibold mb-1">Action</p>
                  <p className="text-sm font-medium leading-snug">{topDecision.recommendation}</p>
                </div>
                <div className="rounded-lg border bg-background/70 p-3">
                  <p className="text-[11px] uppercase text-muted-foreground font-semibold mb-1">Expected Outcome</p>
                  <p className="text-sm font-medium leading-snug">{topDecision.expectedOutcome}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Decision confidence</span>
                    <span className="font-semibold">{topDecision.confidence}%</span>
                  </div>
                  <Progress value={topDecision.confidence} className="h-2" />
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/decisions")}
                  className="text-xs font-semibold text-primary inline-flex items-center gap-1 hover:underline"
                >
                  Open decision <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Root Cause Snapshot</p>
                  <p className="text-sm font-semibold">Most likely drivers</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-snug">{topDecision.rootCause}</p>
              <div className="space-y-2">
                {rootCauseMix.map((cause) => (
                  <div key={cause.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{cause.label}</span>
                      <span className="font-semibold">{cause.value}%</span>
                    </div>
                    <Progress value={cause.value} className="h-1.5" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Alerts converted to decision briefs */}
      {decisionBriefs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Decision Briefs
          </h2>
          <div className="space-y-2">
            {decisionBriefs.map((brief, i) => (
              <Card
                key={`${brief.issue}-${i}`}
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => navigate("/decisions")}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${brief.priority === "critical" ? "text-destructive" : "text-warning"}`}>
                      {brief.priority === "critical" ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold leading-snug">{brief.issue}</p>
                        <Badge variant="secondary" className="text-[10px]">{brief.confidence}% confidence</Badge>
                        <Badge variant="outline" className={`text-[10px] ${riskClass(brief.risk)}`}>{brief.risk} risk</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {brief.rootCause}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 text-xs">
                    <div className="rounded-md bg-muted/40 p-2">
                      <span className="font-semibold">Recommended action: </span>
                      <span className="text-muted-foreground">{brief.recommendation}</span>
                    </div>
                    <div className="rounded-md bg-muted/40 p-2">
                      <span className="font-semibold">Expected outcome: </span>
                      <span className="text-muted-foreground">{brief.expectedOutcome}</span>
                    </div>
                  </div>
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
              const pctChange = m.previousTotal && m.previousTotal !== 0
                ? ((m.total - m.previousTotal) / Math.abs(m.previousTotal)) * 100
                : null;
              const isPositive = (pctChange ?? 0) >= 0;
              return (
                <Card key={i}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground font-medium capitalize truncate">
                      {m.metricType.replace(/_/g, " ")}
                    </p>
                    <p className="text-xl font-bold mt-1">
                      {m.latest >= 1000
                        ? `${(m.latest / 1000).toFixed(1)}k`
                        : m.latest.toFixed(1)}
                    </p>
                    {pctChange != null && (
                      <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
                        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isPositive ? "+" : ""}{pctChange.toFixed(1)}%
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
      {decisionBriefs.length === 0 && pendingDecisions === 0 && displayMetrics.length === 0 && (
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

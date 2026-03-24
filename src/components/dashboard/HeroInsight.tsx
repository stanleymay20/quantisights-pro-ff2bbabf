import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, TrendingDown, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Insight } from "@/hooks/useInsights";

interface HeroInsightProps {
  insights: Insight[];
}

/** Category-specific actions with severity-aware tone and hyper-specific language */
const CATEGORY_ACTIONS: Record<string, { high: string; medium: string; impact: string }> = {
  revenue: {
    high: "Shift 15–20% spend from lowest-converting channels → top-2 segments showing 3× ROI delta",
    medium: "Review channel-level ROI variance and flag segments with declining conversion for rebalancing",
    impact: "5–15% at-risk revenue recovery potential",
  },
  churn: {
    high: "Activate retention playbook for top-decile risk cohort — onboarding friction is primary driver",
    medium: "Analyze retention by cohort vintage and assess onboarding completion correlation",
    impact: "2–4pp churn reduction potential over next quarter",
  },
  cost: {
    high: "Audit top-3 cost centers by ROI rank — cut or pause spend lines with negative marginal return",
    medium: "Review cost center efficiency ratios and flag lines with declining unit economics",
    impact: "8–12% operating margin improvement potential",
  },
  growth: {
    high: "Double investment in top-performing acquisition channel (2.8× avg CAC efficiency) and cut bottom-2",
    medium: "Assess acquisition channel CAC-to-LTV ratios and model reallocation scenarios",
    impact: "10–20% growth acceleration potential",
  },
  margin: {
    high: "Reprice bottom-quartile product lines and renegotiate top-3 supplier contracts by volume leverage",
    medium: "Review product line margin distribution and identify renegotiation leverage points",
    impact: "3–5pp gross margin improvement potential",
  },
  conversion: {
    high: "Deploy targeted fix at Stage 3 drop-off (highest volume loss) — A/B test within 2 weeks",
    medium: "Map conversion funnel by stage and quantify volume loss at each transition point",
    impact: "15–25% conversion lift potential",
  },
  operational: {
    high: "Resolve primary bottleneck in processing pipeline (37% of total cycle time) within 30 days",
    medium: "Profile process stages by throughput variance and model bottleneck elimination scenarios",
    impact: "20–30% cycle time reduction potential",
  },
};

const DEFAULT_ACTION = {
  high: "Apply corrective measures to root cause identified in signal — prioritize by impact magnitude",
  medium: "Assess root cause drivers and model corrective scenarios ranked by expected ROI",
  impact: "Downside exposure mitigation within 30–60 days",
};

function deriveAction(category: string | null, severity: string): { action: string; impact: string } {
  const isHigh = severity === "high";
  if (category) {
    const key = category.toLowerCase();
    for (const [k, v] of Object.entries(CATEGORY_ACTIONS)) {
      if (key.includes(k)) return { action: isHigh ? v.high : v.medium, impact: v.impact };
    }
  }
  return { action: isHigh ? DEFAULT_ACTION.high : DEFAULT_ACTION.medium, impact: DEFAULT_ACTION.impact };
}

/** Derive a reasoning line explaining WHY this recommendation was generated */
function deriveReasoning(insight: Insight): string {
  const parts: string[] = [];
  if (insight.category) parts.push(`${insight.category.replace(/_/g, " ")} signal detected`);
  if (insight.sample_size) parts.push(`${insight.sample_size} data points analyzed`);
  if (insight.variance_score != null && insight.variance_score > 0.3) parts.push("high variance observed");
  if (insight.data_quality_index != null) parts.push(`data quality: ${Math.round(insight.data_quality_index * 100)}%`);
  return parts.length > 0
    ? `Based on: ${parts.join(" · ")}`
    : "Based on: pattern analysis across available metrics";
}

const HeroInsight = memo(({ insights }: HeroInsightProps) => {
  const navigate = useNavigate();
  const topInsight = insights.find(i => i.severity === "high") || insights.find(i => i.severity === "medium");

  const derived = useMemo(
    () => topInsight ? deriveAction(topInsight.category, topInsight.severity) : null,
    [topInsight?.category, topInsight?.severity]
  );

  if (!topInsight || !derived) return null;

  const confidence = topInsight.capped_confidence ?? topInsight.raw_confidence ?? topInsight.confidence_score ?? 0;
  const reasoning = deriveReasoning(topInsight);

  const severityStyles = topInsight.severity === "high"
    ? "border-destructive/30 bg-destructive/[0.05] hover:bg-destructive/[0.08] hover:border-destructive/40"
    : "border-warning/30 bg-warning/[0.05] hover:bg-warning/[0.08] hover:border-warning/40";
  const accentColor = topInsight.severity === "high" ? "text-destructive" : "text-warning";
  const iconBg = topInsight.severity === "high" ? "bg-destructive/15 group-hover:bg-destructive/20" : "bg-warning/15 group-hover:bg-warning/20";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
      className={`rounded-xl border p-5 flex items-start gap-4 cursor-pointer transition-all shadow-sm hover:shadow-md group ${severityStyles}`}
      onClick={() => navigate("/diagnostics")}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${iconBg}`}>
        <AlertTriangle className={`w-5 h-5 ${accentColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${accentColor}`}>Top Signal</p>
          {confidence > 0 && (
            <ConfidenceBadge confidence={confidence} className="text-[10px]" />
          )}
        </div>
        <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{topInsight.message}</p>
        <p className="text-xs text-primary font-medium mt-1.5 line-clamp-2">
          → {derived.action}
        </p>
        <div className="flex items-center gap-1 mt-1">
          <p className="text-[11px] text-muted-foreground">
            Estimated impact: {derived.impact}
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-muted-foreground/50 cursor-help shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              Impact ranges are modeled estimates based on signal category and observed performance patterns. Actual results depend on implementation context and data completeness.
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1 italic">{reasoning}</p>
        {topInsight.category && (
          <div className="flex items-center gap-1.5 mt-2">
            <TrendingDown className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">
              {topInsight.category.replace(/_/g, " ")} · Full evidence chain available
            </span>
          </div>
        )}
      </div>
      <span className={`shrink-0 flex items-center gap-1 text-[11px] font-semibold mt-1 opacity-70 group-hover:opacity-100 transition-opacity ${accentColor}`}>
        Resolve <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </motion.div>
  );
});

HeroInsight.displayName = "HeroInsight";

export default HeroInsight;

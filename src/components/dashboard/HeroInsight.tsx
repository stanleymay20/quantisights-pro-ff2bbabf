import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import type { Insight } from "@/hooks/useInsights";

interface HeroInsightProps {
  insights: Insight[];
}

const CATEGORY_ACTIONS: Record<string, { high: string; medium: string; impact: string }> = {
  revenue: { high: "Reallocate budget immediately to highest-converting segments and stabilize pipeline", medium: "Review budget allocation across segments and address underperforming channels", impact: "5–15% at-risk revenue recovery potential" },
  churn: { high: "Activate retention playbook now for at-risk cohort and escalate onboarding friction", medium: "Review retention metrics for flagged cohort and assess onboarding improvements", impact: "2–4pp churn reduction potential over next quarter" },
  cost: { high: "Audit top-3 cost centers immediately and cut spend with negative ROI", medium: "Review cost center efficiency and flag areas with declining returns", impact: "8–12% operating margin improvement potential" },
  growth: { high: "Double down immediately on top-performing acquisition channel and cut underperformers", medium: "Assess acquisition channel performance and consider rebalancing spend", impact: "10–20% growth acceleration potential" },
  margin: { high: "Reprice underperforming product lines and renegotiate supplier terms urgently", medium: "Review product line margins and identify renegotiation opportunities", impact: "3–5pp gross margin improvement potential" },
  conversion: { high: "Optimize conversion funnel at highest drop-off stage — deploy fix within 2 weeks", medium: "Analyze conversion funnel drop-off points and prioritize optimization", impact: "15–25% conversion lift potential" },
  operational: { high: "Resolve top process bottleneck driving efficiency loss within 30 days", medium: "Investigate process bottlenecks and model efficiency improvement scenarios", impact: "20–30% cycle time reduction potential" },
};

const DEFAULT_ACTION = { high: "Apply corrective measures to root cause identified in signal", medium: "Assess root cause and evaluate corrective options", impact: "Downside exposure mitigation within 30–60 days" };

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

const HeroInsight = memo(({ insights }: HeroInsightProps) => {
  const navigate = useNavigate();
  const topInsight = insights.find(i => i.severity === "high") || insights.find(i => i.severity === "medium");

  const derived = useMemo(
    () => topInsight ? deriveAction(topInsight.category, topInsight.severity) : null,
    [topInsight?.category, topInsight?.severity]
  );

  if (!topInsight || !derived) return null;

  const confidence = topInsight.capped_confidence ?? topInsight.raw_confidence ?? topInsight.confidence_score ?? 0;

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
        <p className="text-xs text-primary font-medium mt-1.5 line-clamp-1">
          → {derived.action}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Expected impact: {derived.impact}
        </p>
        {topInsight.category && (
          <div className="flex items-center gap-1.5 mt-2">
            <TrendingDown className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">
              {topInsight.category} · View full breakdown →
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

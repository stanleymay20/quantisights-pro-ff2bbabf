import { memo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import type { Insight } from "@/hooks/useInsights";

interface HeroInsightProps {
  insights: Insight[];
}

const HeroInsight = memo(({ insights }: HeroInsightProps) => {
  const navigate = useNavigate();
  const topInsight = insights.find(i => i.severity === "high") || insights.find(i => i.severity === "medium");

  if (!topInsight) return null;

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
          → {topInsight.severity === "high" ? "Requires immediate investigation and action plan" : "Review root cause and assess mitigation options"}
        </p>
        {topInsight.category && (
          <div className="flex items-center gap-1.5 mt-2">
            <TrendingDown className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">
              {topInsight.category} · Open diagnostics for full analysis
            </span>
          </div>
        )}
      </div>
      <span className={`shrink-0 flex items-center gap-1 text-[11px] font-semibold mt-1 opacity-70 group-hover:opacity-100 transition-opacity ${accentColor}`}>
        Diagnose <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </motion.div>
  );
});

HeroInsight.displayName = "HeroInsight";

export default HeroInsight;

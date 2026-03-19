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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
      className="rounded-xl border border-destructive/30 bg-destructive/[0.05] p-5 flex items-start gap-4 cursor-pointer hover:bg-destructive/[0.08] hover:border-destructive/40 transition-all shadow-sm hover:shadow-md group"
      onClick={() => navigate("/diagnostics")}
    >
      <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-destructive/20 transition-colors">
        <AlertTriangle className="w-5 h-5 text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-[10px] font-bold text-destructive uppercase tracking-widest">Top Signal</p>
          {confidence > 0 && (
            <ConfidenceBadge confidence={confidence} className="text-[10px]" />
          )}
        </div>
        <p className="text-sm font-semibold text-foreground leading-snug">{topInsight.message}</p>
        {topInsight.category && (
          <div className="flex items-center gap-1.5 mt-2">
            <TrendingDown className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">
              {topInsight.category} · Investigate &amp; act
            </span>
          </div>
        )}
      </div>
      <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-destructive mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
        Review <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </motion.div>
  );
});

HeroInsight.displayName = "HeroInsight";

export default HeroInsight;

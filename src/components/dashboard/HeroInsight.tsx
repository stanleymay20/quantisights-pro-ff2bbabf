import { memo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Lightbulb, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Insight } from "@/hooks/useInsights";

interface HeroInsightProps {
  insights: Insight[];
}

const HeroInsight = memo(({ insights }: HeroInsightProps) => {
  const navigate = useNavigate();
  const topInsight = insights.find(i => i.severity === "high") || insights.find(i => i.severity === "medium");

  if (!topInsight) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-xl border border-destructive/20 bg-destructive/[0.04] p-4 flex items-start gap-4 cursor-pointer hover:bg-destructive/[0.06] transition-colors"
      onClick={() => navigate("/diagnostics")}
    >
      <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
        <AlertTriangle className="w-4.5 h-4.5 text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-destructive uppercase tracking-wider mb-1">Top Signal</p>
        <p className="text-sm font-semibold text-foreground leading-snug">{topInsight.message}</p>
        {topInsight.category && (
          <div className="flex items-center gap-2 mt-2">
            <Lightbulb className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Category: {topInsight.category}</span>
          </div>
        )}
      </div>
      <span className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-destructive mt-1">
        Review <ArrowRight className="w-3 h-3" />
      </span>
    </motion.div>
  );
});

HeroInsight.displayName = "HeroInsight";

export default HeroInsight;

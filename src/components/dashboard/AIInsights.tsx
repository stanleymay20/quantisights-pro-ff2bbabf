import { Lightbulb, Target, TrendingDown, ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import type { Insight } from "@/hooks/useInsights";

const ICONS = [Target, Lightbulb, TrendingDown];

interface AIInsightsProps {
  insights: Insight[];
}

const ConfidenceBadge = ({ score }: { score: number }) => {
  const color = score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-destructive";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${color}`}>
      <ShieldCheck className="w-2.5 h-2.5" />
      {score}%
    </span>
  );
};

const AIInsights = ({ insights }: AIInsightsProps) => {
  const infoInsights = insights.filter((i) => i.severity === "info" || i.severity === "low").slice(0, 5);

  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold font-display uppercase tracking-wide text-muted-foreground">Insights</h3>
        {infoInsights.length > 0 && (
          <Link to="/advisory" className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">AI-generated recommendations</p>
      {infoInsights.length === 0 ? (
        <div className="py-6 text-center">
          <Lightbulb className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Upload data to generate insights</p>
        </div>
      ) : (
        <div className="space-y-3">
          {infoInsights.map((insight, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <div key={insight.id} className="flex items-start gap-3 group">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground/75 leading-relaxed">{insight.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {insight.confidence_score && <ConfidenceBadge score={insight.confidence_score} />}
                    {insight.generation_model && (
                      <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{insight.generation_model}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AIInsights;

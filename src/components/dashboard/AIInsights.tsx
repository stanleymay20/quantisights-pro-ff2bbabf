import { Lightbulb, Target, TrendingDown } from "lucide-react";
import type { Insight } from "@/hooks/useInsights";

const ICONS = [Target, Lightbulb, TrendingDown];

interface AIInsightsProps {
  insights: Insight[];
}

const AIInsights = ({ insights }: AIInsightsProps) => {
  const infoInsights = insights.filter((i) => i.severity === "info" || i.severity === "low").slice(0, 5);

  return (
    <div className="glass-card p-6 rounded-xl">
      <h3 className="text-lg font-semibold font-display mb-1">AI Insights & Recommendations</h3>
      <p className="text-xs text-muted-foreground mb-4">Insights based on current data</p>
      {infoInsights.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Upload data to generate insights</p>
      ) : (
        <div className="space-y-4">
          {infoInsights.map((insight, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <div key={insight.id} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">{insight.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AIInsights;

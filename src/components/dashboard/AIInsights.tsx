import { Lightbulb, Target, TrendingDown } from "lucide-react";

const insights = [
  {
    icon: Target,
    text: "Optimize inventory for top-selling products to reduce shortages.",
  },
  {
    icon: Lightbulb,
    text: "Launch targeted campaigns for mid-market customers to boost engagement.",
  },
  {
    icon: TrendingDown,
    text: "Evaluate cost-saving opportunities in Europe.",
  },
];

const AIInsights = () => (
  <div className="glass-card p-6 rounded-xl">
    <h3 className="text-lg font-semibold font-display mb-1">AI Insights & Recommendations</h3>
    <p className="text-xs text-muted-foreground mb-4">Insights based on current data and predictive models</p>
    <div className="space-y-4">
      {insights.map((insight, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <insight.icon className="w-4 h-4 text-primary" />
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">{insight.text}</p>
        </div>
      ))}
    </div>
  </div>
);

export default AIInsights;

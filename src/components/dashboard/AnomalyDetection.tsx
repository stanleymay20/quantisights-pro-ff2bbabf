import { AlertTriangle, TrendingDown, DollarSign } from "lucide-react";
import type { Insight } from "@/hooks/useInsights";

const ICONS = [TrendingDown, DollarSign, AlertTriangle];

interface AnomalyDetectionProps {
  insights: Insight[];
}

const AnomalyDetection = ({ insights }: AnomalyDetectionProps) => {
  const anomalies = insights.filter((i) => i.severity === "high" || i.severity === "medium").slice(0, 5);

  return (
    <div className="glass-card p-6 rounded-xl">
      <h3 className="text-lg font-semibold font-display mb-4">Anomaly Detection</h3>
      {anomalies.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No anomalies detected</p>
      ) : (
        <div className="space-y-3">
          {anomalies.map((a, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <div
                key={a.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  a.severity === "high" ? "bg-destructive/10 border border-destructive/20" : "bg-warning/10 border border-warning/20"
                }`}
              >
                <Icon className={`w-4 h-4 ${a.severity === "high" ? "text-destructive" : "text-warning"}`} />
                <span className="text-sm">{a.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AnomalyDetection;

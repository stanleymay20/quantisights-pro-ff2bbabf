import { AlertTriangle, TrendingDown, DollarSign, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Insight } from "@/hooks/useInsights";

const ICONS = [TrendingDown, DollarSign, AlertTriangle];

interface AnomalyDetectionProps {
  insights: Insight[];
}

const AnomalyDetection = ({ insights }: AnomalyDetectionProps) => {
  const anomalies = insights.filter((i) => i.severity === "high" || i.severity === "medium").slice(0, 5);

  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold font-display uppercase tracking-wide text-muted-foreground">Anomalies</h3>
        {anomalies.length > 0 && (
          <Link to="/diagnostics" className="text-[11px] font-semibold text-destructive hover:underline flex items-center gap-0.5">
            Diagnose <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">Detected deviations</p>
      {anomalies.length === 0 ? (
        <div className="py-6 text-center">
          <AlertTriangle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No anomalies detected</p>
        </div>
      ) : (
        <div className="space-y-2">
          {anomalies.map((a, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <div
                key={a.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                  a.severity === "high"
                    ? "bg-destructive/[0.06] border border-destructive/15"
                    : "bg-warning/[0.06] border border-warning/15"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${a.severity === "high" ? "text-destructive" : "text-warning"}`} />
                <span className="text-[13px] leading-snug">{a.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AnomalyDetection;

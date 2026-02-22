import { AlertTriangle, TrendingDown, DollarSign } from "lucide-react";

const anomalies = [
  { icon: TrendingDown, text: "Revenue drop in EMEA region", severity: "high" },
  { icon: DollarSign, text: "Cost increase in logistics department", severity: "medium" },
  { icon: AlertTriangle, text: "Customer churn spike in SME segment", severity: "high" },
];

const AnomalyDetection = () => (
  <div className="glass-card p-6 rounded-xl">
    <h3 className="text-lg font-semibold font-display mb-4">Anomaly Detection</h3>
    <div className="space-y-3">
      {anomalies.map((a, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 p-3 rounded-lg ${
            a.severity === "high" ? "bg-destructive/10 border border-destructive/20" : "bg-warning/10 border border-warning/20"
          }`}
        >
          <a.icon className={`w-4 h-4 ${a.severity === "high" ? "text-destructive" : "text-warning"}`} />
          <span className="text-sm">{a.text}</span>
        </div>
      ))}
    </div>
  </div>
);

export default AnomalyDetection;

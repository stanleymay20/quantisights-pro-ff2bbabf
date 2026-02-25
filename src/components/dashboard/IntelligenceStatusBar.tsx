import { Activity, AlertTriangle, Lightbulb, Shield } from "lucide-react";
import type { Insight } from "@/hooks/useInsights";

interface IntelligenceStatusBarProps {
  hasData: boolean;
  insights: Insight[];
  openAdvisories?: number;
  riskLevel?: "low" | "moderate" | "elevated" | "high";
}

const RISK_STYLES = {
  low: { color: "text-emerald-400", dot: "bg-emerald-400", label: "Low" },
  moderate: { color: "text-primary", dot: "bg-primary", label: "Moderate" },
  elevated: { color: "text-warning", dot: "bg-warning", label: "Elevated" },
  high: { color: "text-destructive", dot: "bg-destructive", label: "High" },
};

const IntelligenceStatusBar = ({ hasData, insights, openAdvisories = 0, riskLevel }: IntelligenceStatusBarProps) => {
  if (!hasData) return null;

  const signals = insights.filter(i => i.severity === "high" || i.severity === "medium").length;
  const infoCount = insights.filter(i => i.severity === "info" || i.severity === "low").length;

  const computedRisk = riskLevel || (signals >= 3 ? "high" : signals >= 1 ? "elevated" : infoCount > 0 ? "moderate" : "low");
  const riskStyle = RISK_STYLES[computedRisk];

  const systemStatus = signals === 0 ? "Nominal" : signals <= 2 ? "Active Signals" : "Attention Required";
  const statusColor = signals === 0 ? "text-emerald-400" : signals <= 2 ? "text-warning" : "text-destructive";

  return (
    <div className="h-9 border-b border-border/30 bg-card/40 backdrop-blur-sm flex items-center px-8 gap-6 shrink-0">
      {/* System status */}
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${signals === 0 ? "bg-emerald-400" : signals <= 2 ? "bg-warning" : "bg-destructive"}`} />
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${statusColor}`}>
          {systemStatus}
        </span>
      </div>

      <span className="w-px h-3.5 bg-border/50" />

      {/* Risk level */}
      <div className="flex items-center gap-1.5">
        <Shield className={`w-3 h-3 ${riskStyle.color}`} />
        <span className="text-[11px] text-muted-foreground">Risk:</span>
        <span className={`text-[11px] font-semibold ${riskStyle.color}`}>{riskStyle.label}</span>
      </div>

      <span className="w-px h-3.5 bg-border/50" />

      {/* Signals */}
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">Signals:</span>
        <span className={`text-[11px] font-semibold ${signals > 0 ? "text-warning" : "text-muted-foreground"}`}>
          {signals}
        </span>
      </div>

      <span className="w-px h-3.5 bg-border/50" />

      {/* Open advisories */}
      <div className="flex items-center gap-1.5">
        <Lightbulb className="w-3 h-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">Advisories:</span>
        <span className={`text-[11px] font-semibold ${openAdvisories > 0 ? "text-primary" : "text-muted-foreground"}`}>
          {openAdvisories} Open
        </span>
      </div>

      <span className="w-px h-3.5 bg-border/50" />

      {/* Insights */}
      <div className="flex items-center gap-1.5">
        <Activity className="w-3 h-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">Insights:</span>
        <span className="text-[11px] font-semibold text-muted-foreground">{infoCount}</span>
      </div>
    </div>
  );
};

export default IntelligenceStatusBar;

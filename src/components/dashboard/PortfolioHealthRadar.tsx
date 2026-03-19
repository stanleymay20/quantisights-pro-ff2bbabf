import { useMemo } from "react";
import { Shield, AlertTriangle, TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import { MetricRow } from "@/hooks/useMetrics";
import { Link } from "react-router-dom";

interface Props {
  metrics: MetricRow[];
  latestChurn: number;
  latestCost: number;
}

interface Dimension {
  label: string;
  score: number;
  status: "strong" | "moderate" | "weak";
  explanation: string;
  action?: string;
}

/**
 * Portfolio Health — explainable scorecard (replaces radar chart).
 * Each dimension shows score + plain-English explanation + action.
 */
const PortfolioHealthRadar = ({ metrics, latestChurn, latestCost }: Props) => {
  const { dimensions, missingDimensions, avgScore } = useMemo(() => {
    if (metrics.length === 0) return { dimensions: [], missingDimensions: ["All dimensions"], avgScore: 0 };

    const revenue = metrics.filter(m => m.metric_type === "revenue");
    const customers = metrics.filter(m => m.metric_type === "customers");

    const dims: Dimension[] = [];
    const missing: string[] = [];

    // Revenue Growth
    if (revenue.length >= 2) {
      const growth = ((revenue[revenue.length - 1].value / (revenue[0].value || 1)) - 1) * 100;
      const score = Math.round(Math.min(100, Math.max(0, growth + 50)));
      const status = score >= 70 ? "strong" : score >= 40 ? "moderate" : "weak";
      dims.push({
        label: "Revenue Growth",
        score,
        status,
        explanation: growth >= 5 ? `Growing ${growth.toFixed(1)}% — strong upward trajectory` :
          growth >= -5 ? `Flat at ${growth.toFixed(1)}% — growth has stalled` :
            `Declining ${Math.abs(growth).toFixed(1)}% — revenue is shrinking`,
        action: score < 60 ? "Review pricing & acquisition" : undefined,
      });
    } else {
      missing.push("Revenue Growth (need ≥2 data points)");
    }

    // Retention
    if (latestChurn > 0) {
      const score = Math.round(Math.max(0, 100 - latestChurn * 10));
      const status = score >= 70 ? "strong" : score >= 40 ? "moderate" : "weak";
      dims.push({
        label: "Retention",
        score,
        status,
        explanation: latestChurn <= 3 ? `Churn at ${latestChurn.toFixed(1)}% — healthy retention` :
          latestChurn <= 7 ? `Churn at ${latestChurn.toFixed(1)}% — monitor closely` :
            `Churn at ${latestChurn.toFixed(1)}% — retention is eroding growth`,
        action: score < 60 ? "Investigate churn drivers" : undefined,
      });
    } else {
      missing.push("Retention (need churn data)");
    }

    // Cost Efficiency
    if (latestCost > 0) {
      const score = Math.round(Math.max(0, 100 - latestCost * 100));
      const status = score >= 70 ? "strong" : score >= 40 ? "moderate" : "weak";
      dims.push({
        label: "Efficiency",
        score,
        status,
        explanation: latestCost < 0.4 ? `Cost ratio ${(latestCost * 100).toFixed(0)}% — operating efficiently` :
          latestCost < 0.7 ? `Cost ratio ${(latestCost * 100).toFixed(0)}% — moderate overhead` :
            `Cost ratio ${(latestCost * 100).toFixed(0)}% — high cost base needs review`,
        action: score < 60 ? "Audit cost structure" : undefined,
      });
    } else {
      missing.push("Efficiency (need cost data)");
    }

    // Margin
    if (revenue.length > 0 && latestCost > 0) {
      const margin = (1 - latestCost) * 100;
      const score = Math.round(Math.min(100, Math.max(0, margin)));
      const status = score >= 70 ? "strong" : score >= 40 ? "moderate" : "weak";
      dims.push({
        label: "Margin",
        score,
        status,
        explanation: margin > 30 ? `${margin.toFixed(0)}% margin — healthy profitability` :
          margin > 10 ? `${margin.toFixed(0)}% margin — thin but positive` :
            `${margin.toFixed(0)}% margin — at risk of operating loss`,
        action: score < 50 ? "Optimize unit economics" : undefined,
      });
    } else {
      missing.push("Margin (need revenue + cost)");
    }

    // Customer Growth
    if (customers.length >= 2) {
      const growth = ((customers[customers.length - 1].value / (customers[0].value || 1)) - 1) * 100;
      const score = Math.round(Math.min(100, Math.max(0, growth + 50)));
      const status = score >= 70 ? "strong" : score >= 40 ? "moderate" : "weak";
      dims.push({
        label: "Customer Growth",
        score,
        status,
        explanation: growth >= 5 ? `Growing ${growth.toFixed(1)}% — base is expanding` :
          growth >= -5 ? `Flat at ${growth.toFixed(1)}% — acquisition stalled` :
            `Declining ${Math.abs(growth).toFixed(1)}% — losing customers`,
        action: score < 60 ? "Accelerate acquisition" : undefined,
      });
    } else {
      missing.push("Customer Growth (need ≥2 data points)");
    }

    const avg = dims.length > 0 ? Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length) : 0;
    return { dimensions: dims, missingDimensions: missing, avgScore: avg };
  }, [metrics, latestChurn, latestCost]);

  const statusIcon = (status: Dimension["status"]) => {
    switch (status) {
      case "strong": return <TrendingUp className="w-3.5 h-3.5 text-[hsl(var(--success))]" />;
      case "moderate": return <Minus className="w-3.5 h-3.5 text-[hsl(var(--warning))]" />;
      case "weak": return <TrendingDown className="w-3.5 h-3.5 text-destructive" />;
    }
  };

  const statusBg = (status: Dimension["status"]) => {
    switch (status) {
      case "strong": return "bg-[hsl(var(--success))]/10";
      case "moderate": return "bg-[hsl(var(--warning))]/10";
      case "weak": return "bg-destructive/10";
    }
  };

  const statusBarColor = (status: Dimension["status"]) => {
    switch (status) {
      case "strong": return "bg-[hsl(var(--success))]";
      case "moderate": return "bg-[hsl(var(--warning))]";
      case "weak": return "bg-destructive";
    }
  };

  if (dimensions.length < 3) {
    return (
      <div className="glass-card p-5 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portfolio Health</h3>
        </div>
        <div className="py-4 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[hsl(var(--warning))]/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5 text-[hsl(var(--warning))]" />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Insufficient dimensions ({dimensions.length}/3 minimum)</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-2">
              Upload more data types to unlock a complete health assessment.
            </p>
            {missingDimensions.length > 0 && (
              <div className="text-left max-w-xs mx-auto space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">What's needed:</p>
                {missingDimensions.map(d => (
                  <p key={d} className="text-[11px] text-muted-foreground">• {d}</p>
                ))}
              </div>
            )}
          </div>
          <Link to="/data-upload" className="inline-flex text-xs font-semibold text-primary hover:underline">
            Upload Data →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 rounded-xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portfolio Health</h3>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          avgScore >= 70 ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
            : avgScore >= 50 ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"
            : "bg-destructive/10 text-destructive"
        }`}>
          {avgScore}/100
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        {dimensions.length} dimensions assessed · {dimensions.filter(d => d.status === "weak").length > 0
          ? `${dimensions.filter(d => d.status === "weak").length} area${dimensions.filter(d => d.status === "weak").length > 1 ? "s" : ""} need attention`
          : "All areas healthy"}
      </p>

      {/* Dimension-by-dimension scorecard */}
      <div className="space-y-3">
        {dimensions.map((dim) => (
          <div key={dim.label} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-md flex items-center justify-center ${statusBg(dim.status)}`}>
                  {statusIcon(dim.status)}
                </div>
                <span className="text-xs font-medium">{dim.label}</span>
              </div>
              <span className={`text-[10px] font-bold ${
                dim.status === "strong" ? "text-[hsl(var(--success))]" :
                dim.status === "moderate" ? "text-[hsl(var(--warning))]" :
                "text-destructive"
              }`}>
                {dim.score}/100
              </span>
            </div>
            {/* Score bar */}
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${statusBarColor(dim.status)}`}
                style={{ width: `${dim.score}%`, opacity: 0.8 }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{dim.explanation}</p>
            {dim.action && (
              <div className="flex items-center gap-1">
                <ArrowRight className="w-2.5 h-2.5 text-primary" />
                <span className="text-[10px] font-semibold text-primary">{dim.action}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PortfolioHealthRadar;

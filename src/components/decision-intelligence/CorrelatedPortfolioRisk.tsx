import { useMemo } from "react";
import { Network, AlertTriangle } from "lucide-react";
import { getSystemConfig } from "@/lib/system-config";

interface Simulation {
  id: string;
  decision_id: string | null;
  expected_net_impact: number | null;
  p10_impact: number | null;
  p90_impact: number | null;
  revenue_delta_pct: number | null;
  cost_delta_pct: number | null;
  churn_change_pct: number | null;
  probability_positive_roi: number | null;
  probability_cashflow_stress: number | null;
  implementation_cost: number | null;
}

/**
 * Correlation-Adjusted Portfolio Risk.
 * VaR confidence level and alert thresholds configurable via system-config.
 */
const CorrelatedPortfolioRisk = ({
  simulations,
}: {
  simulations: Simulation[];
}) => {
  const analysis = useMemo(() => {
    const cfg = getSystemConfig().decisionIntelligence.portfolioRisk;
    const valid = simulations.filter(
      (s) => s.expected_net_impact != null && s.p10_impact != null && s.p90_impact != null
    );
    if (valid.length < 2) return null;

    const items = valid.map((s) => {
      const ev = Number(s.expected_net_impact) || 0;
      const p10 = Number(s.p10_impact) || 0;
      const p90 = Number(s.p90_impact) || 0;
      const sigma = (p90 - p10) / 2;
      const revDelta = Number(s.revenue_delta_pct) || 0;
      const costDelta = Number(s.cost_delta_pct) || 0;
      const churnDelta = Number(s.churn_change_pct) || 0;

      return { id: s.id, ev, p10, p90, sigma, revDelta, costDelta, churnDelta };
    });

    const naiveEV = items.reduce((s, i) => s + i.ev, 0);
    const naiveVariance = items.reduce((s, i) => s + i.sigma ** 2, 0);
    const naiveSigma = Math.sqrt(naiveVariance);

    let covarianceSum = 0;
    let pairCount = 0;
    let avgCorrelation = 0;

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const dotProduct =
          a.revDelta * b.revDelta +
          a.costDelta * b.costDelta +
          a.churnDelta * b.churnDelta;
        const magA = Math.sqrt(a.revDelta ** 2 + a.costDelta ** 2 + a.churnDelta ** 2) || 1;
        const magB = Math.sqrt(b.revDelta ** 2 + b.costDelta ** 2 + b.churnDelta ** 2) || 1;
        const rho = Math.max(-1, Math.min(1, dotProduct / (magA * magB)));
        covarianceSum += rho * a.sigma * b.sigma;
        avgCorrelation += rho;
        pairCount++;
      }
    }

    avgCorrelation = pairCount > 0 ? avgCorrelation / pairCount : 0;

    const correlatedVariance = naiveVariance + 2 * covarianceSum;
    const correlatedSigma = Math.sqrt(Math.max(0, correlatedVariance));

    const naiveVaR = naiveEV - cfg.varConfidenceLevel * naiveSigma;
    const correlatedVaR = naiveEV - cfg.varConfidenceLevel * correlatedSigma;

    const diversificationRatio =
      naiveSigma > 0 ? (1 - correlatedSigma / (naiveSigma * Math.sqrt(items.length))) * 100 : 0;

    const maxEV = Math.max(...items.map((i) => Math.abs(i.ev)));
    const concentrationRisk =
      naiveEV !== 0 ? (maxEV / Math.abs(naiveEV)) * 100 : 0;

    return {
      count: items.length,
      naiveEV: Math.round(naiveEV),
      naiveSigma: Math.round(naiveSigma),
      correlatedSigma: Math.round(correlatedSigma),
      naiveVaR: Math.round(naiveVaR),
      correlatedVaR: Math.round(correlatedVaR),
      avgCorrelation: Number(avgCorrelation.toFixed(2)),
      diversificationRatio: Number(diversificationRatio.toFixed(1)),
      concentrationRisk: Number(concentrationRisk.toFixed(0)),
      riskIncrease:
        naiveSigma > 0
          ? Number((((correlatedSigma - naiveSigma) / naiveSigma) * 100).toFixed(0))
          : 0,
      highCorrelationThreshold: cfg.highCorrelationThreshold,
      highConcentrationThreshold: cfg.highConcentrationThreshold,
    };
  }, [simulations]);

  if (!analysis) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Network className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Correlated Portfolio Risk</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Needs 2+ decision simulations to compute correlation-adjusted portfolio risk.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-1">
        <Network className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Correlated Portfolio Risk</h3>
        <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full ml-auto">
          {analysis.count} positions
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">
        Adjusts aggregate risk for inter-decision correlations
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="text-center bg-muted/20 rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Naive VaR(95%)
          </p>
          <p className="text-lg font-bold font-mono line-through text-muted-foreground">
            €{analysis.naiveVaR.toLocaleString()}
          </p>
        </div>
        <div className="text-center bg-muted/20 rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Adjusted VaR(95%)
          </p>
          <p
            className={`text-lg font-bold font-mono ${
              analysis.correlatedVaR < 0 ? "text-destructive" : "text-emerald-400"
            }`}
          >
            €{analysis.correlatedVaR.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Avg. Pairwise Correlation</span>
          <span
            className={`font-mono font-semibold ${
              analysis.avgCorrelation > analysis.highCorrelationThreshold
                ? "text-warning"
                : analysis.avgCorrelation > 0.3
                ? "text-foreground"
                : "text-emerald-400"
            }`}
          >
            {analysis.avgCorrelation}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Risk Adj. vs Naive</span>
          <span
            className={`font-mono font-semibold ${
              analysis.riskIncrease > 0 ? "text-warning" : "text-emerald-400"
            }`}
          >
            {analysis.riskIncrease > 0 ? "+" : ""}
            {analysis.riskIncrease}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Concentration Risk</span>
          <span
            className={`font-mono font-semibold ${
              analysis.concentrationRisk > analysis.highConcentrationThreshold ? "text-warning" : ""
            }`}
          >
            {analysis.concentrationRisk}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Portfolio σ (Naive → Adj.)</span>
          <span className="font-mono font-semibold">
            €{analysis.naiveSigma.toLocaleString()} → €{analysis.correlatedSigma.toLocaleString()}
          </span>
        </div>
      </div>

      {analysis.avgCorrelation > analysis.highCorrelationThreshold && (
        <div className="mt-3 p-2.5 rounded-lg bg-warning/10 text-warning flex items-center gap-2 text-xs font-medium">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          High inter-decision correlation ({analysis.avgCorrelation}) — portfolio risk is significantly underestimated by naive methods
        </div>
      )}

      {analysis.concentrationRisk > analysis.highConcentrationThreshold && (
        <div className="mt-2 p-2.5 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2 text-xs font-medium">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Single decision represents {analysis.concentrationRisk}% of portfolio EV — high concentration risk
        </div>
      )}
    </div>
  );
};

export default CorrelatedPortfolioRisk;

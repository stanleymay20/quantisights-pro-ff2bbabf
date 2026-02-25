interface Convergence {
  score: number;
  dispersion: number;
  conflict_penalty: number;
  volatility_divergence: number;
  alignment_status: string;
}

interface RiskAttributionProps {
  convergence: Convergence | null;
}

const RiskAttribution = ({ convergence }: RiskAttributionProps) => {
  if (!convergence) {
    return (
      <div className="px-16 py-12 border-b border-slate-700/50 print:border-slate-200">
        <h2 className="text-xs uppercase tracking-[0.2em] text-cyan-400 print:text-cyan-700 mb-8 font-semibold">
          Risk Attribution Breakdown
        </h2>
        <p className="text-slate-400 italic">Convergence index not yet computed.</p>
      </div>
    );
  }

  const total = convergence.dispersion + convergence.conflict_penalty + convergence.volatility_divergence;
  const safeTotal = total > 0 ? total : 1;

  const factors = [
    {
      label: "Dispersion",
      value: convergence.dispersion,
      pct: Math.round((convergence.dispersion / safeTotal) * 100),
      color: "#38bdf8",
      description: "Spread of risk scores across executive roles",
    },
    {
      label: "Conflict Penalty",
      value: convergence.conflict_penalty,
      pct: Math.round((convergence.conflict_penalty / safeTotal) * 100),
      color: "#f97316",
      description: "Governance conflicts between executive functions",
    },
    {
      label: "Volatility Divergence",
      value: convergence.volatility_divergence,
      pct: Math.round((convergence.volatility_divergence / safeTotal) * 100),
      color: "#a855f7",
      description: "Difference in risk volatility patterns across roles",
    },
  ];

  return (
    <div className="px-16 py-12 border-b border-slate-700/50 print:border-slate-200">
      <h2 className="text-xs uppercase tracking-[0.2em] text-cyan-400 print:text-cyan-700 mb-8 font-semibold">
        Risk Attribution Breakdown
      </h2>

      {/* Stacked bar */}
      <div className="mb-8">
        <div className="flex h-8 rounded-lg overflow-hidden">
          {factors.map((f) => (
            <div
              key={f.label}
              className="flex items-center justify-center text-xs font-bold text-white"
              style={{ width: `${f.pct}%`, backgroundColor: f.color, minWidth: f.pct > 0 ? "40px" : "0" }}
            >
              {f.pct > 10 ? `${f.pct}%` : ""}
            </div>
          ))}
        </div>
      </div>

      {/* Detailed breakdown */}
      <div className="space-y-6">
        {factors.map((f) => (
          <div key={f.label} className="flex items-center gap-6">
            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: f.color }} />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-200 print:text-slate-800">{f.label}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-slate-300 print:text-slate-700">{Number(f.value).toFixed(1)}</span>
                  <span className="text-sm font-bold" style={{ color: f.color }}>
                    {f.pct}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500">{f.description}</p>
              <div className="mt-1.5 h-1.5 rounded-full bg-slate-700/50 print:bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${f.pct}%`, backgroundColor: f.color }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-700/30 print:border-slate-200 flex items-center justify-between text-sm">
        <span className="text-slate-400">Composite ECI Score</span>
        <span className="text-2xl font-bold text-slate-200 print:text-slate-800">{convergence.score}/100</span>
      </div>
    </div>
  );
};

export default RiskAttribution;

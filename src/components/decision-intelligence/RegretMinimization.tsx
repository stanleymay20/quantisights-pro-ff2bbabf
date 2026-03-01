import { useMemo } from "react";
import { ShieldAlert, ArrowRight } from "lucide-react";

interface Decision {
  id: string;
  recommended_action: string;
  decision_status: string;
  predicted_net_impact: number | null;
  probability_of_success: number | null;
  capped_confidence: number | null;
}

interface Simulation {
  id: string;
  decision_id: string | null;
  expected_net_impact: number | null;
  p10_impact: number | null;
  p90_impact: number | null;
}

/**
 * Regret Minimization Framework.
 * Instead of maximizing EV, this identifies the action that minimizes
 * the worst-case regret: max(best_possible_outcome − chosen_outcome).
 *
 * Minimax Regret = min over actions { max over states { regret(action, state) } }
 */
const RegretMinimization = ({
  decisions,
  simulations,
}: {
  decisions: Decision[];
  simulations: Simulation[];
}) => {
  const analysis = useMemo(() => {
    const pending = decisions.filter(
      (d) =>
        d.decision_status === "pending" && d.predicted_net_impact != null
    );
    if (pending.length < 2) return null;

    // For each pending decision, compute regret under optimistic & pessimistic states
    const items = pending.slice(0, 6).map((d) => {
      const sim = simulations.find((s) => s.decision_id === d.id);
      const ev = Number(d.predicted_net_impact) || 0;
      const p10 = sim ? Number(sim.p10_impact) || ev * 0.3 : ev * 0.3;
      const p90 = sim ? Number(sim.p90_impact) || ev * 1.5 : ev * 1.5;
      const probSuccess =
        Number(d.probability_of_success) / 100 ||
        Number(d.capped_confidence) / 100 ||
        0.5;

      return { id: d.id, action: d.recommended_action, ev, p10, p90, probSuccess };
    });

    // Best possible outcome across all decisions in each state
    const bestOptimistic = Math.max(...items.map((i) => i.p90));
    const bestPessimistic = Math.max(...items.map((i) => i.p10));
    const bestExpected = Math.max(...items.map((i) => i.ev));

    return items
      .map((item) => {
        // Regret in each state = best_in_state − this_action_in_state
        const regretOptimistic = bestOptimistic - item.p90;
        const regretPessimistic = bestPessimistic - item.p10;
        const regretExpected = bestExpected - item.ev;

        // Minimax regret = worst-case regret across states
        const maxRegret = Math.max(regretOptimistic, regretPessimistic, regretExpected);

        return {
          ...item,
          regretOptimistic: Math.round(regretOptimistic),
          regretPessimistic: Math.round(regretPessimistic),
          regretExpected: Math.round(regretExpected),
          maxRegret: Math.round(maxRegret),
        };
      })
      .sort((a, b) => a.maxRegret - b.maxRegret); // lowest max regret first
  }, [decisions, simulations]);

  if (!analysis || analysis.length < 2) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Regret Minimization</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Needs 2+ pending decisions to compute minimax regret across scenarios.
        </p>
      </div>
    );
  }

  const bestChoice = analysis[0];

  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-1">
        <ShieldAlert className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Regret Minimization</h3>
        <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full ml-auto">
          Minimax Regret
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">
        Which action minimizes the worst-case regret across all scenarios?
      </p>

      <div className="space-y-2">
        {analysis.map((item, idx) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
              idx === 0
                ? "bg-primary/5 border border-primary/20"
                : "bg-muted/20"
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{item.action}</p>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                <span>
                  EV: <span className="font-mono font-semibold">€{item.ev.toLocaleString()}</span>
                </span>
                <span>
                  P10 regret:{" "}
                  <span className="font-mono font-semibold text-warning">
                    €{item.regretPessimistic.toLocaleString()}
                  </span>
                </span>
                <span>
                  P90 regret:{" "}
                  <span className="font-mono font-semibold">
                    €{item.regretOptimistic.toLocaleString()}
                  </span>
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-muted-foreground">Max Regret</p>
              <p
                className={`text-sm font-bold font-mono ${
                  idx === 0 ? "text-emerald-400" : "text-foreground"
                }`}
              >
                €{item.maxRegret.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {bestChoice && (
        <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center gap-2 text-xs font-medium">
          <ArrowRight className="w-3 h-3 shrink-0" />
          Minimax regret favors: "{bestChoice.action}"
        </div>
      )}
    </div>
  );
};

export default RegretMinimization;

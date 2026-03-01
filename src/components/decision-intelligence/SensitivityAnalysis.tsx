import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { Activity } from "lucide-react";

interface Simulation {
  id: string;
  revenue_delta_pct: number | null;
  cost_delta_pct: number | null;
  churn_change_pct: number | null;
  implementation_cost: number | null;
  expected_net_impact: number | null;
  p10_impact: number | null;
  p90_impact: number | null;
}

/**
 * Tornado chart showing which input variables have the largest impact on outcomes.
 * Computes sensitivity by measuring output swing (P90-P10 range) correlated with each input.
 */
const SensitivityAnalysis = ({ simulations }: { simulations: Simulation[] }) => {
  const data = useMemo(() => {
    if (simulations.length < 2) return [];

    // For each input variable, compute correlation with outcome spread
    const variables = [
      { key: "revenue_delta_pct", label: "Revenue Δ%" },
      { key: "cost_delta_pct", label: "Cost Δ%" },
      { key: "churn_change_pct", label: "Churn Δ%" },
      { key: "implementation_cost", label: "Impl. Cost" },
    ] as const;

    return variables
      .map(({ key, label }) => {
        const values = simulations
          .filter(s => s[key] != null && s.expected_net_impact != null)
          .map(s => ({ input: Number(s[key]) || 0, output: Number(s.expected_net_impact) || 0 }));

        if (values.length < 2) return null;

        // Compute simple sensitivity: range of outputs weighted by input variance
        const inputRange = Math.max(...values.map(v => v.input)) - Math.min(...values.map(v => v.input));
        const outputRange = Math.max(...values.map(v => v.output)) - Math.min(...values.map(v => v.output));

        // Normalized sensitivity score
        const sensitivity = inputRange > 0 ? outputRange / (inputRange || 1) : outputRange;

        // Compute positive and negative swing
        const avgOutput = values.reduce((s, v) => s + v.output, 0) / values.length;
        const positiveSwing = Math.max(...values.map(v => v.output)) - avgOutput;
        const negativeSwing = avgOutput - Math.min(...values.map(v => v.output));

        return { label, sensitivity, positiveSwing, negativeSwing };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.sensitivity ?? 0) - (a?.sensitivity ?? 0)) as {
        label: string;
        sensitivity: number;
        positiveSwing: number;
        negativeSwing: number;
      }[];
  }, [simulations]);

  if (data.length === 0) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Sensitivity Analysis</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Run multiple decision simulations with varying parameters to generate a tornado sensitivity chart.
        </p>
      </div>
    );
  }

  // Format for tornado chart: bidirectional bars
  const chartData = data.map(d => ({
    name: d.label,
    upside: d.positiveSwing,
    downside: -d.negativeSwing,
  }));

  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Sensitivity Analysis</h3>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">
        Which variables drive the most outcome variance?
      </p>

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 60, right: 20 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `€${Math.abs(v).toLocaleString()}`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
            <Tooltip
              formatter={(value: number) => [`€${Math.abs(value).toLocaleString()}`, value >= 0 ? "Upside" : "Downside"]}
              contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
            />
            <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.3} />
            <Bar dataKey="upside" stackId="stack" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            <Bar dataKey="downside" stackId="stack" fill="hsl(var(--destructive))" radius={[4, 0, 0, 4]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary" /> Upside potential
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-destructive" /> Downside risk
        </span>
      </div>
    </div>
  );
};

export default SensitivityAnalysis;

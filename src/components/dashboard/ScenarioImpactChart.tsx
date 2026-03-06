import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { GitBranch, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import type { Insight } from "@/hooks/useInsights";

interface Props {
  insights: Insight[];
}

/**
 * Scenario Impact Chart — DATA-HONEST.
 *
 * This chart ONLY renders when real simulation data exists.
 * Previous implementation fabricated scenario percentages by multiplying
 * insight counts by magic constants (4.2, 3.1, 2.8). That is eliminated.
 *
 * Now: shows empty state directing users to run actual simulations.
 */
const ScenarioImpactChart = ({ insights }: Props) => {
  // We have no real simulation/scenario data passed to this component.
  // The previous implementation fabricated values. We now show an honest empty state.
  const hasSimulationData = false; // Would need real scenario_results data

  return (
    <div className="glass-card p-5 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scenario Impact</h3>
      </div>
      <div className="py-6 text-center space-y-3">
        <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-5 h-5 text-warning" />
        </div>
        <div>
          <p className="text-sm font-medium mb-1">No simulation data</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Run a strategic simulation to compare scenario impacts with real projections.
          </p>
        </div>
        <Link
          to="/simulations"
          className="inline-flex text-xs font-semibold text-primary hover:underline"
        >
          Run Simulation →
        </Link>
      </div>
    </div>
  );
};

export default ScenarioImpactChart;

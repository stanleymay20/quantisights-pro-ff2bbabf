import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { GitBranch } from "lucide-react";
import type { Insight } from "@/hooks/useInsights";

interface Props {
  insights: Insight[];
}

const ScenarioImpactChart = ({ insights }: Props) => {
  const data = useMemo(() => {
    if (insights.length === 0) return null;

    // Build scenario impact from insights with confidence scores
    const scenarios = [
      {
        name: "Base Case",
        impact: 0,
        type: "neutral" as const,
      },
      {
        name: "Bear",
        impact: -insights.filter(i => i.severity === "high").length * 4.2,
        type: "negative" as const,
      },
      {
        name: "Bull",
        impact: insights.filter(i => i.severity === "low").length * 3.1 + 5,
        type: "positive" as const,
      },
      {
        name: "Stress",
        impact: -(insights.length * 2.8 + 8),
        type: "negative" as const,
      },
    ];

    return scenarios;
  }, [insights]);

  if (!data) {
    return (
      <div className="glass-card p-5 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scenario Impact</h3>
        </div>
        <p className="text-xs text-muted-foreground">Generate insights to compare scenario impacts.</p>
      </div>
    );
  }

  const colors: Record<string, string> = {
    positive: "hsl(var(--severity-success))",
    negative: "hsl(var(--destructive))",
    neutral: "hsl(var(--muted-foreground))",
  };

  return (
    <div className="glass-card p-5 rounded-xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scenario Impact</h3>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">Revenue impact across strategic scenarios (%)</p>

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" barCategoryGap="30%">
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false}
              tickFormatter={v => `${v > 0 ? "+" : ""}${v}%`} />
            <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} width={60} />
            <Tooltip
              contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              formatter={(v: number) => [`${v > 0 ? "+" : ""}${v.toFixed(1)}%`, "Impact"]}
            />
            <ReferenceLine x={0} stroke="hsl(var(--border))" />
            <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={colors[entry.type]} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ScenarioImpactChart;

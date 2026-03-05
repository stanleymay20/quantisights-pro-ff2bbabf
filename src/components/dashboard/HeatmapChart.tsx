import { useMemo } from "react";
import { MetricRow } from "@/hooks/useMetrics";
import { Grid3x3 } from "lucide-react";

interface HeatmapChartProps {
  metrics: MetricRow[];
}

const HeatmapChart = ({ metrics }: HeatmapChartProps) => {
  const { matrix, metricTypes, months } = useMemo(() => {
    if (metrics.length === 0) return { matrix: [], metricTypes: [], months: [] };

    const types = [...new Set(metrics.map(m => m.metric_type))];
    const monthSet = new Map<string, string>();
    metrics.forEach(m => {
      const d = new Date(m.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthSet.has(key)) {
        monthSet.set(key, d.toLocaleDateString("en", { month: "short", year: "2-digit" }));
      }
    });
    const monthKeys = [...monthSet.keys()].sort();
    const monthLabels = monthKeys.map(k => monthSet.get(k)!);

    // Normalize values per metric type to 0-1
    const grid = types.map(type => {
      const byMonth = monthKeys.map(mk => {
        const vals = metrics.filter(m => {
          const d = new Date(m.date);
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          return m.metric_type === type && k === mk;
        });
        return vals.reduce((s, v) => s + Number(v.value), 0);
      });
      const max = Math.max(...byMonth, 1);
      const min = Math.min(...byMonth, 0);
      const range = max - min || 1;
      return byMonth.map(v => (v - min) / range);
    });

    return { matrix: grid, metricTypes: types, months: monthLabels };
  }, [metrics]);

  if (metricTypes.length === 0) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Grid3x3 className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Correlation Heatmap</h3>
        </div>
        <p className="text-xs text-muted-foreground">Upload data to view metric correlations across time.</p>
      </div>
    );
  }

  // Use CSS variable-based primary color for heatmap gradient
  const getColor = (intensity: number) => {
    // Map intensity to opacity of the primary color
    const alpha = 0.15 + intensity * 0.85;
    return `hsl(var(--primary) / ${alpha.toFixed(2)})`;
  };

  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-1">
        <Grid3x3 className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metric Heatmap</h3>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">Normalized intensity across time periods</p>

      <div className="overflow-x-auto">
        <div className="min-w-[300px]">
          {/* Column headers */}
          <div className="flex gap-0.5 mb-0.5 ml-20">
            {months.map(m => (
              <div key={m} className="flex-1 text-[9px] text-muted-foreground text-center truncate px-0.5">{m}</div>
            ))}
          </div>

          {/* Rows */}
          {metricTypes.map((type, ri) => (
            <div key={type} className="flex gap-0.5 mb-0.5 items-center">
              <div className="w-20 text-[10px] text-muted-foreground truncate text-right pr-2 capitalize">{type}</div>
              {matrix[ri].map((val, ci) => (
                <div
                  key={ci}
                  className="flex-1 aspect-square rounded-sm min-w-[18px] transition-colors"
                  style={{ backgroundColor: getColor(val) }}
                  title={`${type} — ${months[ci]}: ${(val * 100).toFixed(0)}%`}
                />
              ))}
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-2 mt-3 ml-20">
            <span className="text-[9px] text-muted-foreground">Low</span>
            <div className="flex-1 h-2 rounded-full" style={{
              background: `linear-gradient(to right, hsl(var(--primary) / 0.15), hsl(var(--primary)))`
            }} />
            <span className="text-[9px] text-muted-foreground">High</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeatmapChart;

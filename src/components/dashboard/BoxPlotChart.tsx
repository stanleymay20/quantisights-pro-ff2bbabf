import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ErrorBar, CartesianGrid } from "recharts";
import { BarChart3 } from "lucide-react";
import { MetricRow } from "@/hooks/useMetrics";

interface BoxPlotChartProps {
  metrics: MetricRow[];
}

const BoxPlotChart = ({ metrics }: BoxPlotChartProps) => {
  const data = useMemo(() => {
    if (metrics.length === 0) return [];

    const types = [...new Set(metrics.map(m => m.metric_type))];

    return types.map(type => {
      const values = metrics.filter(m => m.metric_type === type).map(m => Number(m.value)).sort((a, b) => a - b);
      if (values.length < 3) return null;

      const q1Idx = Math.floor(values.length * 0.25);
      const q3Idx = Math.floor(values.length * 0.75);
      const medIdx = Math.floor(values.length * 0.5);

      const q1 = values[q1Idx];
      const q3 = values[q3Idx];
      const median = values[medIdx];
      const min = values[0];
      const max = values[values.length - 1];
      const iqr = q3 - q1;

      return {
        name: type.charAt(0).toUpperCase() + type.slice(1),
        median,
        q1,
        q3,
        min,
        max,
        iqr,
        lowerWhisker: median - q1,
        upperWhisker: q3 - median,
      };
    }).filter(Boolean) as {
      name: string;
      median: number;
      q1: number;
      q3: number;
      min: number;
      max: number;
      iqr: number;
      lowerWhisker: number;
      upperWhisker: number;
    }[];
  }, [metrics]);

  if (data.length === 0) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Distribution Analysis</h3>
        </div>
        <p className="text-xs text-muted-foreground">Upload data to view statistical distributions (box & whisker).</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Distribution Analysis</h3>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">Box & whisker: Q1, median, Q3 with IQR spread</p>

      <div className="space-y-3">
        {data.map(d => {
          const range = d.max - d.min || 1;
          const q1Pct = ((d.q1 - d.min) / range) * 100;
          const medPct = ((d.median - d.min) / range) * 100;
          const q3Pct = ((d.q3 - d.min) / range) * 100;

          return (
            <div key={d.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium capitalize">{d.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Med: {d.median >= 1000 ? `€${(d.median / 1000).toFixed(1)}k` : d.median.toFixed(2)}
                </span>
              </div>
              <div className="relative h-5 bg-muted/30 rounded-full overflow-hidden">
                {/* Whisker line */}
                <div className="absolute top-1/2 h-px bg-muted-foreground/40" style={{ left: "2%", right: "2%", transform: "translateY(-50%)" }} />
                {/* IQR box */}
                <div
                  className="absolute top-1 bottom-1 rounded bg-primary/30 border border-primary/50"
                  style={{ left: `${q1Pct}%`, width: `${q3Pct - q1Pct}%` }}
                />
                {/* Median line */}
                <div
                  className="absolute top-0.5 bottom-0.5 w-0.5 bg-primary rounded-full"
                  style={{ left: `${medPct}%` }}
                />
                {/* Min/Max dots */}
                <div className="absolute top-1/2 w-1.5 h-1.5 rounded-full bg-muted-foreground/60" style={{ left: "2%", transform: "translate(-50%, -50%)" }} />
                <div className="absolute top-1/2 w-1.5 h-1.5 rounded-full bg-muted-foreground/60" style={{ right: "2%", transform: "translate(50%, -50%)" }} />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                <span>{d.min >= 1000 ? `€${(d.min / 1000).toFixed(0)}k` : d.min.toFixed(2)}</span>
                <span>{d.max >= 1000 ? `€${(d.max / 1000).toFixed(0)}k` : d.max.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-4 h-2 rounded bg-primary/30 border border-primary/50" /> IQR (Q1–Q3)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-0.5 h-3 bg-primary rounded-full" /> Median
        </span>
      </div>
    </div>
  );
};

export default BoxPlotChart;

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Gauge } from "lucide-react";

interface GaugeChartProps {
  value: number;
  max?: number;
  label: string;
  unit?: string;
  thresholds?: { warning: number; danger: number };
}

const GaugeChart = ({ value, max = 100, label, unit = "%", thresholds = { warning: 60, danger: 30 } }: GaugeChartProps) => {
  const { gaugeData, color, displayValue } = useMemo(() => {
    const clamped = Math.max(0, Math.min(value, max));
    const pct = (clamped / max) * 100;
    const filled = pct;
    const empty = 100 - pct;

    let c: string;
    if (pct >= thresholds.warning) {
      c = "hsl(142, 71%, 45%)"; // green
    } else if (pct >= thresholds.danger) {
      c = "hsl(38, 92%, 50%)"; // amber
    } else {
      c = "hsl(0, 72%, 51%)"; // red
    }

    return {
      gaugeData: [
        { value: filled, fill: c },
        { value: empty, fill: "hsl(var(--muted))" },
      ],
      color: c,
      displayValue: pct,
    };
  }, [value, max, thresholds]);

  return (
    <div className="glass-card p-6 rounded-xl text-center">
      <div className="flex items-center gap-2 justify-center mb-2">
        <Gauge className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h3>
      </div>

      <div className="h-[140px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={gaugeData}
              cx="50%"
              cy="85%"
              startAngle={180}
              endAngle={0}
              innerRadius="70%"
              outerRadius="100%"
              dataKey="value"
              stroke="none"
            >
              {gaugeData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <p className="text-2xl font-bold font-mono" style={{ color }}>{displayValue.toFixed(0)}{unit}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {displayValue >= thresholds.warning ? "Healthy" : displayValue >= thresholds.danger ? "Warning" : "Critical"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GaugeChart;

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, CartesianGrid } from "recharts";
import { ArrowRightLeft, AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { MetricRow } from "@/hooks/useMetrics";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "react-router-dom";
import { formatCurrency, axisStyle, tooltipStyle, gridStyle, CHART_HEIGHT } from "@/lib/chart-config";

interface Props {
  metrics: MetricRow[];
  datasetLabel?: string;
}

const EBITDABridgeChart = ({ metrics, datasetLabel }: Props) => {
  const analysis = useMemo(() => {
    const revenue = metrics.filter((d) => d.metric_type === "revenue").reduce((s, d) => s + Number(d.value), 0);
    const cogs = metrics.filter((d) => d.metric_type === "cogs").reduce((s, d) => s + Number(d.value), 0);
    const opex = metrics.filter((d) => d.metric_type === "opex").reduce((s, d) => s + Number(d.value), 0);
    const cost = metrics.filter((d) => d.metric_type === "cost").reduce((s, d) => s + Number(d.value), 0);

    const hasCogs = metrics.some((d) => d.metric_type === "cogs");
    const hasOpex = metrics.some((d) => d.metric_type === "opex");
    const hasCost = metrics.some((d) => d.metric_type === "cost");
    const hasRevenue = revenue > 0;

    if (hasRevenue && hasCogs && hasOpex) {
      const grossProfit = revenue - cogs;
      const ebitda = grossProfit - opex;
      return {
        mode: "full" as const,
        title: "EBITDA Bridge",
        steps: [
          { name: "Revenue", value: revenue, bottom: 0, height: revenue, type: "total" },
          { name: "COGS", value: -cogs, bottom: revenue - cogs, height: cogs, type: "negative" },
          { name: "Gross Profit", value: grossProfit, bottom: 0, height: grossProfit, type: "subtotal" },
          { name: "OpEx", value: -opex, bottom: grossProfit - opex, height: opex, type: "negative" },
          { name: "EBITDA", value: ebitda, bottom: 0, height: Math.abs(ebitda), type: ebitda >= 0 ? "total" : "negative" },
        ],
      };
    }

    if (hasRevenue && hasCost) {
      const net = revenue - cost;
      return {
        mode: "simplified" as const,
        title: "Revenue vs Total Spend",
        steps: [
          { name: "Revenue", value: revenue, bottom: 0, height: revenue, type: "total" },
          { name: "Total Spend", value: -cost, bottom: revenue - cost, height: cost, type: "negative" },
          { name: "Est. Net", value: net, bottom: 0, height: Math.abs(net), type: net >= 0 ? "subtotal" : "negative" },
        ],
      };
    }

    return { mode: "empty" as const, title: null, steps: null };
  }, [metrics]);

  const existingTypes = useMemo(() => {
    const types = new Set(metrics.map((m) => m.metric_type));
    return { revenue: types.has("revenue"), cogs: types.has("cogs"), opex: types.has("opex"), cost: types.has("cost") };
  }, [metrics]);

  const colors: Record<string, string> = {
    total: "hsl(var(--primary))",
    subtotal: "hsl(var(--primary))",
    negative: "hsl(var(--destructive))",
  };

  if (analysis.mode === "empty") {
    return (
      <div className="glass-card p-5 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <ArrowRightLeft className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">EBITDA Bridge</h3>
        </div>
        <div className="py-4 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[hsl(var(--warning))]/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5 text-[hsl(var(--warning))]" />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Insufficient data for EBITDA Bridge</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              This chart shows how revenue converts to profit. To enable it, ensure your data includes revenue and cost breakdowns.
            </p>
          </div>
          <div className="text-left max-w-xs mx-auto space-y-1.5 pt-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Required metric types:</p>
            {[
              { key: "revenue", label: "Revenue", present: existingTypes.revenue },
              { key: "cogs", label: "COGS (Cost of Goods Sold)", present: existingTypes.cogs },
              { key: "opex", label: "OpEx (Operating Expenses)", present: existingTypes.opex },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full ${item.present ? "bg-[hsl(var(--success))]" : "bg-muted-foreground/30"}`} />
                <span className={item.present ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                <span className={`ml-auto text-[10px] font-medium ${item.present ? "text-[hsl(var(--success))]" : "text-muted-foreground/50"}`}>
                  {item.present ? "✓ mapped" : "missing"}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            Alternatively, map <strong>revenue</strong> + <strong>cost</strong> for a limited overview.
          </p>
        </div>
      </div>
    );
  }

  // Full mode: proper EBITDA bridge with narrative
  if (analysis.mode === "full") {
    const ebitda = analysis.steps![analysis.steps!.length - 1];
    const rev = analysis.steps![0];
    const marginPct = rev.value > 0 ? ((ebitda.value / rev.value) * 100).toFixed(0) : "0";

    return (
      <div className="glass-card p-5 rounded-xl">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{analysis.title}</h3>
          </div>
          {datasetLabel && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={datasetLabel}>{datasetLabel}</span>
          )}
        </div>
        <p className="text-[11px] text-foreground/80 leading-relaxed mb-3">
          {ebitda.value > 0 && Number(marginPct) > 20
            ? `The business retains ${marginPct}% of revenue as EBITDA (${formatCurrency(ebitda.value)}) — a healthy operating position.`
            : ebitda.value > 0
            ? `EBITDA margin is ${marginPct}% — thin but positive. Cost optimization could meaningfully improve profitability.`
            : `The business is operating at an EBITDA loss. Immediate cost review or revenue acceleration is recommended.`}
        </p>

        <div style={{ height: CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analysis.steps!} barCategoryGap="20%" margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
              <CartesianGrid {...gridStyle} vertical={false} />
              <XAxis dataKey="name" {...axisStyle} />
              <YAxis {...axisStyle} tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatCurrency(Math.abs(v), { compact: false }), "Amount"]} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar dataKey="bottom" stackId="bridge" fill="transparent" />
              <Bar dataKey="height" stackId="bridge" radius={[4, 4, 0, 0]}>
                {analysis.steps!.map((entry, i) => (
                  <Cell key={i} fill={colors[entry.type]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // Simplified mode: epistemically honest — visually downgraded
  const net = analysis.steps![analysis.steps!.length - 1];
  const rev = analysis.steps![0];

  return (
    <div className="glass-card p-5 rounded-xl border border-[hsl(var(--warning))]/30">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-[hsl(var(--warning))]" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{analysis.title}</h3>
          <span className="text-[9px] font-bold uppercase tracking-wider text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10 px-1.5 py-0.5 rounded">
            Limited Insight
          </span>
        </div>
      </div>

      {/* Epistemic honesty block — What we know vs don't know */}
      <div className="rounded-lg bg-[hsl(var(--warning))]/5 border border-[hsl(var(--warning))]/20 p-3 mb-3 space-y-2">
        <div className="flex items-start gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-[hsl(var(--warning))] mt-0.5 shrink-0" />
          <p className="text-[11px] text-foreground/80 leading-relaxed">
            Cost data is not categorized. We can show total spend but <strong>cannot assess profitability quality</strong>, cost efficiency, or margin drivers.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <p className="font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">What we know</p>
            <p className="text-foreground/70">• Total revenue</p>
            <p className="text-foreground/70">• Total spend</p>
            <p className="text-foreground/70">• Estimated net position</p>
          </div>
          <div>
            <p className="font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">What we don't know</p>
            <p className="text-foreground/70">• Cost drivers (production vs ops)</p>
            <p className="text-foreground/70">• Margin quality</p>
            <p className="text-foreground/70">• Operational efficiency</p>
          </div>
        </div>
      </div>

      {/* Chart with reduced visual confidence */}
      <div style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={analysis.steps!} barCategoryGap="20%" margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
            <CartesianGrid {...gridStyle} vertical={false} />
            <XAxis dataKey="name" {...axisStyle} />
            <YAxis {...axisStyle} tickFormatter={(v) => formatCurrency(v)} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatCurrency(Math.abs(v), { compact: false }), "Amount"]} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="bottom" stackId="bridge" fill="transparent" />
            <Bar dataKey="height" stackId="bridge" radius={[4, 4, 0, 0]}>
              {analysis.steps!.map((entry, i) => (
                <Cell
                  key={i}
                  fill={colors[entry.type]}
                  fillOpacity={0.45}
                  stroke={colors[entry.type]}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Action CTA */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground italic">
          Est. net: {formatCurrency(net.value)} ({rev.value > 0 ? ((net.value / rev.value) * 100).toFixed(0) : 0}% of revenue) — treat as directional only
        </p>
        <Link to="/data-upload" className="text-[11px] font-semibold text-primary hover:underline shrink-0">
          Upload cost breakdown →
        </Link>
      </div>
    </div>
  );
};

export default EBITDABridgeChart;

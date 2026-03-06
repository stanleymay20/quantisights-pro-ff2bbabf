import { useState, useEffect } from "react";
import { SidebarMobileToggle } from "@/components/layout/ProtectedShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveDataContext } from "@/hooks/useActiveDataContext";
import DatasetRequired from "@/components/layout/DatasetRequired";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart } from "recharts";
import { TrendingUp, TrendingDown, Minus, Loader2, Sparkles, BarChart3, Activity } from "lucide-react";

const HORIZONS = [3, 6, 12];

interface ForecastData {
  predictions: { date: string; value: number; lower_bound: number; upper_bound: number }[];
  historical: { date: string; value: number }[];
  trend_direction: string;
  seasonality_detected: boolean;
  growth_rate_pct: number;
  confidence_narrative: string;
  mape_estimate: number;
}

const Forecasting = () => {
  const { orgId, datasetId } = useActiveDataContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [metricType, setMetricType] = useState("");
  const [horizon, setHorizon] = useState(6);
  const [data, setData] = useState<ForecastData | null>(null);
  const [availableMetrics, setAvailableMetrics] = useState<string[]>([]);

  // Dynamically discover metric types from the active dataset
  useEffect(() => {
    if (!orgId || !datasetId) return;
    const fetchMetricTypes = async () => {
      const { data: rows } = await supabase
        .from("metrics")
        .select("metric_type")
        .eq("organization_id", orgId)
        .eq("dataset_id", datasetId);
      if (rows) {
        const types = [...new Set(rows.map(r => r.metric_type))];
        setAvailableMetrics(types);
        if (types.length > 0 && !metricType) setMetricType(types[0]);
      }
    };
    fetchMetricTypes();
  }, [orgId, datasetId]);

  const runForecast = async () => {
    if (!orgId || !datasetId || !metricType) {
      toast({ title: "Missing context", description: "Please select a metric type first.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("predictive-forecast", {
        body: { organization_id: orgId, dataset_id: datasetId, metric_type: metricType, horizon_months: horizon },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      setData(result);
      toast({ title: "Forecast generated" });
    } catch (e: any) {
      toast({ title: "Forecast failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const chartData = data ? [
    ...data.historical.map(h => ({ date: h.date, actual: h.value })),
    ...data.predictions.map(p => ({
      date: p.date, forecast: p.value, lower: p.lower_bound, upper: p.upper_bound,
    })),
  ] : [];

  const TrendIcon = data?.trend_direction === "growing" ? TrendingUp
    : data?.trend_direction === "declining" ? TrendingDown : Minus;

  const trendColor = data?.trend_direction === "growing" ? "text-success"
    : data?.trend_direction === "declining" ? "text-destructive" : "text-muted-foreground";

  return (
    <DatasetRequired moduleName="Forecasting">
      <>
        <header className="h-14 border-b border-border/30 flex items-center justify-between px-8 shrink-0 bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <SidebarMobileToggle />
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold font-display">Predictive Forecasting</h1>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-auto space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <Select value={metricType} onValueChange={setMetricType}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableMetrics.map(m => <SelectItem key={m} value={m} className="capitalize">{m.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={String(horizon)} onValueChange={v => setHorizon(Number(v))}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HORIZONS.map(h => <SelectItem key={h} value={String(h)}>{h} months</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={runForecast} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate Forecast
                </Button>
              </div>
            </CardContent>
          </Card>

          {data && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <TrendIcon className={`w-8 h-8 ${trendColor}`} />
                    <div>
                      <p className="text-xs text-muted-foreground">Trend</p>
                      <p className="text-lg font-semibold capitalize">{data.trend_direction}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <BarChart3 className="w-8 h-8 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Growth Rate</p>
                      <p className="text-lg font-semibold">{data.growth_rate_pct?.toFixed(1)}%</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Activity className="w-8 h-8 text-warning" />
                    <div>
                      <p className="text-xs text-muted-foreground">Seasonality</p>
                      <p className="text-lg font-semibold">{data.seasonality_detected ? "Detected" : "None"}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Sparkles className="w-8 h-8 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">MAPE</p>
                      <p className="text-lg font-semibold">{data.mape_estimate?.toFixed(1)}%</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Historical + Forecast ({metricType})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => new Date(d).toLocaleDateString("en", { month: "short", year: "2-digit" })} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip labelFormatter={d => new Date(d).toLocaleDateString("en", { month: "long", year: "numeric" })} />
                        <Area dataKey="upper" fill="hsl(var(--primary) / 0.1)" stroke="none" />
                        <Area dataKey="lower" fill="hsl(var(--background))" stroke="none" />
                        <Line dataKey="actual" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Actual" />
                        <Line dataKey="forecast" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 3 }} name="Forecast" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{data.confidence_narrative}</p>
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </>
    </DatasetRequired>
  );
};

export default Forecasting;

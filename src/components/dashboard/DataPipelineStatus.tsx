import { Database, ArrowRight, Layers, BarChart3, CheckCircle, AlertCircle, Clock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePipelineRuns, type PipelineRun } from "@/hooks/usePipelineRuns";

interface DataPipelineStatusProps {
  orgId: string | null;
  datasetId?: string | null;
}

const stageLabels: Record<string, string> = {
  raw_ingest: "Raw Ingest",
  raw_complete: "Raw Complete",
  transforming: "Transforming",
  transform_complete: "Transform Complete",
  aggregating: "Aggregating",
  complete: "Complete",
};

const statusIcon = (status: string) => {
  switch (status) {
    case "completed": return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    case "running": return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    case "failed": return <AlertCircle className="w-4 h-4 text-destructive" />;
    default: return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
};

const DataPipelineStatus = ({ orgId, datasetId }: DataPipelineStatusProps) => {
  const { latestRun, loading } = usePipelineRuns(orgId, datasetId);

  if (loading || !latestRun) return null;

  const tiers = [
    { label: "Raw", icon: Database, count: latestRun.raw_count, color: "text-blue-500" },
    { label: "Clean", icon: Layers, count: latestRun.transformed_count, color: "text-emerald-500" },
    { label: "Analytical", icon: BarChart3, count: latestRun.aggregated_count, color: "text-violet-500" },
  ];

  return (
    <Card className="border-border/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Data Pipeline</CardTitle>
          <div className="flex items-center gap-2">
            {statusIcon(latestRun.status)}
            <Badge variant={latestRun.status === "completed" ? "default" : "secondary"} className="text-[10px]">
              {stageLabels[latestRun.stage] || latestRun.stage}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          {tiers.map((tier, i) => (
            <div key={tier.label} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-muted/40 min-w-[80px]">
                <tier.icon className={`w-4 h-4 ${tier.color}`} />
                <span className="text-[10px] font-medium text-muted-foreground">{tier.label}</span>
                <span className="text-sm font-bold">{tier.count.toLocaleString()}</span>
              </div>
              {i < tiers.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
            </div>
          ))}
        </div>
        {latestRun.error_count > 0 && (
          <p className="text-[11px] text-muted-foreground mt-2">
            {latestRun.error_count} record{latestRun.error_count > 1 ? "s" : ""} failed validation
          </p>
        )}
        {latestRun.duration_ms && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Completed in {(latestRun.duration_ms / 1000).toFixed(1)}s
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default DataPipelineStatus;

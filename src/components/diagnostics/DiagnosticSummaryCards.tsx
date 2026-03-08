import { Card, CardContent } from "@/components/ui/card";
import { Search, AlertTriangle, BarChart3 } from "lucide-react";

interface DiagnosticSummaryCardsProps {
  analyzedCount: number;
  criticalCount: number;
  warningCount: number;
  totalDiagnosed: number;
}

const DiagnosticSummaryCards = ({ analyzedCount, criticalCount, warningCount, totalDiagnosed }: DiagnosticSummaryCardsProps) => (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Search className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{analyzedCount}</p>
          <p className="text-xs text-muted-foreground">Data Points Analyzed</p>
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-destructive" />
        </div>
        <div>
          <p className="text-2xl font-bold">{criticalCount}</p>
          <p className="text-xs text-muted-foreground">Critical Issues</p>
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-warning" />
        </div>
        <div>
          <p className="text-2xl font-bold">{warningCount}</p>
          <p className="text-xs text-muted-foreground">Warnings</p>
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-success" />
        </div>
        <div>
          <p className="text-2xl font-bold">{totalDiagnosed}</p>
          <p className="text-xs text-muted-foreground">Metrics Diagnosed</p>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default DiagnosticSummaryCards;

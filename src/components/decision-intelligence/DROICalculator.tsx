import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Clock, AlertTriangle, BookOpen } from "lucide-react";
import type { DecisionPerformance } from "@/hooks/useDecisionPerformance";

/**
 * DROI (Decision Return on Investment) Calculator
 * 
 * From "Decision Intelligence: The Operating System for Billion-Dollar Decisions"
 * by Stanley Osei-Wusu (Chapter 3).
 * 
 * DROI quantifies the financial uplift from improved decision processes:
 * - Total Cost of Inaction (TCI): value lost from delayed/avoided decisions
 * - Decision Quality Gap: divergence between actual and optimal performance
 * - Calibration Value: quantified benefit of improved prediction accuracy
 */

interface DROICalculatorProps {
  performance: DecisionPerformance | null;
  avgRevenue?: number;
  loading?: boolean;
}

const DROICalculator = ({ performance, avgRevenue = 0, loading }: DROICalculatorProps) => {
  const metrics = useMemo(() => {
    if (!performance || performance.totalDecisions === 0) return null;

    const successRate = performance.successRate ?? 0;
    const avgAccuracy = performance.avgAccuracy ?? 50;
    const calibrationGap = performance.calibrationGap ?? 0;
    const totalDecisions = performance.totalDecisions;

    // Decision Quality Gap: estimated % of decisions that could have been better
    const qualityGap = Math.max(0, 100 - successRate);

    // Estimated DROI multiplier based on calibration improvement
    // Better calibration → fewer false positives → less wasted capital
    const falsePositiveReduction = Math.min(50, (avgAccuracy / 100) * 50);
    const droiMultiplier = 1 + (falsePositiveReduction / 100) + (successRate / 200);

    // TCI proxy: decisions with negative outcomes × estimated avg cost
    const negativeRate = performance.negativeCount / Math.max(1, performance.evaluableDecisions);
    const estimatedTCI = avgRevenue > 0
      ? Math.round(avgRevenue * negativeRate * 0.15) // 15% of revenue lost per failed decision
      : null;

    // Calibration value: improvement in accuracy reduces decision error cost
    const calibrationValue = Math.abs(calibrationGap) > 0
      ? Math.round(100 - Math.abs(calibrationGap))
      : null;

    return {
      qualityGap,
      droiMultiplier: Math.round(droiMultiplier * 10) / 10,
      estimatedTCI,
      calibrationValue,
      successRate,
      totalDecisions,
      falsePositiveReduction: Math.round(falsePositiveReduction),
    };
  }, [performance, avgRevenue]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Calculating DROI…
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-2">
            <DollarSign className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Decision Return on Investment requires completed decisions with measured outcomes.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Decision Return on Investment (DROI)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* DROI Multiplier */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-center">
            <div className="text-2xl font-bold text-primary">{metrics.droiMultiplier}x</div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">DROI Multiplier</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-2xl font-bold">{metrics.qualityGap}%</div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Quality Gap</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-2xl font-bold">{metrics.falsePositiveReduction}%</div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Error Reduction</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-2xl font-bold">{metrics.totalDecisions}</div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Decisions Tracked</p>
          </div>
        </div>

        {/* TCI Alert */}
        {metrics.estimatedTCI !== null && metrics.estimatedTCI > 0 && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Total Cost of Inaction (TCI)</p>
              <p className="text-xs text-muted-foreground">
                Estimated €{metrics.estimatedTCI.toLocaleString()} in value erosion from decisions with negative outcomes. 
                TCI grows exponentially with delay — each week of inaction compounds the cost.
              </p>
            </div>
          </div>
        )}

        {/* Calibration Value */}
        {metrics.calibrationValue !== null && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/[0.03] border border-primary/10">
            <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Calibration Value Index: {metrics.calibrationValue}/100</p>
              <p className="text-xs text-muted-foreground">
                Your organization's prediction accuracy generates measurable value through reduced false-positive costs 
                and faster decision velocity. Higher scores = less capital wasted on overconfident bets.
              </p>
            </div>
          </div>
        )}

        {/* Book attribution */}
        <div className="flex items-start gap-2 pt-2 border-t border-border/50">
          <BookOpen className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
          <p className="text-[10px] text-muted-foreground/60">
            DROI & TCI metrics from <em>"Decision Intelligence"</em> by Stanley Osei-Wusu (Ch. 3)
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DROICalculator;

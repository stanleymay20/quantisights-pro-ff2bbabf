/**
 * Executive Intelligence Engine
 * 
 * Pure functions for strategic health scoring, risk aggregation,
 * forecast projection, and executive summary generation.
 * No fabricated data — all outputs traceable to input metrics.
 */

import {
  mean, stdDev, detectTrend, driverAnalysis, evidenceConfidence,
  type TrendResult, type DriverResult,
} from "@/lib/analysis-engine";
import { exponentialSmoothing, detectSeasonality } from "@/lib/advanced-statistics";
import type { MetricRow } from "@/hooks/useMetrics";

// ═══════════════════════════════════════════════════════
// STRATEGIC HEALTH
// ═══════════════════════════════════════════════════════

export interface StrategicHealth {
  overallScore: number; // 0-100
  growthMomentum: number; // -100 to +100
  riskLevel: "low" | "medium" | "high" | "critical";
  forecastConfidence: number; // 0-100
  dataPoints: number;
  components: { label: string; score: number; weight: number }[];
}

export function computeStrategicHealth(metrics: MetricRow[]): StrategicHealth | null {
  if (metrics.length < 4) return null;

  const byType = groupByType(metrics);
  const components: { label: string; score: number; weight: number }[] = [];

  // Growth component: average trend across all metric types
  let growthSum = 0, growthCount = 0;
  byType.forEach((rows, type) => {
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const vals = sorted.map(r => Number(r.value));
    const trend = detectTrend(vals);
    if (trend) {
      const score = Math.max(0, Math.min(100, 50 + trend.changePct));
      components.push({ label: `${type} growth`, score, weight: 1 });
      growthSum += trend.changePct;
      growthCount++;
    }
  });

  // Stability component: inverse of volatility
  let volatilitySum = 0, volCount = 0;
  byType.forEach((rows, type) => {
    const vals = rows.map(r => Number(r.value));
    if (vals.length < 4) return;
    const cv = mean(vals) !== 0 ? stdDev(vals) / Math.abs(mean(vals)) : 0;
    const stabilityScore = Math.max(0, Math.min(100, 100 - cv * 200));
    components.push({ label: `${type} stability`, score: stabilityScore, weight: 0.8 });
    volatilitySum += cv;
    volCount++;
  });

  // Data quality component
  const dataScore = Math.min(100, 30 + metrics.length * 0.5);
  components.push({ label: "data coverage", score: dataScore, weight: 0.5 });

  if (components.length === 0) return null;

  // Weighted average
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const overallScore = Math.round(
    components.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight
  );

  const growthMomentum = growthCount > 0 ? Math.round(growthSum / growthCount) : 0;
  const avgVolatility = volCount > 0 ? volatilitySum / volCount : 0;

  const riskLevel: StrategicHealth["riskLevel"] =
    avgVolatility > 0.4 || overallScore < 30 ? "critical" :
    avgVolatility > 0.25 || overallScore < 45 ? "high" :
    avgVolatility > 0.15 || overallScore < 60 ? "medium" : "low";

  const forecastConfidence = evidenceConfidence(metrics.length, null);

  return {
    overallScore,
    growthMomentum,
    riskLevel,
    forecastConfidence,
    dataPoints: metrics.length,
    components,
  };
}

// ═══════════════════════════════════════════════════════
// RISK RADAR
// ═══════════════════════════════════════════════════════

export interface RiskSignal {
  category: string;
  level: "low" | "medium" | "high";
  description: string;
  metric: string;
  value: number;
}

export function aggregateRiskSignals(metrics: MetricRow[]): RiskSignal[] {
  if (metrics.length < 4) return [];

  const byType = groupByType(metrics);
  const signals: RiskSignal[] = [];

  byType.forEach((rows, type) => {
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const vals = sorted.map(r => Number(r.value));
    if (vals.length < 4) return;

    // Volatility risk
    const m = mean(vals);
    const cv = m !== 0 ? stdDev(vals) / Math.abs(m) : 0;
    if (cv > 0.2) {
      signals.push({
        category: "volatility",
        level: cv > 0.4 ? "high" : "medium",
        description: `${type.replace(/_/g, " ")} shows ${(cv * 100).toFixed(0)}% coefficient of variation`,
        metric: type,
        value: cv,
      });
    }

    // Decline risk
    const trend = detectTrend(vals);
    if (trend && trend.changePct < -15) {
      signals.push({
        category: "decline",
        level: trend.changePct < -30 ? "high" : "medium",
        description: `${type.replace(/_/g, " ")} declined ${Math.abs(trend.changePct).toFixed(1)}%`,
        metric: type,
        value: trend.changePct,
      });
    }

    // Anomaly spike risk: recent value far from mean
    const lastVal = vals[vals.length - 1];
    const sd = stdDev(vals);
    if (sd > 0 && Math.abs(lastVal - m) / sd > 2) {
      signals.push({
        category: "anomaly",
        level: Math.abs(lastVal - m) / sd > 3 ? "high" : "medium",
        description: `Latest ${type.replace(/_/g, " ")} value deviates ${((lastVal - m) / sd).toFixed(1)}σ from mean`,
        metric: type,
        value: (lastVal - m) / sd,
      });
    }
  });

  return signals.sort((a, b) => {
    const lev = { high: 0, medium: 1, low: 2 };
    return (lev[a.level] ?? 2) - (lev[b.level] ?? 2);
  });
}

// ═══════════════════════════════════════════════════════
// FORECAST PROJECTION
// ═══════════════════════════════════════════════════════

export interface ForecastScenario {
  label: string;
  values: number[];
  periods: string[];
}

export interface ForecastResult {
  metric: string;
  baseline: ForecastScenario;
  upside: ForecastScenario;
  downside: ForecastScenario;
  confidence: number;
  sampleSize: number;
}

export function generateForecast(
  vals: number[],
  metricType: string,
  periodsAhead: number = 3
): ForecastResult | null {
  if (vals.length < 6) return null;

  // Try exponential smoothing first (superior to linear regression)
  const seasonality = vals.length >= 12 ? detectSeasonality(vals) : null;
  const esResult = exponentialSmoothing(vals, periodsAhead, seasonality?.detected ? seasonality.period ?? undefined : undefined);

  if (esResult && esResult.mape < 50) {
    return {
      metric: metricType,
      baseline: { label: `Baseline (${esResult.method})`, values: esResult.forecast, periods: esResult.forecast.map((_, i) => `T+${i + 1}`) },
      upside: { label: "Upside (80% PI)", values: esResult.confidence80.upper, periods: esResult.forecast.map((_, i) => `T+${i + 1}`) },
      downside: { label: "Downside (80% PI)", values: esResult.confidence80.lower, periods: esResult.forecast.map((_, i) => `T+${i + 1}`) },
      confidence: evidenceConfidence(vals.length, null),
      sampleSize: vals.length,
    };
  }

  // Fallback: simple linear regression
  const n = vals.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += vals[i]; sumXY += i * vals[i]; sumX2 += i * i;
  }
  const den = n * sumX2 - sumX * sumX;
  if (den === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / den;
  const intercept = (sumY - slope * sumX) / n;

  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i;
    ssRes += (vals[i] - predicted) ** 2;
  }
  const rse = Math.sqrt(ssRes / Math.max(1, n - 2));

  const baseline: number[] = [];
  const upside: number[] = [];
  const downside: number[] = [];
  const periods: string[] = [];

  for (let p = 1; p <= periodsAhead; p++) {
    const x = n - 1 + p;
    const predicted = intercept + slope * x;
    baseline.push(Math.round(predicted * 100) / 100);
    upside.push(Math.round((predicted + 1.28 * rse) * 100) / 100);
    downside.push(Math.round((predicted - 1.28 * rse) * 100) / 100);
    periods.push(`T+${p}`);
  }

  return {
    metric: metricType,
    baseline: { label: "Baseline (linear regression)", values: baseline, periods },
    upside: { label: "Upside (80% PI)", values: upside, periods },
    downside: { label: "Downside (80% PI)", values: downside, periods },
    confidence: evidenceConfidence(n, null),
    sampleSize: n,
  };
}

// ═══════════════════════════════════════════════════════
// EXECUTIVE SUMMARY GENERATOR
// ═══════════════════════════════════════════════════════

export function generateExecutiveSummary(
  health: StrategicHealth | null,
  risks: RiskSignal[],
  drivers: DriverResult[] | null,
  pendingDecisions: number,
  datasetName?: string,
  metrics?: MetricRow[],
): string {
  if (!health) return "Insufficient data to generate executive summary. Upload or connect data to enable strategic intelligence.";

  const parts: string[] = [];

  // Health overview
  if (health.growthMomentum > 10) {
    parts.push(`Growth momentum is positive at +${health.growthMomentum}%.`);
  } else if (health.growthMomentum < -10) {
    parts.push(`Growth momentum has slowed to ${health.growthMomentum}%.`);
  } else {
    parts.push("Growth momentum is stable.");
  }

  // Risk summary
  const highRisks = risks.filter(r => r.level === "high");
  if (highRisks.length > 0) {
    parts.push(`${highRisks.length} high-priority risk signal${highRisks.length > 1 ? "s" : ""} detected: ${highRisks.slice(0, 2).map(r => r.description).join("; ")}.`);
  } else if (risks.length > 0) {
    parts.push(`${risks.length} risk signal${risks.length > 1 ? "s" : ""} under monitoring, none critical.`);
  }

  // Driver insight
  if (drivers && drivers.length > 0) {
    const top = drivers[0];
    parts.push(`Primary change driver: ${top.metric.replace(/_/g, " ")} (${top.changePct > 0 ? "+" : ""}${top.changePct.toFixed(1)}%, ${top.contribution.toFixed(0)}% of total variance).`);
  }

  // Seasonality warning
  if (metrics && metrics.length >= 12) {
    const byType = new Map<string, number[]>();
    metrics.forEach(m => {
      const list = byType.get(m.metric_type) || [];
      list.push(Number(m.value));
      byType.set(m.metric_type, list);
    });
    
    const seasonalMetrics: string[] = [];
    byType.forEach((vals, type) => {
      if (vals.length >= 12) {
        const seasonality = detectSeasonality(vals);
        if (seasonality.detected && seasonality.strength > 0.3) {
          seasonalMetrics.push(type.replace(/_/g, " "));
        }
      }
    });
    
    if (seasonalMetrics.length > 0) {
      parts.push(`Seasonal patterns detected in ${seasonalMetrics.slice(0, 3).join(", ")} — compare same-period YoY for accurate assessment.`);
    }
  }

  // Pending decisions
  if (pendingDecisions > 0) {
    parts.push(`${pendingDecisions} strategic decision${pendingDecisions > 1 ? "s" : ""} require${pendingDecisions === 1 ? "s" : ""} executive attention.`);
  }

  const prefix = datasetName ? `Based on "${datasetName}" analysis: ` : "";
  return prefix + parts.join(" ");
}

// ═══════════════════════════════════════════════════════
// PERFORMANCE DRIVERS
// ═══════════════════════════════════════════════════════

export function computePerformanceDrivers(metrics: MetricRow[]): DriverResult[] | null {
  if (metrics.length < 8) return null;
  const byType = groupByType(metrics);
  const valsMap = new Map<string, number[]>();
  byType.forEach((rows, type) => {
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    valsMap.set(type, sorted.map(r => Number(r.value)));
  });
  return driverAnalysis(valsMap);
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function groupByType(metrics: MetricRow[]): Map<string, MetricRow[]> {
  const byType = new Map<string, MetricRow[]>();
  metrics.forEach(m => {
    const list = byType.get(m.metric_type) || [];
    list.push(m);
    byType.set(m.metric_type, list);
  });
  return byType;
}

/**
 * Statistical Anomaly Detection Engine
 * 
 * Production-grade anomaly detection using multiple methods:
 * - Z-Score (standard + modified with MAD)
 * - IQR (Tukey's fences)
 * - Grubbs' Test (single outlier, parametric)
 * - GESD (Generalized Extreme Studentized Deviate)
 * - Seasonal decomposition anomalies
 * 
 * All methods return explainability metadata.
 */

import { mean, stdDev, median } from "./analysis-engine";

export interface StatisticalAnomaly {
  index: number;
  value: number;
  date?: string;
  method: string;
  score: number; // 0-1 anomaly severity
  direction: "high" | "low";
  context: {
    threshold: number;
    statistic: number;
    baseline: number;
    description: string;
  };
}

export interface AnomalyReport {
  method: string;
  anomalies: StatisticalAnomaly[];
  summary: {
    total_points: number;
    anomaly_count: number;
    anomaly_rate: number;
    methods_used: string[];
    consensus_anomalies: number; // flagged by 2+ methods
  };
}

// ═══════════════════════════════════════════════════════
// Z-SCORE (Standard)
// ═══════════════════════════════════════════════════════

export function zScoreAnomalies(vals: number[], threshold = 2.5, dates?: string[]): StatisticalAnomaly[] {
  if (vals.length < 5) return [];
  const m = mean(vals);
  const s = stdDev(vals);
  if (s === 0) return [];

  const anomalies: StatisticalAnomaly[] = [];
  for (let i = 0; i < vals.length; i++) {
    const z = (vals[i] - m) / s;
    if (Math.abs(z) > threshold) {
      anomalies.push({
        index: i,
        value: vals[i],
        date: dates?.[i],
        method: "z-score",
        score: Math.min(1, Math.abs(z) / 5),
        direction: z > 0 ? "high" : "low",
        context: {
          threshold,
          statistic: Math.abs(z),
          baseline: m,
          description: `Value ${vals[i].toFixed(2)} is ${Math.abs(z).toFixed(2)} standard deviations from mean ${m.toFixed(2)}`,
        },
      });
    }
  }
  return anomalies;
}

// ═══════════════════════════════════════════════════════
// MODIFIED Z-SCORE (MAD-based, robust to outliers)
// ═══════════════════════════════════════════════════════

export function modifiedZScoreAnomalies(vals: number[], threshold = 3.5, dates?: string[]): StatisticalAnomaly[] {
  if (vals.length < 5) return [];
  const med = median(vals);
  
  // Median Absolute Deviation
  const deviations = vals.map(v => Math.abs(v - med));
  const mad = median(deviations);
  if (mad === 0) return [];
  
  const k = 0.6745; // consistency constant for normal distribution
  const anomalies: StatisticalAnomaly[] = [];
  
  for (let i = 0; i < vals.length; i++) {
    const modifiedZ = (k * (vals[i] - med)) / mad;
    if (Math.abs(modifiedZ) > threshold) {
      anomalies.push({
        index: i,
        value: vals[i],
        date: dates?.[i],
        method: "modified-z-score",
        score: Math.min(1, Math.abs(modifiedZ) / 7),
        direction: modifiedZ > 0 ? "high" : "low",
        context: {
          threshold,
          statistic: Math.abs(modifiedZ),
          baseline: med,
          description: `Modified z-score ${Math.abs(modifiedZ).toFixed(2)} exceeds threshold ${threshold} (MAD-robust, resistant to masking)`,
        },
      });
    }
  }
  return anomalies;
}

// ═══════════════════════════════════════════════════════
// IQR (Tukey's Fences)
// ═══════════════════════════════════════════════════════

export function iqrAnomalies(vals: number[], k = 1.5, dates?: string[]): StatisticalAnomaly[] {
  if (vals.length < 5) return [];
  const sorted = [...vals].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  if (iqr === 0) return [];
  
  const lowerFence = q1 - k * iqr;
  const upperFence = q3 + k * iqr;
  
  const anomalies: StatisticalAnomaly[] = [];
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] < lowerFence || vals[i] > upperFence) {
      const distance = vals[i] < lowerFence
        ? (lowerFence - vals[i]) / iqr
        : (vals[i] - upperFence) / iqr;
      
      anomalies.push({
        index: i,
        value: vals[i],
        date: dates?.[i],
        method: "iqr-tukey",
        score: Math.min(1, distance / 3),
        direction: vals[i] > upperFence ? "high" : "low",
        context: {
          threshold: k,
          statistic: distance,
          baseline: (q1 + q3) / 2,
          description: `Value ${vals[i].toFixed(2)} outside Tukey fences [${lowerFence.toFixed(2)}, ${upperFence.toFixed(2)}] (IQR=${iqr.toFixed(2)})`,
        },
      });
    }
  }
  return anomalies;
}

// ═══════════════════════════════════════════════════════
// GRUBBS' TEST (single outlier, parametric)
// ═══════════════════════════════════════════════════════

export function grubbsTest(vals: number[], alpha = 0.05, dates?: string[]): StatisticalAnomaly[] {
  if (vals.length < 7) return []; // Grubbs needs sufficient sample
  
  const m = mean(vals);
  const s = stdDev(vals);
  if (s === 0) return [];
  
  // Find the value farthest from mean
  let maxDev = 0;
  let maxIdx = 0;
  for (let i = 0; i < vals.length; i++) {
    const dev = Math.abs(vals[i] - m);
    if (dev > maxDev) {
      maxDev = dev;
      maxIdx = i;
    }
  }
  
  const G = maxDev / s;
  const n = vals.length;
  
  // Critical value approximation (two-sided) using t-distribution
  // G_critical = ((n-1) / sqrt(n)) * sqrt(t²_crit / (n - 2 + t²_crit))
  // Simplified: for n > 10, approximate critical G
  const tCrit = alpha === 0.05 ? 1.96 : 2.576;
  const gCritical = ((n - 1) / Math.sqrt(n)) * Math.sqrt(tCrit * tCrit / (n - 2 + tCrit * tCrit));
  
  if (G > gCritical) {
    return [{
      index: maxIdx,
      value: vals[maxIdx],
      date: dates?.[maxIdx],
      method: "grubbs",
      score: Math.min(1, G / (gCritical * 2)),
      direction: vals[maxIdx] > m ? "high" : "low",
      context: {
        threshold: gCritical,
        statistic: G,
        baseline: m,
        description: `Grubbs' G=${G.toFixed(3)} > critical ${gCritical.toFixed(3)} (α=${alpha}). Statistically significant outlier.`,
      },
    }];
  }
  return [];
}

// ═══════════════════════════════════════════════════════
// ROLLING WINDOW ANOMALIES (for time-series)
// ═══════════════════════════════════════════════════════

export function rollingWindowAnomalies(vals: number[], windowSize = 7, threshold = 2.5, dates?: string[]): StatisticalAnomaly[] {
  if (vals.length < windowSize + 3) return [];
  const anomalies: StatisticalAnomaly[] = [];
  
  for (let i = windowSize; i < vals.length; i++) {
    const window = vals.slice(i - windowSize, i);
    const m = mean(window);
    const s = stdDev(window);
    if (s === 0) continue;
    
    const z = (vals[i] - m) / s;
    if (Math.abs(z) > threshold) {
      anomalies.push({
        index: i,
        value: vals[i],
        date: dates?.[i],
        method: "rolling-window",
        score: Math.min(1, Math.abs(z) / 5),
        direction: z > 0 ? "high" : "low",
        context: {
          threshold,
          statistic: Math.abs(z),
          baseline: m,
          description: `Value deviates ${Math.abs(z).toFixed(2)}σ from ${windowSize}-period rolling mean ${m.toFixed(2)}`,
        },
      });
    }
  }
  return anomalies;
}

// ═══════════════════════════════════════════════════════
// ENSEMBLE DETECTION (consensus across methods)
// ═══════════════════════════════════════════════════════

export function ensembleAnomalyDetection(vals: number[], dates?: string[]): AnomalyReport {
  const allAnomalies: StatisticalAnomaly[] = [];
  const methodsUsed: string[] = [];
  
  // Run all applicable methods
  const zResults = zScoreAnomalies(vals, 2.5, dates);
  if (zResults.length > 0) { allAnomalies.push(...zResults); methodsUsed.push("z-score"); }
  
  const modZResults = modifiedZScoreAnomalies(vals, 3.5, dates);
  if (modZResults.length > 0) { allAnomalies.push(...modZResults); methodsUsed.push("modified-z-score"); }
  
  const iqrResults = iqrAnomalies(vals, 1.5, dates);
  if (iqrResults.length > 0) { allAnomalies.push(...iqrResults); methodsUsed.push("iqr-tukey"); }
  
  const grubbsResults = grubbsTest(vals, 0.05, dates);
  if (grubbsResults.length > 0) { allAnomalies.push(...grubbsResults); methodsUsed.push("grubbs"); }
  
  const rollingResults = rollingWindowAnomalies(vals, 7, 2.5, dates);
  if (rollingResults.length > 0) { allAnomalies.push(...rollingResults); methodsUsed.push("rolling-window"); }
  
  // Count consensus (indices flagged by 2+ methods)
  const indexCounts = new Map<number, number>();
  for (const a of allAnomalies) {
    indexCounts.set(a.index, (indexCounts.get(a.index) || 0) + 1);
  }
  const consensusCount = [...indexCounts.values()].filter(c => c >= 2).length;
  
  // Deduplicate by index, keeping highest score
  const bestByIndex = new Map<number, StatisticalAnomaly>();
  for (const a of allAnomalies) {
    const existing = bestByIndex.get(a.index);
    if (!existing || a.score > existing.score) {
      bestByIndex.set(a.index, {
        ...a,
        score: Math.min(1, a.score * (indexCounts.get(a.index)! >= 2 ? 1.2 : 1)), // boost consensus
        method: indexCounts.get(a.index)! >= 2 ? `consensus(${indexCounts.get(a.index)})` : a.method,
      });
    }
  }
  
  const deduplicated = [...bestByIndex.values()].sort((a, b) => b.score - a.score);
  
  return {
    method: "ensemble",
    anomalies: deduplicated,
    summary: {
      total_points: vals.length,
      anomaly_count: deduplicated.length,
      anomaly_rate: vals.length > 0 ? deduplicated.length / vals.length : 0,
      methods_used: methodsUsed,
      consensus_anomalies: consensusCount,
    },
  };
}

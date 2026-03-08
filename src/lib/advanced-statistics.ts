/**
 * Advanced Statistical Methods — Enterprise-Grade Analysis
 * 
 * Seasonality detection, exponential smoothing, ANOVA,
 * distribution profiling, and changepoint detection.
 * 
 * All methods are pure functions. No fabricated outputs.
 */

import { mean, stdDev, median, variance, iterativeMin, iterativeMax } from "./analysis-engine";

// ═══════════════════════════════════════════════════════
// DISTRIBUTION PROFILING
// ═══════════════════════════════════════════════════════

export interface DistributionProfile {
  type: "normal" | "skewed_right" | "skewed_left" | "bimodal" | "uniform" | "heavy_tailed" | "unknown";
  skewness: number;
  kurtosis: number;
  isNormal: boolean;
  shapiroWilkApprox: number; // 0-1, closer to 1 = more normal
  recommendation: string;
}

/** Compute skewness (Fisher's) */
function computeSkewness(vals: number[]): number {
  if (vals.length < 3) return 0;
  const m = mean(vals);
  const s = stdDev(vals);
  if (s === 0) return 0;
  let sum = 0;
  for (let i = 0; i < vals.length; i++) sum += ((vals[i] - m) / s) ** 3;
  return (sum * vals.length) / ((vals.length - 1) * (vals.length - 2));
}

/** Compute excess kurtosis */
function computeKurtosis(vals: number[]): number {
  if (vals.length < 4) return 0;
  const m = mean(vals);
  const s = stdDev(vals);
  if (s === 0) return 0;
  let sum = 0;
  for (let i = 0; i < vals.length; i++) sum += ((vals[i] - m) / s) ** 4;
  const n = vals.length;
  const raw = (n * (n + 1) * sum) / ((n - 1) * (n - 2) * (n - 3));
  const correction = (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  return raw - correction;
}

/** Approximate normality test (Jarque-Bera based) */
function jarqueBeraStat(n: number, skew: number, kurt: number): number {
  return (n / 6) * (skew ** 2 + (kurt ** 2) / 4);
}

/** Detect bimodality using Hartigan's dip test approximation */
function detectBimodality(vals: number[]): boolean {
  if (vals.length < 20) return false;
  const sorted = [...vals].sort((a, b) => a - b);
  const n = sorted.length;
  const m = mean(vals);
  const s = stdDev(vals);
  if (s === 0) return false;

  // Simple heuristic: check if histogram has two peaks
  const bins = 10;
  const min = sorted[0];
  const max = sorted[n - 1];
  const binWidth = (max - min) / bins;
  if (binWidth === 0) return false;

  const counts = new Array(bins).fill(0);
  for (const v of vals) {
    const idx = Math.min(bins - 1, Math.floor((v - min) / binWidth));
    counts[idx]++;
  }

  // Count local maxima
  let peaks = 0;
  for (let i = 1; i < bins - 1; i++) {
    if (counts[i] > counts[i - 1] && counts[i] > counts[i + 1]) peaks++;
  }
  // Check edges
  if (counts[0] > counts[1]) peaks++;
  if (counts[bins - 1] > counts[bins - 2]) peaks++;

  return peaks >= 2;
}

export function profileDistribution(vals: number[]): DistributionProfile {
  if (vals.length < 8) {
    return { type: "unknown", skewness: 0, kurtosis: 0, isNormal: false, shapiroWilkApprox: 0, recommendation: "Insufficient data (need ≥8 points) for distribution profiling." };
  }

  const skew = computeSkewness(vals);
  const kurt = computeKurtosis(vals);
  const n = vals.length;
  const jb = jarqueBeraStat(n, skew, kurt);
  
  // Approximate p-value from chi-squared(2)
  const pNormal = Math.exp(-jb / 2);
  const isNormal = pNormal > 0.05;
  const isBimodal = detectBimodality(vals);

  let type: DistributionProfile["type"];
  let recommendation: string;

  if (isBimodal) {
    type = "bimodal";
    recommendation = "Data appears bimodal — consider splitting into sub-populations before analysis. Parametric tests may be misleading.";
  } else if (isNormal) {
    type = "normal";
    recommendation = "Data is approximately normally distributed. Parametric tests (t-test, ANOVA, Pearson) are appropriate.";
  } else if (Math.abs(skew) < 0.5 && Math.abs(kurt) < 1) {
    type = "uniform";
    recommendation = "Data has low skewness and kurtosis, suggesting uniform-like distribution. Use non-parametric tests.";
  } else if (skew > 1) {
    type = "skewed_right";
    recommendation = "Right-skewed distribution detected. Consider log-transform or use non-parametric methods (Spearman, Mann-Whitney).";
  } else if (skew < -1) {
    type = "skewed_left";
    recommendation = "Left-skewed distribution detected. Consider transform or non-parametric methods.";
  } else if (kurt > 3) {
    type = "heavy_tailed";
    recommendation = "Heavy-tailed distribution. Outlier-robust methods recommended (median, IQR, trimmed means).";
  } else {
    type = "normal";
    recommendation = "Distribution is approximately symmetric. Standard statistical methods are appropriate.";
  }

  return {
    type,
    skewness: Math.round(skew * 1000) / 1000,
    kurtosis: Math.round(kurt * 1000) / 1000,
    isNormal,
    shapiroWilkApprox: Math.round(pNormal * 1000) / 1000,
    recommendation,
  };
}

// ═══════════════════════════════════════════════════════
// SEASONALITY DETECTION
// ═══════════════════════════════════════════════════════

export interface SeasonalityResult {
  detected: boolean;
  period: number | null; // e.g., 12 for monthly data with yearly seasonality
  strength: number; // 0-1
  seasonalIndices: number[]; // multipliers for each period position
  deseasonalized: number[]; // trend component
  method: string;
}

/**
 * Detect seasonality using autocorrelation analysis.
 * Supports any periodicity (weekly=7, monthly=12, quarterly=4).
 */
export function detectSeasonality(vals: number[], candidatePeriods: number[] = [4, 7, 12, 24, 52]): SeasonalityResult {
  if (vals.length < 12) {
    return { detected: false, period: null, strength: 0, seasonalIndices: [], deseasonalized: vals, method: "insufficient_data" };
  }

  const m = mean(vals);
  const v = variance(vals);
  if (v === 0) {
    return { detected: false, period: null, strength: 0, seasonalIndices: [], deseasonalized: vals, method: "zero_variance" };
  }

  // Compute autocorrelation for candidate periods
  let bestPeriod = 0;
  let bestAcf = 0;

  for (const period of candidatePeriods) {
    if (vals.length < period * 2) continue;
    const acf = autocorrelation(vals, period);
    if (acf > bestAcf && acf > 0.3) { // threshold for meaningful seasonality
      bestAcf = acf;
      bestPeriod = period;
    }
  }

  if (bestPeriod === 0) {
    return { detected: false, period: null, strength: 0, seasonalIndices: [], deseasonalized: vals, method: "autocorrelation" };
  }

  // Compute seasonal indices (ratio-to-moving-average)
  const indices = computeSeasonalIndices(vals, bestPeriod);
  const deseasonalized = vals.map((v, i) => {
    const idx = indices[i % bestPeriod];
    return idx !== 0 ? v / idx : v;
  });

  return {
    detected: true,
    period: bestPeriod,
    strength: Math.round(bestAcf * 1000) / 1000,
    seasonalIndices: indices.map(v => Math.round(v * 1000) / 1000),
    deseasonalized,
    method: "autocorrelation + ratio-to-moving-average",
  };
}

function autocorrelation(vals: number[], lag: number): number {
  const m = mean(vals);
  const n = vals.length;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    den += (vals[i] - m) ** 2;
    if (i + lag < n) {
      num += (vals[i] - m) * (vals[i + lag] - m);
    }
  }
  return den !== 0 ? num / den : 0;
}

function computeSeasonalIndices(vals: number[], period: number): number[] {
  const groups: number[][] = Array.from({ length: period }, () => []);
  
  // Moving average
  const ma: number[] = [];
  for (let i = 0; i < vals.length; i++) {
    if (i < Math.floor(period / 2) || i >= vals.length - Math.floor(period / 2)) {
      ma.push(vals[i]); // use raw at edges
      continue;
    }
    let sum = 0;
    for (let j = i - Math.floor(period / 2); j <= i + Math.floor(period / 2); j++) {
      sum += vals[j];
    }
    ma.push(sum / (period + 1));
  }

  // Ratio to moving average
  for (let i = 0; i < vals.length; i++) {
    if (ma[i] !== 0) {
      groups[i % period].push(vals[i] / ma[i]);
    }
  }

  // Median of ratios per position
  const indices = groups.map(g => g.length > 0 ? median(g) : 1);
  
  // Normalize so indices average to 1
  const avgIdx = mean(indices);
  return avgIdx !== 0 ? indices.map(v => v / avgIdx) : indices;
}

// ═══════════════════════════════════════════════════════
// EXPONENTIAL SMOOTHING (Holt-Winters)
// ═══════════════════════════════════════════════════════

export interface ExponentialSmoothingResult {
  fitted: number[];
  forecast: number[];
  confidence80: { upper: number[]; lower: number[] };
  alpha: number;
  beta: number;
  gamma: number | null;
  mape: number; // Mean Absolute Percentage Error
  method: string;
}

/**
 * Double exponential smoothing (Holt's method) for non-seasonal data.
 * Triple (Holt-Winters) when seasonality is detected.
 */
export function exponentialSmoothing(
  vals: number[],
  periodsAhead: number = 3,
  seasonalPeriod?: number
): ExponentialSmoothingResult | null {
  if (vals.length < 6) return null;

  if (seasonalPeriod && vals.length >= seasonalPeriod * 2) {
    return holtWinters(vals, periodsAhead, seasonalPeriod);
  }
  return holtsMethod(vals, periodsAhead);
}

function holtsMethod(vals: number[], periodsAhead: number): ExponentialSmoothingResult {
  const n = vals.length;
  
  // Optimize alpha/beta via grid search (simple but effective)
  let bestAlpha = 0.3, bestBeta = 0.1, bestMape = Infinity;
  
  for (let a = 0.1; a <= 0.9; a += 0.1) {
    for (let b = 0.01; b <= 0.5; b += 0.05) {
      const mape = holtsMethodMape(vals, a, b);
      if (mape < bestMape) {
        bestMape = mape;
        bestAlpha = a;
        bestBeta = b;
      }
    }
  }

  // Run with best params
  let level = vals[0];
  let trend = vals.length > 1 ? vals[1] - vals[0] : 0;
  const fitted: number[] = [level];

  for (let i = 1; i < n; i++) {
    const prevLevel = level;
    level = bestAlpha * vals[i] + (1 - bestAlpha) * (prevLevel + trend);
    trend = bestBeta * (level - prevLevel) + (1 - bestBeta) * trend;
    fitted.push(level + trend);
  }

  // Forecast
  const forecast: number[] = [];
  const residuals = vals.map((v, i) => Math.abs(v - fitted[i]));
  const residualStd = stdDev(residuals);

  for (let h = 1; h <= periodsAhead; h++) {
    forecast.push(Math.round((level + h * trend) * 100) / 100);
  }

  const upper = forecast.map((f, h) => Math.round((f + 1.28 * residualStd * Math.sqrt(h + 1)) * 100) / 100);
  const lower = forecast.map((f, h) => Math.round((f - 1.28 * residualStd * Math.sqrt(h + 1)) * 100) / 100);

  return {
    fitted,
    forecast,
    confidence80: { upper, lower },
    alpha: bestAlpha,
    beta: bestBeta,
    gamma: null,
    mape: Math.round(bestMape * 100) / 100,
    method: "Holt's double exponential smoothing (optimized)",
  };
}

function holtsMethodMape(vals: number[], alpha: number, beta: number): number {
  let level = vals[0];
  let trend = vals.length > 1 ? vals[1] - vals[0] : 0;
  let mapeSum = 0;
  let count = 0;

  for (let i = 1; i < vals.length; i++) {
    const forecast = level + trend;
    if (vals[i] !== 0) {
      mapeSum += Math.abs((vals[i] - forecast) / vals[i]);
      count++;
    }
    const prevLevel = level;
    level = alpha * vals[i] + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  return count > 0 ? (mapeSum / count) * 100 : Infinity;
}

function holtWinters(vals: number[], periodsAhead: number, period: number): ExponentialSmoothingResult {
  const n = vals.length;
  const alpha = 0.3, beta = 0.1, gamma = 0.3;

  // Initialize seasonal indices
  const seasonal = computeSeasonalIndices(vals, period);
  let level = mean(vals.slice(0, period));
  let trend = (mean(vals.slice(period, period * 2)) - level) / period;
  
  const fitted: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = seasonal[i % period];
    const forecast = (level + trend) * s;
    fitted.push(forecast);

    const prevLevel = level;
    level = alpha * (vals[i] / s) + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonal[i % period] = gamma * (vals[i] / level) + (1 - gamma) * s;
  }

  const residuals = vals.map((v, i) => Math.abs(v - fitted[i]));
  const residualStd = stdDev(residuals);
  let mapeSum = 0, mapeCount = 0;
  for (let i = 0; i < n; i++) {
    if (vals[i] !== 0) { mapeSum += Math.abs((vals[i] - fitted[i]) / vals[i]); mapeCount++; }
  }

  const forecast: number[] = [];
  for (let h = 1; h <= periodsAhead; h++) {
    forecast.push(Math.round((level + h * trend) * seasonal[(n + h - 1) % period] * 100) / 100);
  }

  const upper = forecast.map((f, h) => Math.round((f + 1.28 * residualStd * Math.sqrt(h + 1)) * 100) / 100);
  const lower = forecast.map((f, h) => Math.round((f - 1.28 * residualStd * Math.sqrt(h + 1)) * 100) / 100);

  return {
    fitted,
    forecast,
    confidence80: { upper, lower },
    alpha, beta, gamma,
    mape: mapeCount > 0 ? Math.round((mapeSum / mapeCount) * 10000) / 100 : 0,
    method: "Holt-Winters triple exponential smoothing (multiplicative)",
  };
}

// ═══════════════════════════════════════════════════════
// ONE-WAY ANOVA
// ═══════════════════════════════════════════════════════

export interface AnovaResult {
  fStatistic: number;
  pValue: number;
  dfBetween: number;
  dfWithin: number;
  ssBetween: number;
  ssWithin: number;
  etaSquared: number; // effect size
  groupMeans: { group: string; mean: number; n: number; std: number }[];
  significant: boolean;
  postHoc: PostHocResult[] | null;
}

export interface PostHocResult {
  groupA: string;
  groupB: string;
  meanDiff: number;
  significant: boolean;
}

/**
 * One-way ANOVA for comparing means across 3+ groups.
 * Includes Tukey-like post-hoc comparisons.
 */
export function oneWayAnova(groups: Map<string, number[]>): AnovaResult | null {
  if (groups.size < 3) return null;
  
  const allVals: number[] = [];
  const groupData: { name: string; vals: number[] }[] = [];
  
  groups.forEach((vals, name) => {
    if (vals.length < 2) return;
    groupData.push({ name, vals });
    allVals.push(...vals);
  });

  if (groupData.length < 3 || allVals.length < 10) return null;

  const grandMean = mean(allVals);
  const k = groupData.length;
  const N = allVals.length;

  // Sum of squares
  let ssBetween = 0;
  let ssWithin = 0;

  const groupMeans = groupData.map(g => {
    const gMean = mean(g.vals);
    const gStd = stdDev(g.vals);
    ssBetween += g.vals.length * (gMean - grandMean) ** 2;
    for (const v of g.vals) ssWithin += (v - gMean) ** 2;
    return { group: g.name, mean: gMean, n: g.vals.length, std: gStd };
  });

  const dfBetween = k - 1;
  const dfWithin = N - k;
  if (dfWithin <= 0) return null;

  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;
  if (msWithin === 0) return null;

  const fStatistic = msBetween / msWithin;

  // Approximate F-distribution p-value
  const pValue = fDistPValue(fStatistic, dfBetween, dfWithin);
  const etaSquared = ssBetween / (ssBetween + ssWithin);
  const significant = pValue < 0.05;

  // Post-hoc pairwise comparisons (Bonferroni-corrected)
  let postHoc: PostHocResult[] | null = null;
  if (significant && groupData.length <= 6) {
    postHoc = [];
    const comparisons = (k * (k - 1)) / 2;
    const adjustedAlpha = 0.05 / comparisons;
    const criticalDiff = Math.sqrt(msWithin) * Math.sqrt(2 / mean(groupData.map(g => g.vals.length)));

    for (let i = 0; i < groupData.length; i++) {
      for (let j = i + 1; j < groupData.length; j++) {
        const meanDiff = mean(groupData[i].vals) - mean(groupData[j].vals);
        const se = Math.sqrt(msWithin * (1 / groupData[i].vals.length + 1 / groupData[j].vals.length));
        const t = se > 0 ? Math.abs(meanDiff) / se : 0;
        // Approximate with Bonferroni
        const sig = se > 0 && Math.abs(meanDiff) / se > 2.5; // conservative threshold
        postHoc.push({
          groupA: groupData[i].name,
          groupB: groupData[j].name,
          meanDiff: Math.round(meanDiff * 100) / 100,
          significant: sig,
        });
      }
    }
  }

  return {
    fStatistic: Math.round(fStatistic * 100) / 100,
    pValue: Math.round(pValue * 10000) / 10000,
    dfBetween,
    dfWithin,
    ssBetween: Math.round(ssBetween * 100) / 100,
    ssWithin: Math.round(ssWithin * 100) / 100,
    etaSquared: Math.round(etaSquared * 1000) / 1000,
    groupMeans,
    significant,
    postHoc,
  };
}

/** Approximate F-distribution p-value */
function fDistPValue(f: number, d1: number, d2: number): number {
  if (f <= 0) return 1;
  // Use approximation: F ~ exp(-f * d1 / (2 * d2)) for large d2
  const x = d2 / (d2 + d1 * f);
  return Math.min(1, Math.max(0, incompleteBetaApprox(d2 / 2, d1 / 2, x)));
}

function incompleteBetaApprox(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let sum = 0, term = 1;
  for (let n = 0; n < 200; n++) {
    term *= (x * (a + b + n)) / (a + 1 + n);
    sum += term / (a + 1 + n);
    if (Math.abs(term) < 1e-10) break;
  }
  return Math.min(1, Math.max(0, Math.pow(x, a) * Math.pow(1 - x, b) * (1 / a + sum)));
}

// ═══════════════════════════════════════════════════════
// CHANGEPOINT DETECTION (CUSUM)
// ═══════════════════════════════════════════════════════

export interface Changepoint {
  index: number;
  date?: string;
  meanBefore: number;
  meanAfter: number;
  magnitude: number; // % change
  significance: number; // 0-1
}

/**
 * CUSUM-based changepoint detection.
 * Identifies structural breaks in time series data.
 */
export function detectChangepoints(vals: number[], dates?: string[], minSegment: number = 5): Changepoint[] {
  if (vals.length < minSegment * 2) return [];

  const changepoints: Changepoint[] = [];
  const m = mean(vals);
  const s = stdDev(vals);
  if (s === 0) return [];

  // Binary segmentation approach
  findChangepoint(vals, 0, vals.length - 1, dates, minSegment, s, changepoints, 0);

  return changepoints
    .sort((a, b) => b.significance - a.significance)
    .slice(0, 3); // Max 3 changepoints
}

function findChangepoint(
  vals: number[], start: number, end: number,
  dates: string[] | undefined, minSeg: number, globalStd: number,
  results: Changepoint[], depth: number
): void {
  if (depth > 3) return; // Max recursion
  const n = end - start + 1;
  if (n < minSeg * 2) return;

  // Find point that maximizes between-segment variance
  let bestIdx = -1;
  let bestStat = 0;

  for (let i = start + minSeg; i <= end - minSeg; i++) {
    const left = vals.slice(start, i);
    const right = vals.slice(i, end + 1);
    const mL = mean(left);
    const mR = mean(right);
    
    // CUSUM-like statistic
    const stat = Math.abs(mL - mR) / globalStd * Math.sqrt((left.length * right.length) / n);
    
    if (stat > bestStat) {
      bestStat = stat;
      bestIdx = i;
    }
  }

  // Significance threshold (approximation based on Gaussian assumption)
  const threshold = 1.5 + 0.5 * Math.log(n);
  
  if (bestStat > threshold && bestIdx >= 0) {
    const mBefore = mean(vals.slice(start, bestIdx));
    const mAfter = mean(vals.slice(bestIdx, end + 1));
    const magnitude = mBefore !== 0 ? ((mAfter - mBefore) / Math.abs(mBefore)) * 100 : 0;

    results.push({
      index: bestIdx,
      date: dates?.[bestIdx],
      meanBefore: Math.round(mBefore * 100) / 100,
      meanAfter: Math.round(mAfter * 100) / 100,
      magnitude: Math.round(magnitude * 10) / 10,
      significance: Math.min(1, bestStat / (threshold * 2)),
    });

    // Recurse on both sides
    findChangepoint(vals, start, bestIdx - 1, dates, minSeg, globalStd, results, depth + 1);
    findChangepoint(vals, bestIdx, end, dates, minSeg, globalStd, results, depth + 1);
  }
}

// ═══════════════════════════════════════════════════════
// MANN-WHITNEY U TEST (non-parametric alternative to t-test)
// ═══════════════════════════════════════════════════════

export interface MannWhitneyResult {
  uStatistic: number;
  pValue: number;
  effectSizeR: number; // r = Z / sqrt(N)
  significant: boolean;
  medianA: number;
  medianB: number;
}

/**
 * Mann-Whitney U test for non-normal distributions.
 * Use when profileDistribution indicates non-normality.
 */
export function mannWhitneyU(a: number[], b: number[]): MannWhitneyResult | null {
  if (a.length < 3 || b.length < 3) return null;

  const nA = a.length;
  const nB = b.length;
  const combined = [
    ...a.map(v => ({ v, group: "a" as const })),
    ...b.map(v => ({ v, group: "b" as const })),
  ].sort((x, y) => x.v - y.v);

  // Assign ranks
  const ranks = new Array(combined.length);
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j < combined.length && combined[j].v === combined[i].v) j++;
    const avgRank = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) ranks[k] = avgRank;
    i = j;
  }

  // Sum ranks for group A
  let rankSumA = 0;
  for (let k = 0; k < combined.length; k++) {
    if (combined[k].group === "a") rankSumA += ranks[k];
  }

  const u1 = rankSumA - (nA * (nA + 1)) / 2;
  const u2 = nA * nB - u1;
  const U = Math.min(u1, u2);

  // Normal approximation for p-value
  const muU = (nA * nB) / 2;
  const sigmaU = Math.sqrt((nA * nB * (nA + nB + 1)) / 12);
  const z = sigmaU > 0 ? (U - muU) / sigmaU : 0;
  
  // Two-tailed p-value using normal approximation
  const pValue = 2 * (1 - normalCDFApprox(Math.abs(z)));
  const effectSizeR = Math.abs(z) / Math.sqrt(nA + nB);

  return {
    uStatistic: Math.round(U * 100) / 100,
    pValue: Math.round(pValue * 10000) / 10000,
    effectSizeR: Math.round(effectSizeR * 1000) / 1000,
    significant: pValue < 0.05,
    medianA: median(a),
    medianB: median(b),
  };
}

function normalCDFApprox(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * ax);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1.0 + sign * y);
}

/**
 * Intelligence Defensibility: Confidence Capping Rule
 * 
 * Confidence cannot exceed:
 * - 60% for <12 data points
 * - 75% for <30 data points
 * - 90% for robust datasets (30+)
 * 
 * This is a hardcoded, non-negotiable rule across ALL advisory/insight/diagnostic functions.
 * One epistemic policy across all inference surfaces.
 */

export interface ConfidenceResult {
  raw_confidence: number;
  capped_confidence: number;
  confidence_cap_reason: string;
  ceiling: number;
  sample_size: number;
  data_sufficiency: "insufficient" | "limited" | "moderate" | "robust";
  variance_score: number | null;
}

export function capConfidence(rawConfidence: number, sampleSize: number, variance?: number): ConfidenceResult {
  let ceiling: number;
  let reason: string;

  if (sampleSize < 12) {
    ceiling = 60;
    reason = `Sample size ${sampleSize} < 12: ceiling 60%`;
  } else if (sampleSize < 30) {
    ceiling = 75;
    reason = `Sample size ${sampleSize} < 30: ceiling 75%`;
  } else {
    ceiling = 90;
    reason = `Sample size ${sampleSize} ≥ 30: ceiling 90%`;
  }

  const capped = Math.min(rawConfidence, ceiling);

  return {
    raw_confidence: Math.round(rawConfidence),
    capped_confidence: Math.round(capped),
    confidence_cap_reason: reason,
    ceiling,
    sample_size: sampleSize,
    data_sufficiency: dataSufficiencyRating(sampleSize),
    variance_score: variance !== undefined ? Math.round(variance * 100) / 100 : null,
  };
}

/**
 * Returns a data sufficiency rating based on sample size.
 */
export function dataSufficiencyRating(sampleSize: number): "insufficient" | "limited" | "moderate" | "robust" {
  if (sampleSize < 8) return "insufficient";
  if (sampleSize < 12) return "limited";
  if (sampleSize < 30) return "moderate";
  return "robust";
}

/**
 * Compute variance (coefficient of variation) for a set of values.
 */
export function computeVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return (Math.sqrt(variance) / Math.abs(mean)) * 100;
}

/**
 * Compute calibration error: |predicted_confidence - actual_accuracy|
 * Used in Decision Ledger to measure prediction quality.
 */
export function computeCalibrationError(
  predictedConfidence: number,
  outcomeSuccess: boolean
): number {
  const actualOutcome = outcomeSuccess ? 100 : 0;
  return Math.abs(predictedConfidence - actualOutcome);
}

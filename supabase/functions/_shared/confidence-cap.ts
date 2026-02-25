/**
 * Intelligence Defensibility: Confidence Capping Rule
 * 
 * Confidence cannot exceed:
 * - 60% for <12 data points
 * - 75% for <30 data points
 * - 90% for robust datasets (30+)
 * 
 * This is a hardcoded, non-negotiable rule across all advisory/insight functions.
 */
export function capConfidence(rawConfidence: number, sampleSize: number): number {
  let ceiling: number;
  if (sampleSize < 12) {
    ceiling = 60;
  } else if (sampleSize < 30) {
    ceiling = 75;
  } else {
    ceiling = 90;
  }
  return Math.min(rawConfidence, ceiling);
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

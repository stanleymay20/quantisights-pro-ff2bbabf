/**
 * Adaptive Calibration Correction Utility
 * 
 * This is the layer that makes the Adaptive Calibration Engine "real" —
 * it applies learned band corrections to future confidence outputs.
 * 
 * Used by:
 * - confidence-cap.ts (wraps capConfidence with adaptive correction)
 * - Advisory/simulation edge functions
 * - Frontend display of "AI-adjusted confidence"
 */

export interface CalibrationModel {
  band_corrections: Record<string, number>;
  band_sample_sizes: Record<string, number>;
  low_sample_bands: string[];
  overall_calibration_score: number;
  model_version: number;
}

export interface CorrectionResult {
  original: number;
  adjusted: number;
  correction_applied: number;
  band_used: string;
  is_low_sample_band: boolean;
  model_version: number;
}

/**
 * Apply adaptive calibration correction to a confidence value.
 * 
 * Looks up the appropriate band correction from the learned model
 * and adjusts the confidence. Clamped to [1, 99] to avoid 0% or 100%.
 * 
 * Low-sample bands apply a dampened correction (50% weight) to avoid
 * wild swings from insufficient data.
 */
export function applyCalibrationCorrection(
  confidence: number,
  model: CalibrationModel | null
): CorrectionResult {
  const clamped = Math.min(99, Math.max(1, Math.round(confidence)));

  if (!model || !model.band_corrections || Object.keys(model.band_corrections).length === 0) {
    return {
      original: clamped,
      adjusted: clamped,
      correction_applied: 0,
      band_used: "none",
      is_low_sample_band: false,
      model_version: model?.model_version ?? 0,
    };
  }

  // Find the matching band
  const bandStart = Math.floor(clamped / 10) * 10;
  const bandKey = `${bandStart}-${bandStart + 10}`;
  const rawCorrection = model.band_corrections[bandKey];

  if (rawCorrection == null || !Number.isFinite(rawCorrection)) {
    return {
      original: clamped,
      adjusted: clamped,
      correction_applied: 0,
      band_used: bandKey,
      is_low_sample_band: false,
      model_version: model.model_version,
    };
  }

  const isLowSample = (model.low_sample_bands || []).includes(bandKey);
  // Dampen correction for low-sample bands (50% weight)
  const effectiveCorrection = isLowSample ? rawCorrection * 0.5 : rawCorrection;
  const adjusted = Math.min(99, Math.max(1, Math.round(clamped + effectiveCorrection)));

  return {
    original: clamped,
    adjusted,
    correction_applied: Math.round(effectiveCorrection * 10) / 10,
    band_used: bandKey,
    is_low_sample_band: isLowSample,
    model_version: model.model_version,
  };
}

/**
 * Apply calibration correction on top of the epistemic confidence cap.
 * 
 * Order of operations:
 * 1. Raw confidence is capped by epistemic rules (capConfidence)
 * 2. Capped value is then adjusted by adaptive calibration
 * 
 * This ensures:
 * - Epistemic ceiling is never violated
 * - Adaptive correction operates within safe bounds
 * - Final value is re-clamped to [1, ceiling]
 */
export function applyCalibrationAfterCap(
  cappedConfidence: number,
  ceiling: number,
  model: CalibrationModel | null
): CorrectionResult {
  const result = applyCalibrationCorrection(cappedConfidence, model);
  // Never exceed the epistemic ceiling
  result.adjusted = Math.min(result.adjusted, ceiling);
  return result;
}

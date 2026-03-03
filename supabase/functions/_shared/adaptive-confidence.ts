/**
 * Universal Adaptive Confidence Helper
 * 
 * Single entry point for all inference surfaces to apply:
 * 1. Epistemic confidence capping (sample-size rules)
 * 2. Adaptive calibration correction (learned from outcomes)
 * 3. Standardized enterprise metadata contract
 * 
 * Every edge function calls applyAdaptiveConfidence() instead of
 * manually wiring capConfidence + fetchCalibrationModel + metadata.
 */

import { capConfidence, computeVariance, fetchCalibrationModel, type ConfidenceResult } from "./confidence-cap.ts";
import type { CalibrationModel } from "./calibration-correction.ts";

/** Standardized metadata returned by every inference surface */
export interface AdaptiveConfidenceMeta {
  /** Final confidence after all corrections */
  confidence: number;
  /** Raw confidence before any capping */
  raw_confidence: number;
  /** Confidence after epistemic cap, before adaptive correction */
  capped_confidence: number;
  /** Reason for the epistemic cap */
  confidence_cap_reason: string;
  /** Epistemic ceiling applied */
  ceiling: number;
  /** Number of data points used */
  sample_size: number;
  /** Data sufficiency rating */
  data_sufficiency: "insufficient" | "limited" | "moderate" | "robust";
  /** Coefficient of variation */
  variance_score: number | null;
  /** Whether adaptive calibration was applied */
  adaptive_calibration_applied: boolean;
  /** Version of the calibration model used, null if none */
  calibration_model_version: number | null;
  /** Which confidence band the correction came from */
  calibration_band_used: string | null;
  /** Correction in percentage points applied by adaptive model */
  calibration_correction_applied_pp: number | null;
  /** Whether the band had low sample size (dampened correction) */
  calibration_low_sample_band: boolean;
  /** Source of the confidence value */
  confidence_source: "raw" | "capped" | "capped+adaptive";
}

export interface AdaptiveConfidenceInput {
  /** Raw confidence score (0-100) */
  rawConfidence: number;
  /** Number of data points */
  sampleSize: number;
  /** Optional variance/volatility score */
  variance?: number;
  /** Pre-fetched calibration model (pass null to skip fetch) */
  calibrationModel?: CalibrationModel | null;
}

/**
 * Apply the full adaptive confidence pipeline:
 * epistemic cap → adaptive correction → standardized metadata.
 * 
 * Use this as the single entry point in every edge function.
 */
export function applyAdaptiveConfidence(input: AdaptiveConfidenceInput): AdaptiveConfidenceMeta {
  const { rawConfidence, sampleSize, variance, calibrationModel } = input;

  const cap = capConfidence(rawConfidence, sampleSize, variance, calibrationModel ?? null);

  // Determine final confidence
  const finalConfidence = cap.calibrated_confidence ?? cap.capped_confidence;
  const adaptiveApplied = cap.adaptive_adjustment !== undefined && cap.adaptive_adjustment !== 0;

  // Extract band info from the calibration correction if applied
  let bandUsed: string | null = null;
  let correctionPp: number | null = null;
  let isLowSampleBand = false;

  if (calibrationModel && adaptiveApplied) {
    const bandStart = Math.floor(cap.capped_confidence / 10) * 10;
    bandUsed = `${bandStart}-${bandStart + 10}`;
    correctionPp = cap.adaptive_adjustment ?? null;
    isLowSampleBand = (calibrationModel.low_sample_bands || []).includes(bandUsed);
  }

  const confidenceSource: AdaptiveConfidenceMeta["confidence_source"] =
    adaptiveApplied ? "capped+adaptive" :
    cap.capped_confidence < cap.raw_confidence ? "capped" : "raw";

  return {
    confidence: finalConfidence,
    raw_confidence: cap.raw_confidence,
    capped_confidence: cap.capped_confidence,
    confidence_cap_reason: cap.confidence_cap_reason,
    ceiling: cap.ceiling,
    sample_size: cap.sample_size,
    data_sufficiency: cap.data_sufficiency,
    variance_score: cap.variance_score,
    adaptive_calibration_applied: adaptiveApplied,
    calibration_model_version: calibrationModel?.model_version ?? null,
    calibration_band_used: bandUsed,
    calibration_correction_applied_pp: correctionPp,
    calibration_low_sample_band: isLowSampleBand,
    confidence_source: confidenceSource,
  };
}

/**
 * Convenience: fetch model + apply adaptive confidence in one call.
 * Use when you don't already have the calibration model.
 */
export async function applyAdaptiveConfidenceWithFetch(
  input: Omit<AdaptiveConfidenceInput, "calibrationModel">,
  supabaseUrl: string,
  serviceKey: string,
  organizationId: string,
): Promise<AdaptiveConfidenceMeta> {
  const model = await fetchCalibrationModel(supabaseUrl, serviceKey, organizationId);
  return applyAdaptiveConfidence({ ...input, calibrationModel: model });
}

// Re-export for convenience
export { computeVariance, fetchCalibrationModel } from "./confidence-cap.ts";

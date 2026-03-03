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

/**
 * Drift Detection: compare consecutive calibration models to detect degradation.
 * 
 * Returns a drift signal based on MAE trend and bias direction stability.
 */
export interface DriftSignal {
  drift_status: "stable" | "watch" | "degrading";
  drift_reason: string;
  current_mae: number | null;
  previous_mae: number | null;
  mae_delta: number | null;
  bias_direction: string | null;
  bias_flipped: boolean;
}

export async function detectCalibrationDrift(
  supabaseUrl: string,
  serviceKey: string,
  organizationId: string,
): Promise<DriftSignal> {
  const defaultSignal: DriftSignal = {
    drift_status: "stable",
    drift_reason: "Insufficient calibration history",
    current_mae: null,
    previous_mae: null,
    mae_delta: null,
    bias_direction: null,
    bias_flipped: false,
  };

  try {
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/calibration_models?organization_id=eq.${organizationId}&order=computed_at.desc&limit=2&select=mean_absolute_error,overall_bias_direction,model_version`,
      { headers }
    );
    if (!resp.ok) return defaultSignal;
    const models = await resp.json();
    if (!models || models.length < 2) return defaultSignal;

    const [current, previous] = models;
    const currentMae = current.mean_absolute_error;
    const previousMae = previous.mean_absolute_error;
    const biasFlipped = !!(current.overall_bias_direction && previous.overall_bias_direction
      && current.overall_bias_direction !== previous.overall_bias_direction);

    if (currentMae == null || previousMae == null) return defaultSignal;

    const maeDelta = currentMae - previousMae;
    const maeWorsened = maeDelta > 2; // >2pp degradation
    const maeSignificantlyWorsened = maeDelta > 5;

    let status: DriftSignal["drift_status"] = "stable";
    let reason = "Calibration accuracy is stable";

    if (maeSignificantlyWorsened || (maeWorsened && biasFlipped)) {
      status = "degrading";
      reason = maeSignificantlyWorsened
        ? `MAE increased by ${maeDelta.toFixed(1)}pp (${previousMae.toFixed(1)} → ${currentMae.toFixed(1)})`
        : `MAE worsened and bias direction flipped (${previous.overall_bias_direction} → ${current.overall_bias_direction})`;
    } else if (maeWorsened || biasFlipped) {
      status = "watch";
      reason = maeWorsened
        ? `MAE increased by ${maeDelta.toFixed(1)}pp — monitoring`
        : `Bias direction changed from ${previous.overall_bias_direction} to ${current.overall_bias_direction}`;
    }

    return {
      drift_status: status,
      drift_reason: reason,
      current_mae: currentMae,
      previous_mae: previousMae,
      mae_delta: maeDelta,
      bias_direction: current.overall_bias_direction,
      bias_flipped: biasFlipped,
    };
  } catch {
    return defaultSignal;
  }
}

// Re-export for convenience
export { computeVariance, fetchCalibrationModel } from "./confidence-cap.ts";

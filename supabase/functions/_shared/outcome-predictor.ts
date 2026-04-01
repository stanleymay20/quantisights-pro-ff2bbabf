/**
 * Outcome Predictor — Predictive scoring using historical decision-outcome pairs.
 * 
 * This is NOT an LLM call. It uses statistical analysis of similar past decisions
 * to predict success probability. This is genuine AI — learned from the org's own data.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface PredictionResult {
  predicted_success_probability: number;
  similar_decisions_count: number;
  similar_decisions_avg_outcome: number | null;
  similar_decisions_success_rate: number | null;
  confidence_factors: Array<{
    factor: string;
    direction: "positive" | "negative" | "neutral";
    weight: number;
    explanation: string;
  }>;
  model_version: number;
}

/**
 * Predict outcome success probability using historical decision-outcome data.
 * 
 * Methodology:
 * 1. Find decisions with measured outcomes in the same org
 * 2. Compute base rates (overall success rate)
 * 3. Adjust for confidence level, decision type, and calibration history
 * 4. Incorporate calibration model corrections if available
 * 
 * This is a frequentist + Bayesian hybrid approach — NOT an LLM call.
 */
export async function predictOutcome(
  supabaseUrl: string,
  serviceKey: string,
  orgId: string,
  decision: {
    recommended_action: string;
    decision_type: string;
    capped_confidence: number | null;
    predicted_net_impact: number | null;
  },
  similarDecisionIds: string[] = []
): Promise<PredictionResult> {
  const svc = createClient(supabaseUrl, serviceKey);
  const factors: PredictionResult["confidence_factors"] = [];

  // 1. Fetch all completed decisions with outcomes
  const { data: historicalDecisions } = await svc
    .from("decision_ledger")
    .select(
      "id, recommended_action, decision_type, capped_confidence, predicted_net_impact, " +
      "outcome_delta, prediction_accuracy_score, calibration_error, execution_status"
    )
    .eq("organization_id", orgId)
    .eq("execution_status", "completed")
    .not("outcome_delta", "is", null);

  const completed = historicalDecisions || [];

  if (completed.length < 3) {
    return {
      predicted_success_probability: 50, // uninformed prior
      similar_decisions_count: 0,
      similar_decisions_avg_outcome: null,
      similar_decisions_success_rate: null,
      confidence_factors: [
        {
          factor: "insufficient_history",
          direction: "neutral",
          weight: 0,
          explanation: `Only ${completed.length} completed decisions with outcomes. Need ≥3 for statistical prediction.`,
        },
      ],
      model_version: 1,
    };
  }

  // 2. Base rate: what % of past decisions had positive outcomes?
  const positiveOutcomes = completed.filter((d: any) => Number(d.outcome_delta) >= 0);
  const baseRate = positiveOutcomes.length / completed.length;

  factors.push({
    factor: "base_rate",
    direction: baseRate >= 0.6 ? "positive" : baseRate <= 0.4 ? "negative" : "neutral",
    weight: 0.3,
    explanation: `Org base rate: ${Math.round(baseRate * 100)}% positive outcomes across ${completed.length} decisions`,
  });

  // 3. Confidence calibration adjustment
  let confAdjustment = 0;
  if (decision.capped_confidence != null) {
    // Compare stated confidence to historical accuracy at similar confidence levels
    const similarConf = completed.filter(
      (d: any) =>
        d.capped_confidence != null &&
        Math.abs(Number(d.capped_confidence) - decision.capped_confidence!) < 15
    );

    if (similarConf.length >= 2) {
      const actualSuccessRate =
        similarConf.filter((d: any) => Number(d.outcome_delta) >= 0).length /
        similarConf.length;
      const statedConfRate = decision.capped_confidence / 100;
      confAdjustment = actualSuccessRate - statedConfRate;

      factors.push({
        factor: "confidence_calibration",
        direction: confAdjustment > 0.05 ? "positive" : confAdjustment < -0.05 ? "negative" : "neutral",
        weight: 0.25,
        explanation: `At ${decision.capped_confidence}% confidence, historical success rate is ${Math.round(actualSuccessRate * 100)}% (${confAdjustment > 0 ? "better" : "worse"} than stated confidence)`,
      });
    }
  }

  // 4. Decision type pattern matching
  const sameType = completed.filter(
    (d: any) => d.decision_type === decision.decision_type
  );
  let typeAdjustment = 0;
  if (sameType.length >= 2) {
    const typeSuccessRate =
      sameType.filter((d: any) => Number(d.outcome_delta) >= 0).length / sameType.length;
    typeAdjustment = typeSuccessRate - baseRate;

    factors.push({
      factor: "decision_type",
      direction: typeAdjustment > 0.05 ? "positive" : typeAdjustment < -0.05 ? "negative" : "neutral",
      weight: 0.2,
      explanation: `"${decision.decision_type}" decisions: ${Math.round(typeSuccessRate * 100)}% success rate (${sameType.length} decisions)`,
    });
  }

  // 5. Similar decisions (from vector search) outcome analysis
  let similarAdjustment = 0;
  let similarAvgOutcome: number | null = null;
  let similarSuccessRate: number | null = null;
  let similarCount = 0;

  if (similarDecisionIds.length > 0) {
    const similar = completed.filter((d: any) => similarDecisionIds.includes(d.id));
    similarCount = similar.length;

    if (similar.length >= 1) {
      similarAvgOutcome =
        similar.reduce((s: number, d: any) => s + Number(d.outcome_delta), 0) / similar.length;
      similarSuccessRate =
        similar.filter((d: any) => Number(d.outcome_delta) >= 0).length / similar.length;
      similarAdjustment = (similarSuccessRate || 0) - baseRate;

      factors.push({
        factor: "similar_decisions",
        direction: similarAdjustment > 0.05 ? "positive" : similarAdjustment < -0.05 ? "negative" : "neutral",
        weight: 0.25,
        explanation: `${similar.length} semantically similar past decisions: ${Math.round((similarSuccessRate || 0) * 100)}% success rate, avg outcome ${similarAvgOutcome > 0 ? "+" : ""}${similarAvgOutcome.toFixed(1)}%`,
      });
    }
  }

  // 6. Fetch calibration model for final correction
  const { data: calModels } = await svc
    .from("calibration_models")
    .select("band_corrections, overall_bias_direction")
    .eq("organization_id", orgId)
    .order("computed_at", { ascending: false })
    .limit(1);

  let calAdjustment = 0;
  if (calModels && calModels.length > 0 && decision.capped_confidence != null) {
    const cal = calModels[0] as any;
    const corrections = cal.band_corrections;
    if (corrections && typeof corrections === "object") {
      // Find the band that matches the confidence level
      const confBand = Math.floor(decision.capped_confidence / 10) * 10;
      const bandKey = `${confBand}-${confBand + 10}`;
      const correction = corrections[bandKey];
      if (typeof correction === "number") {
        calAdjustment = correction / 100;
        factors.push({
          factor: "calibration_correction",
          direction: calAdjustment > 0.02 ? "positive" : calAdjustment < -0.02 ? "negative" : "neutral",
          weight: 0.15,
          explanation: `Bayesian calibration model correction: ${calAdjustment > 0 ? "+" : ""}${Math.round(calAdjustment * 100)}pp for ${bandKey}% confidence band`,
        });
      }
    }
  }

  // 7. Combine all factors into final prediction
  // Weighted combination: base_rate(0.3) + conf_cal(0.25) + type(0.2) + similar(0.25) + cal_correction
  let predicted = baseRate;

  // Apply weighted adjustments
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  if (totalWeight > 0) {
    predicted = baseRate;
    if (confAdjustment !== 0) predicted += confAdjustment * 0.25;
    if (typeAdjustment !== 0) predicted += typeAdjustment * 0.2;
    if (similarAdjustment !== 0) predicted += similarAdjustment * 0.25;
    if (calAdjustment !== 0) predicted += calAdjustment * 0.15;
  }

  // Clamp to [5%, 95%] — never be absolutely certain
  predicted = Math.max(0.05, Math.min(0.95, predicted));

  return {
    predicted_success_probability: Math.round(predicted * 100),
    similar_decisions_count: similarCount,
    similar_decisions_avg_outcome: similarAvgOutcome,
    similar_decisions_success_rate: similarSuccessRate != null ? Math.round(similarSuccessRate * 100) : null,
    confidence_factors: factors,
    model_version: 1,
  };
}

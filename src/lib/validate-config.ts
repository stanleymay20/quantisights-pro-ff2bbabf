/**
 * Configuration Validation Service.
 * Validates all system-config parameters are within safe operational ranges.
 */

import { type SystemConfig, getSystemConfig } from "./system-config";

export interface ConfigError {
  field: string;
  value: number;
  message: string;
}

function checkRange(errors: ConfigError[], field: string, value: number, min: number, max: number) {
  if (!isFinite(value) || value < min || value > max) {
    errors.push({ field, value, message: `Must be between ${min} and ${max}` });
  }
}

export function validateSystemConfig(config?: SystemConfig): ConfigError[] {
  const cfg = config ?? getSystemConfig();
  const errors: ConfigError[] = [];

  // --- Cost of Delay ---
  const cod = cfg.costOfDelay;
  checkRange(errors, "VITE_COD_SEVERITY_CRITICAL", cod.severityWeights.critical, 0, 100);
  checkRange(errors, "VITE_COD_SEVERITY_HIGH", cod.severityWeights.high, 0, 100);
  checkRange(errors, "VITE_COD_SEVERITY_MEDIUM", cod.severityWeights.medium, 0, 100);
  checkRange(errors, "VITE_COD_SEVERITY_LOW", cod.severityWeights.low, 0, 100);
  checkRange(errors, "VITE_COD_CONFIDENCE_MAX", cod.confidenceContributionMax, 0, 50);
  checkRange(errors, "VITE_COD_AGE_DECAY_RATE", cod.ageDecayRate, 0, 5);
  checkRange(errors, "VITE_COD_AGE_DECAY_MAX", cod.ageDecayMax, 0, 50);
  checkRange(errors, "VITE_COD_SIGNAL_DELTA_MULT", cod.signalDeltaMultiplier, 0, 5);
  checkRange(errors, "VITE_COD_SIGNAL_DELTA_MAX", cod.signalDeltaMax, 0, 50);
  checkRange(errors, "VITE_COD_ENTITY_COUNT_MULT", cod.entityCountMultiplier, 0, 10);
  checkRange(errors, "VITE_COD_ENTITY_COUNT_MAX", cod.entityCountMax, 0, 30);
  checkRange(errors, "VITE_COD_TREND_ACCEL_BONUS", cod.trendAccelerationBonus, 0, 30);
  checkRange(errors, "VITE_COD_LABEL_CRITICAL", cod.labelThresholds.critical, 50, 100);
  checkRange(errors, "VITE_COD_LABEL_HIGH", cod.labelThresholds.high, 30, 90);
  checkRange(errors, "VITE_COD_LABEL_MEDIUM", cod.labelThresholds.medium, 10, 70);

  // Label thresholds must be ordered
  if (cod.labelThresholds.critical <= cod.labelThresholds.high) {
    errors.push({ field: "VITE_COD_LABEL_CRITICAL", value: cod.labelThresholds.critical, message: "Must be greater than VITE_COD_LABEL_HIGH" });
  }
  if (cod.labelThresholds.high <= cod.labelThresholds.medium) {
    errors.push({ field: "VITE_COD_LABEL_HIGH", value: cod.labelThresholds.high, message: "Must be greater than VITE_COD_LABEL_MEDIUM" });
  }

  // Action windows
  checkRange(errors, "VITE_COD_WINDOW_CRITICAL", cod.actionWindows.critical, 1, 14);
  checkRange(errors, "VITE_COD_WINDOW_HIGH", cod.actionWindows.high, 1, 30);
  checkRange(errors, "VITE_COD_WINDOW_MEDIUM", cod.actionWindows.medium, 1, 60);
  checkRange(errors, "VITE_COD_WINDOW_LOW", cod.actionWindows.low, 1, 90);

  // Metric urgency multipliers
  for (const [key, val] of Object.entries(cod.metricUrgency)) {
    checkRange(errors, `VITE_COD_URGENCY_${key.toUpperCase()}`, val, 0.1, 5);
  }

  // --- Decision Intelligence: VoI ---
  const voi = cfg.decisionIntelligence.voi;
  checkRange(errors, "VITE_VOI_UNCERTAINTY_REDUCTION", voi.uncertaintyReduction, 0.001, 1);
  checkRange(errors, "VITE_VOI_COST_PER_DATAPOINT", voi.costPerDataPointRatio, 0, 0.1);
  checkRange(errors, "VITE_VOI_SAMPLE_INFO_RATIO", voi.sampleInfoRatio, 0, 1);
  checkRange(errors, "VITE_VOI_DECIDE_NOW_CONF", voi.decideNowConfidence, 0.5, 1);

  // --- Decision Intelligence: Regret ---
  const regret = cfg.decisionIntelligence.regret;
  checkRange(errors, "VITE_REGRET_P10_FALLBACK", regret.p10FallbackMultiplier, -2, 2);
  checkRange(errors, "VITE_REGRET_P90_FALLBACK", regret.p90FallbackMultiplier, 0.5, 5);

  // --- Decision Intelligence: Velocity ---
  const vel = cfg.decisionIntelligence.velocity;
  checkRange(errors, "VITE_VELOCITY_IMPROVING", vel.improvingThreshold, 0.1, 1);
  checkRange(errors, "VITE_VELOCITY_DEGRADING", vel.degradingThreshold, 1, 3);
  checkRange(errors, "VITE_VELOCITY_SLOW_WARN_DAYS", vel.slowWarningDays, 1, 30);
  checkRange(errors, "VITE_VELOCITY_MIN_DECISIONS", vel.minDecisionsForTrend, 2, 20);

  // --- Decision Intelligence: Portfolio Risk ---
  const pr = cfg.decisionIntelligence.portfolioRisk;
  checkRange(errors, "VITE_PORTFOLIO_VAR_CONF", pr.varConfidenceLevel, 1, 4);
  checkRange(errors, "VITE_PORTFOLIO_HIGH_CORR", pr.highCorrelationThreshold, 0.1, 1);
  checkRange(errors, "VITE_PORTFOLIO_HIGH_CONC", pr.highConcentrationThreshold, 10, 100);

  // --- Convergence ---
  const conv = cfg.convergence;
  checkRange(errors, "VITE_CONV_VOL_DIV_THRESHOLD", conv.volatilityDivergenceThreshold, 5, 100);
  checkRange(errors, "VITE_CONV_VOL_DIV_PENALTY", conv.volatilityDivergencePenalty, 0, 50);
  checkRange(errors, "VITE_CONV_ALIGNED", conv.alignmentThresholds.aligned, 50, 100);
  checkRange(errors, "VITE_CONV_TENSION", conv.alignmentThresholds.tension, 30, 90);
  checkRange(errors, "VITE_CONV_MISALIGNMENT", conv.alignmentThresholds.misalignment, 10, 70);

  // Convergence thresholds must be ordered
  if (conv.alignmentThresholds.aligned <= conv.alignmentThresholds.tension) {
    errors.push({ field: "VITE_CONV_ALIGNED", value: conv.alignmentThresholds.aligned, message: "Must be greater than VITE_CONV_TENSION" });
  }
  if (conv.alignmentThresholds.tension <= conv.alignmentThresholds.misalignment) {
    errors.push({ field: "VITE_CONV_TENSION", value: conv.alignmentThresholds.tension, message: "Must be greater than VITE_CONV_MISALIGNMENT" });
  }

  return errors;
}

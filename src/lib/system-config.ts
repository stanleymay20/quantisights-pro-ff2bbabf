// Dynamic configuration service for tier limits and thresholds
// This allows runtime configuration changes without code deployment

export interface TierConfig {
  simulations: number;
  convergence: number;
  copilot: number;
  seats: number;
  kpiComputations: number;
}

export interface SystemConfig {
  tiers: {
    starter: TierConfig;
    growth: TierConfig;
    enterprise: TierConfig;
  };
  confidence: {
    smallSampleCeiling: number;
    mediumSampleCeiling: number;
    largeSampleCeiling: number;
    smallSampleThreshold: number;
    mediumSampleThreshold: number;
  };
  causal: {
    significanceThreshold: number;
  };
  costOfDelay: {
    severityWeights: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    metricUrgency: {
      churn: number;
      retention: number;
      revenue: number;
      cost: number;
      margin: number;
      growth: number;
    };
    scoreThresholds: {
      critical: number;
      high: number;
      medium: number;
    };
  };
  decisionIntelligence: {
    voi: {
      uncertaintyReduction: number;
      costPerDataPointMultiplier: number;
      sampleInfoEfficiency: number;
      decideNowConfidenceThreshold: number;
    };
    regret: {
      p10FallbackMultiplier: number;
      p90FallbackMultiplier: number;
    };
    decisionVelocity: {
      improvingThreshold: number;
      degradingThreshold: number;
    };
    portfolio: {
      varConfidenceLevel: number;
    };
  };
  convergence: {
    volatilityDivergenceThreshold: number;
    alignmentThresholds: {
      aligned: number;
      tension: number;
      misalignment: number;
    };
    executiveRiskThresholds: {
      cmoLowRiskMax: number;
      cooHighRiskMin: number;
      cfoHighRiskMin: number;
      ceoLowRiskMax: number;
    };
  };
}

// Default configuration - can be overridden by environment or database
const DEFAULT_CONFIG: SystemConfig = {
  tiers: {
    starter: {
      simulations: parseInt(import.meta.env.VITE_TIER_STARTER_SIMULATIONS || "5"),
      convergence: parseInt(import.meta.env.VITE_TIER_STARTER_CONVERGENCE || "3"),
      copilot: parseInt(import.meta.env.VITE_TIER_STARTER_COPILOT || "10"),
      seats: parseInt(import.meta.env.VITE_TIER_STARTER_SEATS || "2"),
      kpiComputations: parseInt(import.meta.env.VITE_TIER_STARTER_KPI || "3"),
    },
    growth: {
      simulations: parseInt(import.meta.env.VITE_TIER_GROWTH_SIMULATIONS || "50"),
      convergence: parseInt(import.meta.env.VITE_TIER_GROWTH_CONVERGENCE || "30"),
      copilot: parseInt(import.meta.env.VITE_TIER_GROWTH_COPILOT || "100"),
      seats: parseInt(import.meta.env.VITE_TIER_GROWTH_SEATS || "5"),
      kpiComputations: parseInt(import.meta.env.VITE_TIER_GROWTH_KPI || "25"),
    },
    enterprise: {
      simulations: parseInt(import.meta.env.VITE_TIER_ENTERPRISE_SIMULATIONS || "-1"),
      convergence: parseInt(import.meta.env.VITE_TIER_ENTERPRISE_CONVERGENCE || "-1"),
      copilot: parseInt(import.meta.env.VITE_TIER_ENTERPRISE_COPILOT || "-1"),
      seats: parseInt(import.meta.env.VITE_TIER_ENTERPRISE_SEATS || "-1"),
      kpiComputations: parseInt(import.meta.env.VITE_TIER_ENTERPRISE_KPI || "999999"),
    },
  },
  confidence: {
    smallSampleCeiling: parseInt(import.meta.env.VITE_CONFIDENCE_CEILING_SMALL || "60"),
    mediumSampleCeiling: parseInt(import.meta.env.VITE_CONFIDENCE_CEILING_MEDIUM || "75"),
    largeSampleCeiling: parseInt(import.meta.env.VITE_CONFIDENCE_CEILING_LARGE || "90"),
    smallSampleThreshold: parseInt(import.meta.env.VITE_SAMPLE_THRESHOLD_SMALL || "12"),
    mediumSampleThreshold: parseInt(import.meta.env.VITE_SAMPLE_THRESHOLD_MEDIUM || "30"),
  },
  causal: {
    significanceThreshold: parseFloat(import.meta.env.VITE_CAUSAL_THRESHOLD || "0.3"),
  },
  costOfDelay: {
    severityWeights: {
      critical: parseInt(import.meta.env.VITE_COST_OF_DELAY_SEVERITY_CRITICAL || "40"),
      high: parseInt(import.meta.env.VITE_COST_OF_DELAY_SEVERITY_HIGH || "28"),
      medium: parseInt(import.meta.env.VITE_COST_OF_DELAY_SEVERITY_MEDIUM || "16"),
      low: parseInt(import.meta.env.VITE_COST_OF_DELAY_SEVERITY_LOW || "6"),
    },
    metricUrgency: {
      churn: parseFloat(import.meta.env.VITE_COST_OF_DELAY_METRIC_CHURN || "1.3"),
      retention: parseFloat(import.meta.env.VITE_COST_OF_DELAY_METRIC_RETENTION || "1.3"),
      revenue: parseFloat(import.meta.env.VITE_COST_OF_DELAY_METRIC_REVENUE || "1.2"),
      cost: parseFloat(import.meta.env.VITE_COST_OF_DELAY_METRIC_COST || "1.1"),
      margin: parseFloat(import.meta.env.VITE_COST_OF_DELAY_METRIC_MARGIN || "1.15"),
      growth: parseFloat(import.meta.env.VITE_COST_OF_DELAY_METRIC_GROWTH || "1.05"),
    },
    scoreThresholds: {
      critical: parseInt(import.meta.env.VITE_COST_OF_DELAY_SCORE_CRITICAL_MIN || "80"),
      high: parseInt(import.meta.env.VITE_COST_OF_DELAY_SCORE_HIGH_MIN || "55"),
      medium: parseInt(import.meta.env.VITE_COST_OF_DELAY_SCORE_MEDIUM_MIN || "30"),
    },
  },
  decisionIntelligence: {
    voi: {
      uncertaintyReduction: parseFloat(import.meta.env.VITE_VOI_UNCERTAINTY_REDUCTION || "0.03"),
      costPerDataPointMultiplier: parseFloat(import.meta.env.VITE_VOI_COST_PER_DATA_POINT_MULTIPLIER || "0.001"),
      sampleInfoEfficiency: parseFloat(import.meta.env.VITE_VOI_SAMPLE_INFO_EFFICIENCY || "0.6"),
      decideNowConfidenceThreshold: parseFloat(import.meta.env.VITE_VOI_DECIDE_NOW_CONFIDENCE_THRESHOLD || "0.75"),
    },
    regret: {
      p10FallbackMultiplier: parseFloat(import.meta.env.VITE_REGRET_P10_FALLBACK_MULTIPLIER || "0.3"),
      p90FallbackMultiplier: parseFloat(import.meta.env.VITE_REGRET_P90_FALLBACK_MULTIPLIER || "1.5"),
    },
    decisionVelocity: {
      improvingThreshold: parseFloat(import.meta.env.VITE_DECISION_VELOCITY_IMPROVING_THRESHOLD || "0.85"),
      degradingThreshold: parseFloat(import.meta.env.VITE_DECISION_VELOCITY_DEGRADING_THRESHOLD || "1.15"),
    },
    portfolio: {
      varConfidenceLevel: parseFloat(import.meta.env.VITE_PORTFOLIO_VAR_CONFIDENCE_LEVEL || "1.645"),
    },
  },
  convergence: {
    volatilityDivergenceThreshold: parseInt(import.meta.env.VITE_CONVERGENCE_VOLATILITY_DIVERGENCE_THRESHOLD || "35"),
    alignmentThresholds: {
      aligned: parseInt(import.meta.env.VITE_CONVERGENCE_ALIGNMENT_ALIGNED_MIN || "80"),
      tension: parseInt(import.meta.env.VITE_CONVERGENCE_ALIGNMENT_TENSION_MIN || "60"),
      misalignment: parseInt(import.meta.env.VITE_CONVERGENCE_ALIGNMENT_MISALIGNMENT_MIN || "40"),
    },
    executiveRiskThresholds: {
      cmoLowRiskMax: parseInt(import.meta.env.VITE_EXECUTIVE_CONVERGENCE_CMO_LOW_RISK_MAX || "40"),
      cooHighRiskMin: parseInt(import.meta.env.VITE_EXECUTIVE_CONVERGENCE_COO_HIGH_RISK_MIN || "70"),
      cfoHighRiskMin: parseInt(import.meta.env.VITE_EXECUTIVE_CONVERGENCE_CFO_HIGH_RISK_MIN || "75"),
      ceoLowRiskMax: parseInt(import.meta.env.VITE_EXECUTIVE_CONVERGENCE_CEO_LOW_RISK_MAX || "50"),
    },
  },
};

// Runtime configuration storage
let runtimeConfig: SystemConfig = { ...DEFAULT_CONFIG };

export function getSystemConfig(): SystemConfig {
  return runtimeConfig;
}

export function updateSystemConfig(updates: Partial<SystemConfig>): void {
  runtimeConfig = { ...runtimeConfig, ...updates };
}

export function getTierLimits(tier: keyof SystemConfig['tiers']): TierConfig {
  return runtimeConfig.tiers[tier];
}

export function getConfidenceConfig() {
  return runtimeConfig.confidence;
}

export function getCausalConfig() {
  return runtimeConfig.causal;
}

export function getCostOfDelayConfig() {
  return runtimeConfig.costOfDelay;
}

export function getDecisionIntelligenceConfig() {
  return runtimeConfig.decisionIntelligence;
}

export function getConvergenceConfig() {
  return runtimeConfig.convergence;
}

// Utility functions for common operations
export function isUnlimited(value: number): boolean {
  return value === -1;
}

export function getEffectiveLimit(tier: keyof SystemConfig['tiers'], feature: keyof TierConfig): number {
  const limit = runtimeConfig.tiers[tier][feature];
  return isUnlimited(limit) ? Number.MAX_SAFE_INTEGER : limit;
}
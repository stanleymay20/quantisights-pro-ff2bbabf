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

// Utility functions for common operations
export function isUnlimited(value: number): boolean {
  return value === -1;
}

export function getEffectiveLimit(tier: keyof SystemConfig['tiers'], feature: keyof TierConfig): number {
  const limit = runtimeConfig.tiers[tier][feature];
  return isUnlimited(limit) ? Number.MAX_SAFE_INTEGER : limit;
}
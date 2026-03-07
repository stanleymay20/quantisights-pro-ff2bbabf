// Tier configuration - now dynamically configurable
// This file provides backward compatibility and default values
// Actual configuration is managed through system-config.ts

import { getTierLimits, TierConfig } from './system-config';

// Legacy interface for backward compatibility
export const TIER_LIMITS = {
  starter: getTierLimits('starter'),
  growth: getTierLimits('growth'),
  enterprise: getTierLimits('enterprise'),
} as const;

export type TierLimits = typeof TIER_LIMITS;
export type TierKey = keyof TierLimits;
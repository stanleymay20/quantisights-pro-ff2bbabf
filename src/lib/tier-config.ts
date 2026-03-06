// Tier configuration - should be moved to database for dynamic updates
export const TIER_LIMITS = {
  starter: {
    simulations: 5,
    convergence: 3,
    copilot: 10,
    seats: 2,
    kpiComputations: 3,
  },
  growth: {
    simulations: 50,
    convergence: 30,
    copilot: 100,
    seats: 5,
    kpiComputations: 25,
  },
  enterprise: {
    simulations: -1, // unlimited
    convergence: -1,
    copilot: -1,
    seats: -1,
    kpiComputations: 999999,
  },
} as const;

export type TierLimits = typeof TIER_LIMITS;
export type TierKey = keyof TierLimits;
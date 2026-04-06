import { useSubscription } from "@/hooks/useSubscription";
import { TierKey } from "@/lib/stripe-tiers";

/**
 * Feature → tier access matrix.
 * If a feature is NOT listed here, it's available to all tiers.
 */
const FEATURE_TIERS: Record<string, TierKey[]> = {
  // Growth + Enterprise
  simulations: ["growth", "enterprise"],
  convergence: ["growth", "enterprise"],
  boardExport: ["growth", "enterprise"],
  advisory: ["growth", "enterprise"],
  copilot: ["growth", "enterprise"],
  livestream: ["growth", "enterprise"],
  forecasting: ["growth", "enterprise"],
  anomalyDetection: ["growth", "enterprise"],
  causalInference: ["growth", "enterprise"],
  decisionLedger: ["growth", "enterprise"],
  benchmarking: ["growth", "enterprise"],
  alertPlaybooks: ["growth", "enterprise"],
  okrAlignment: ["growth", "enterprise"],
  apiIntegrations: ["growth", "enterprise"],
  // Enterprise only
  sso: ["enterprise"],
  biasDetection: ["enterprise"],
  counterfactual: ["enterprise"],
  executiveConvergence: ["enterprise"],
  commandCenter: ["enterprise"],
  scenarioBranching: ["enterprise"],
  dataLineage: ["enterprise"],
  marketIntelligence: ["enterprise"],
  multiOrg: ["enterprise"],
};

export const useSubscriptionGate = () => {
  const { subscribed, tier, loading } = useSubscription();

  const canAccess = (feature: keyof typeof FEATURE_TIERS): boolean => {
    if (loading) return false;
    if (!subscribed || !tier) return false;
    const allowed = FEATURE_TIERS[feature];
    if (!allowed) return true;
    return allowed.includes(tier);
  };

  const isExpired = !loading && !subscribed;

  return { canAccess, isExpired, tier, loading, subscribed };
};

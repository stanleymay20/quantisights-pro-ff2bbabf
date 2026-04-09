import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
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
  const { user } = useAuth();

  // Demo users bypass all subscription gates
  const isDemoUser = Boolean(user?.user_metadata?.is_demo);

  const canAccess = (feature: keyof typeof FEATURE_TIERS): boolean => {
    if (isDemoUser) return true;
    if (loading) return false;
    if (!subscribed || !tier) return false;
    const allowed = FEATURE_TIERS[feature];
    if (!allowed) return true;
    return allowed.includes(tier);
  };

  const isExpired = !loading && !subscribed && !isDemoUser;

  return { canAccess, isExpired, tier, loading, subscribed, isDemoUser };
};

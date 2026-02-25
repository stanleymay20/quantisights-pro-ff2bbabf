import { useSubscription } from "@/hooks/useSubscription";
import { TierKey } from "@/lib/stripe-tiers";

const FEATURE_TIERS: Record<string, TierKey[]> = {
  simulations: ["growth", "enterprise"],
  convergence: ["growth", "enterprise"],
  boardExport: ["growth", "enterprise"],
  advisory: ["growth", "enterprise"],
  copilot: ["growth", "enterprise"],
  sso: ["enterprise"],
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

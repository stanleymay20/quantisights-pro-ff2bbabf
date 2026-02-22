import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getTierByProductId, TierKey } from "@/lib/stripe-tiers";

interface SubscriptionState {
  subscribed: boolean;
  tier: TierKey | null;
  subscriptionEnd: string | null;
  loading: boolean;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    subscribed: false,
    tier: null,
    subscriptionEnd: null,
    loading: true,
  });

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setState({ subscribed: false, tier: null, subscriptionEnd: null, loading: false });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;

      setState({
        subscribed: data.subscribed,
        tier: getTierByProductId(data.product_id),
        subscriptionEnd: data.subscription_end,
        loading: false,
      });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  return { ...state, refresh: checkSubscription };
};

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { TierKey } from "@/lib/stripe-tiers";

interface SubscriptionState {
  subscribed: boolean;
  tier: TierKey | null;
  subscriptionEnd: string | null;
  isTrial: boolean;
  trialEnd: string | null;
  inGracePeriod: boolean;
  gracePeriodEnd: string | null;
  paymentFailed: boolean;
  billingInterval: "month" | "year" | null;
  loading: boolean;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const { currentOrgId } = useOrganization();
  const [state, setState] = useState<SubscriptionState>({
    subscribed: false,
    tier: null,
    subscriptionEnd: null,
    isTrial: false,
    trialEnd: null,
    loading: true,
  });

  const checkSubscription = useCallback(async () => {
    if (!user || !currentOrgId) {
      setState({ subscribed: false, tier: null, subscriptionEnd: null, isTrial: false, trialEnd: null, loading: false });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("tier, status, current_period_end, is_trial, trial_end")
        .eq("organization_id", currentOrgId)
        .in("status", ["active", "trialing"])
        .maybeSingle();

      if (error) throw error;

      setState({
        subscribed: !!data,
        tier: (data?.tier as TierKey) ?? null,
        subscriptionEnd: data?.current_period_end ?? null,
        isTrial: data?.is_trial ?? false,
        trialEnd: data?.trial_end ?? null,
        loading: false,
      });
    } catch (err) {
      console.error("[useSubscription] Failed to check subscription:", err instanceof Error ? err.message : err);
      setState((s) => ({ ...s, loading: false }));
    }
  }, [user, currentOrgId]);

  useEffect(() => {
    checkSubscription();

    // Listen for realtime changes
    if (!currentOrgId) return;
    const channel = supabase
      .channel(`sub-${currentOrgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `organization_id=eq.${currentOrgId}` },
        () => checkSubscription()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [checkSubscription, currentOrgId]);

  return { ...state, refresh: checkSubscription };
};

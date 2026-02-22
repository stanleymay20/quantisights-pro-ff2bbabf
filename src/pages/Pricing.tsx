import { motion } from "framer-motion";
import { Check, Loader2, Crown } from "lucide-react";
import { TIERS, TierKey } from "@/lib/stripe-tiers";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const Pricing = () => {
  const { user } = useAuth();
  const { tier: currentTier, subscribed } = useSubscription();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<TierKey | null>(null);

  const handleCheckout = async (tierKey: TierKey) => {
    if (!user) {
      navigate("/login");
      return;
    }

    setLoadingTier(tierKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: TIERS[tierKey].price_id },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    } finally {
      setLoadingTier(null);
    }
  };

  const handleManage = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Could not open portal", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-32 pb-24">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl font-bold font-display mb-4">
              Simple, Transparent <span className="gradient-text">Pricing</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Choose the plan that scales with your business intelligence needs.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {(Object.entries(TIERS) as [TierKey, (typeof TIERS)[TierKey]][]).map(
              ([key, tier], i) => {
                const isActive = subscribed && currentTier === key;
                const isPopular = "popular" in tier && tier.popular;

                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`glass-card p-8 flex flex-col relative ${
                      isPopular ? "border-primary/40 shadow-lg shadow-primary/10" : ""
                    } ${isActive ? "ring-2 ring-primary" : ""}`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                        Most Popular
                      </div>
                    )}
                    {isActive && (
                      <div className="absolute -top-3 right-4 px-3 py-1 rounded-full bg-success/20 text-success text-xs font-semibold flex items-center gap-1">
                        <Crown className="w-3 h-3" /> Your Plan
                      </div>
                    )}

                    <h3 className="text-xl font-semibold font-display mb-2">{tier.name}</h3>
                    <div className="mb-6">
                      <span className="text-4xl font-bold font-display">{tier.currency}{tier.price}</span>
                      <span className="text-muted-foreground text-sm">/{tier.interval}</span>
                    </div>

                    <ul className="space-y-3 mb-8 flex-1">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{f}</span>
                        </li>
                      ))}
                    </ul>

                    {isActive ? (
                      <button
                        onClick={handleManage}
                        className="w-full py-3 rounded-lg border border-border text-sm font-semibold hover:bg-secondary transition-colors"
                      >
                        Manage Subscription
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCheckout(key)}
                        disabled={loadingTier === key}
                        className={`w-full py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 ${
                          isPopular
                            ? "bg-primary text-primary-foreground hover:brightness-110"
                            : "border border-border hover:bg-secondary"
                        }`}
                      >
                        {loadingTier === key ? (
                          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                        ) : subscribed ? (
                          "Switch Plan"
                        ) : (
                          "Get Started"
                        )}
                      </button>
                    )}
                  </motion.div>
                );
              }
            )}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Pricing;

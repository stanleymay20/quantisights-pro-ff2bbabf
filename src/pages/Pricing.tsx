import { motion } from "framer-motion";
import { Check, Loader2, Crown, X, Minus } from "lucide-react";
import { TIERS, TierKey, FEATURE_MATRIX } from "@/lib/stripe-tiers";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ComparisonSection from "@/components/landing/ComparisonSection";

const CellValue = ({ value }: { value: boolean | string }) => {
  if (value === true) return <Check className="w-4 h-4 text-primary mx-auto" />;
  if (value === false) return <Minus className="w-4 h-4 text-muted-foreground/30 mx-auto" />;
  return <span className="text-sm font-medium text-foreground">{value}</span>;
};

const Pricing = () => {
  const { user } = useAuth();
  const { tier: currentTier, subscribed } = useSubscription();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<TierKey | null>(null);

  const handleCheckout = async (tierKey: TierKey) => {
    if (!user) { navigate("/login"); return; }
    setLoadingTier(tierKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: TIERS[tierKey].price_id },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
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
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Could not open portal", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Pricing</p>
            <h1 className="text-5xl font-bold font-display mb-4">
              Intelligence That <span className="gradient-text">Scales</span> With You
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              From first dataset to enterprise-wide decision intelligence. Every plan includes full data traceability and GDPR compliance.
            </p>
          </motion.div>

          {/* Tier Cards */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10">
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

                    <h3 className="text-xl font-semibold font-display mb-1">{tier.name}</h3>
                    {"tagline" in tier && (
                      <p className="text-xs text-muted-foreground mb-4">{tier.tagline}</p>
                    )}
                    <div className="mb-6">
                      {tier.price !== null ? (
                        <>
                          <span className="text-4xl font-bold font-display">{tier.currency}{tier.price}</span>
                          <span className="text-muted-foreground text-sm">/{tier.interval}</span>
                        </>
                      ) : (
                        <span className="text-3xl font-bold font-display">Custom</span>
                      )}
                    </div>

                    <ul className="space-y-2.5 mb-8 flex-1">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{f}</span>
                        </li>
                      ))}
                    </ul>

                    {"contactSales" in tier && tier.contactSales ? (
                      <a
                        href="mailto:hello@quantivis.io"
                        className="w-full py-3 rounded-lg border border-border text-sm font-semibold hover:bg-secondary transition-colors text-center block"
                      >
                        Contact Sales
                      </a>
                    ) : isActive ? (
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
                          "Start 14-Day Free Trial"
                        )}
                      </button>
                    )}
                  </motion.div>
                );
              }
            )}
          </div>

          {/* Price Anchoring Banner */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="max-w-5xl mx-auto mb-16 text-center"
          >
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-border/50 bg-card/30">
              <span className="text-sm text-muted-foreground">Typical consulting engagement:</span>
              <span className="text-sm font-bold line-through text-muted-foreground/60">€50,000+</span>
              <span className="text-xs text-muted-foreground">→</span>
              <span className="text-sm font-bold text-primary">From €99/mo</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">500x less</span>
            </div>
          </motion.div>

          {/* Competitive Comparison — directly below pricing */}
          <ComparisonSection inline />

          {/* Full Feature Comparison Matrix */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto mt-16"
          >
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold font-display mb-3">
                Complete <span className="gradient-text">Feature Comparison</span>
              </h2>
              <p className="text-muted-foreground">Every capability across every tier — no hidden features.</p>
            </div>

            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-4 px-6 text-muted-foreground font-medium w-[40%]">Feature</th>
                      {(Object.entries(TIERS) as [TierKey, (typeof TIERS)[TierKey]][]).map(([key, t]) => (
                        <th key={key} className={`text-center py-4 px-4 font-semibold ${key === currentTier && subscribed ? "text-primary" : ""}`}>
                          <div>{t.name}</div>
                          <div className="text-xs font-normal text-muted-foreground mt-0.5">
                            {t.price !== null ? `${t.currency}${t.price}/${t.interval}` : "Custom"}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FEATURE_MATRIX.map((group) => (
                      <>
                        <tr key={group.category}>
                          <td colSpan={4} className="py-3 px-6 text-xs uppercase tracking-widest text-primary font-semibold bg-primary/[0.03] border-b border-border/50">
                            {group.category}
                          </td>
                        </tr>
                        {group.features.map((row) => (
                          <tr key={row.label} className="border-b border-border/30 hover:bg-card/50 transition-colors">
                            <td className="py-3 px-6 font-medium">{row.label}</td>
                            <td className="text-center py-3 px-4"><CellValue value={row.starter} /></td>
                            <td className="text-center py-3 px-4"><CellValue value={row.growth} /></td>
                            <td className="text-center py-3 px-4"><CellValue value={row.enterprise} /></td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="container mx-auto px-6 text-center">
          <p className="text-xs text-muted-foreground">
            All plans include a 14-day free trial · GDPR compliance · SOC 2 Type II in progress · Data encryption at rest & in transit
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Pricing;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  { label: "Creating demo account", duration: 1500 },
  { label: "Provisioning Acme Corp environment", duration: 2000 },
  { label: "Seeding 15 months of intelligence data", duration: 2000 },
  { label: "Generating insights & advisories", duration: 1000 },
  { label: "Launching dashboard", duration: 800 },
];

const Demo = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const initDemo = async () => {
      try {
        // Sign out any existing session
        await supabase.auth.signOut();
        // Clear any stale tour/welcome flags so demo users see the guided experience
        localStorage.removeItem("quantivis_tour_completed");
        localStorage.removeItem("quantivis_welcome_completed");

        if (cancelled) return;
        setCurrentStep(1);

        const { data, error: fnErr } = await supabase.functions.invoke("create-demo-session");

        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);

        if (cancelled) return;
        setCurrentStep(2);
        await new Promise(r => setTimeout(r, 600));

        if (cancelled) return;
        setCurrentStep(3);

        // Set the session from the returned tokens
        const { error: sessErr } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (sessErr) throw sessErr;

        if (cancelled) return;
        setCurrentStep(4);
        await new Promise(r => setTimeout(r, 800));

        navigate("/dashboard", { replace: true });
      } catch (err: any) {
        if (!cancelled) {
          console.error("Demo init error:", err);
          setError(err.message || "Failed to create demo session");
        }
      }
    };

    initDemo();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Brain className="w-8 h-8 text-primary" />
        </div>

        {error ? (
          <>
            <div className="flex items-center justify-center gap-2 text-destructive mb-3">
              <AlertCircle className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Demo Error</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:brightness-110 transition-all"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate("/")}
              className="block mx-auto mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to home
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold font-display mb-1">Setting Up Your Demo</h2>
            <p className="text-xs text-muted-foreground mb-8">
              Creating a fully populated intelligence environment
            </p>

            {/* Step progress */}
            <div className="space-y-2.5 text-left mb-8">
              {STEPS.map((step, i) => {
                const isComplete = i < currentStep;
                const isCurrent = i === currentStep;

                return (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: i <= currentStep ? 1 : 0.35, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                      <AnimatePresence mode="wait">
                        {isComplete ? (
                          <motion.div
                            key="check"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="text-primary"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </motion.div>
                        ) : isCurrent ? (
                          <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
                        )}
                      </AnimatePresence>
                    </div>
                    <span className={`text-sm ${isCurrent ? "text-foreground font-medium" : isComplete ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                      {step.label}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            {/* Company info */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Acme Corp</span> — B2B SaaS, $850K+ revenue, 420 customers, 6 metric types, 5 decisions, 3 advisories, executive briefs.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Demo;

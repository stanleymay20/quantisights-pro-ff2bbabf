import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Loader2, AlertCircle, CheckCircle2, Shield, BarChart3, Zap, Target } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  { label: "Authenticating secure session", icon: Shield },
  { label: "Provisioning Acme Corp workspace (B2B SaaS · €4.2M ARR)", icon: BarChart3 },
  { label: "Ingesting 15 months of revenue + conversion data", icon: Zap },
  { label: "Running diagnostic & advisory engines", icon: Brain },
  { label: "Initializing executive dashboard", icon: Target },
];

const TIMEOUT_MS = 20_000;

const Demo = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Safety timeout — if provisioning hangs, show error with retry
    const timeout = setTimeout(() => {
      if (!cancelled && currentStep < STEPS.length - 1) {
        setError("Provisioning is taking longer than expected. Please retry or contact support.");
      }
    }, TIMEOUT_MS);

    const initDemo = async () => {
      try {
        await supabase.auth.signOut();

        sessionStorage.setItem("quantivis_demo_mode", "true");
        sessionStorage.removeItem("quantivis_org_id");
        sessionStorage.removeItem("quantivis_workspace_id");
        sessionStorage.removeItem("quantivis_project_id");

        localStorage.setItem("quantivis_welcome_completed", "true");
        localStorage.setItem("quantivis_cookie_consent", JSON.stringify({ choice: "accepted", timestamp: new Date().toISOString() }));

        if (cancelled) return;
        setCurrentStep(1);

        const { data, error: fnErr } = await supabase.functions.invoke("create-demo-session");

        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);

        if (cancelled) return;
        setCurrentStep(2);
        await new Promise(r => setTimeout(r, 500));

        if (cancelled) return;
        setCurrentStep(3);

        if (data.org_id) sessionStorage.setItem("quantivis_org_id", data.org_id);
        if (data.workspace_id) sessionStorage.setItem("quantivis_workspace_id", data.workspace_id);
        if (data.project_id) sessionStorage.setItem("quantivis_project_id", data.project_id);

        const { error: sessErr } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (sessErr) throw sessErr;

        if (cancelled) return;
        setCurrentStep(4);
        await new Promise(r => setTimeout(r, 600));

        navigate("/dashboard", { replace: true });
      } catch (err: any) {
        sessionStorage.removeItem("quantivis_demo_mode");
        if (!cancelled) {
          console.error("Demo init error:", err);
          setError(err.message || "Failed to create demo session");
        }
      }
    };

    initDemo();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [navigate]);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-lg px-6">
        {/* Logo mark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-8"
        >
          <Brain className="w-8 h-8 text-primary" />
        </motion.div>

        {error ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-center gap-2 text-destructive mb-3">
              <AlertCircle className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Provisioning Failed</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:brightness-110 transition-all"
            >
              Retry
            </button>
            <button
              onClick={() => navigate("/")}
              className="block mx-auto mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to home
            </button>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <h2 className="text-xl font-bold font-display mb-1 tracking-tight">
              Provisioning Your Environment
            </h2>
            <p className="text-xs text-muted-foreground mb-8">
              Setting up a fully populated decision intelligence workspace
            </p>

            {/* Progress bar */}
            <div className="h-1 rounded-full bg-muted mb-8 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
            </div>

            {/* Step list */}
            <div className="space-y-1.5 text-left mb-8">
              {STEPS.map((step, i) => {
                const isComplete = i < currentStep;
                const isCurrent = i === currentStep;
                const StepIcon = step.icon;

                return (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: i <= currentStep ? 1 : 0.3, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isCurrent ? "bg-primary/[0.06]" : ""}`}
                  >
                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                      <AnimatePresence mode="wait">
                        {isComplete ? (
                          <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-primary">
                            <CheckCircle2 className="w-4 h-4" />
                          </motion.div>
                        ) : isCurrent ? (
                          <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        ) : (
                          <StepIcon className="w-3.5 h-3.5 text-muted-foreground/30" />
                        )}
                      </AnimatePresence>
                    </div>
                    <span className={`text-sm ${isCurrent ? "text-foreground font-medium" : isComplete ? "text-muted-foreground" : "text-muted-foreground/40"}`}>
                      {step.label}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            {/* Environment info card */}
            <div className="p-4 rounded-xl bg-card/60 border border-border/40">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-semibold text-foreground">Acme Corp · B2B SaaS</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                $850K+ revenue · 420 customers · 6 metric types · 5 decisions · 3 advisories · executive briefs
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Demo;

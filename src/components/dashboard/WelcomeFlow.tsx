import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Zap, TrendingUp, ArrowRight, CheckCircle2,
  FileSpreadsheet, Shield, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const WELCOME_KEY = "quantivis_welcome_completed";

interface WelcomeFlowProps {
  hasData: boolean;
  displayName: string;
}

const STEPS = [
  {
    icon: FileSpreadsheet,
    title: "Get Started in 60 Seconds",
    subtitle: "Choose your path",
    description:
      "Load our pre-built demo with 15 months of B2B SaaS data to see the platform in action — or upload your own CSV to start building your decision ledger.",
    cta: "Try with Sample Data",
    ctaPath: "/demo",
    secondaryCta: "Upload My Data",
    secondaryPath: "/data-upload",
    tip: "The demo includes metrics, decisions, insights, advisories, and executive briefs — fully populated.",
  },
  {
    icon: Zap,
    title: "Intelligence Activates Automatically",
    subtitle: "Zero configuration needed",
    description:
      "Once data is loaded, our engine runs diagnostics, detects anomalies, surfaces root causes, and generates actionable recommendations — all automatically.",
    bullets: [
      "Anomaly detection across every metric",
      "Root cause analysis with confidence scores",
      "Strategic recommendations ranked by impact",
    ],
  },
  {
    icon: Shield,
    title: "Make Board-Defensible Decisions",
    subtitle: "Every decision creates an audit trail",
    description:
      "Log decisions, track outcomes, and build institutional memory. Over time, the platform calibrates to your judgment patterns and makes you more precise.",
    bullets: [
      "Decision ledger with full traceability",
      "Outcome tracking and accuracy scoring",
      "Calibration engine reduces overconfidence",
    ],
  },
];

const WelcomeFlow = ({ hasData, displayName }: WelcomeFlowProps) => {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (hasData) return; // Don't show if they already have data
    const completed = localStorage.getItem(WELCOME_KEY);
    if (!completed) {
      const timer = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(timer);
    }
  }, [hasData]);

  const handleComplete = () => {
    localStorage.setItem(WELCOME_KEY, "true");
    setVisible(false);
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleCTA = (path: string) => {
    handleComplete();
    navigate(path);
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-lg bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Progress */}
            <div className="h-1 bg-muted">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: `${(step / STEPS.length) * 100}%` }}
                animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>

            {/* Dismiss */}
            <button
              onClick={handleComplete}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Skip"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-8 pt-6">
              {/* Step dots */}
              <div className="flex items-center gap-1.5 mb-5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step
                        ? "w-8 bg-primary"
                        : i < step
                        ? "w-4 bg-primary/40"
                        : "w-3 bg-muted-foreground/20"
                    }`}
                  />
                ))}
              </div>

              {/* Greeting on first step */}
              {step === 0 && (
                <p className="text-sm text-muted-foreground mb-4">
                  Welcome, <span className="font-semibold text-foreground">{displayName}</span> 👋
                </p>
              )}

              {/* Icon */}
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="w-7 h-7 text-primary" />
              </div>

              {/* Content */}
              <h2 className="text-xl font-bold font-display mb-1">{current.title}</h2>
              <p className="text-xs text-primary/80 font-medium mb-3">{current.subtitle}</p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {current.description}
              </p>

              {/* Bullets */}
              {current.bullets && (
                <div className="space-y-2 mb-5">
                  {current.bullets.map((b) => (
                    <div key={b} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground/80">{b}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tip */}
              {current.tip && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/[0.06] border border-primary/10 mb-5">
                  <TrendingUp className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/80 leading-relaxed">{current.tip}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleComplete}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip intro
                </button>
                <div className="flex items-center gap-2">
                  {current.secondaryCta && current.secondaryPath && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCTA(current.secondaryPath!)}
                      className="text-xs"
                    >
                      {current.secondaryCta}
                    </Button>
                  )}
                  {current.cta && current.ctaPath ? (
                    <Button size="sm" onClick={() => handleCTA(current.ctaPath!)} className="gap-1.5">
                      {current.cta} <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  ) : (
                    <Button size="sm" onClick={handleNext} className="gap-1.5">
                      {isLast ? "Get Started" : "Next"} <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WelcomeFlow;

import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Target, AlertTriangle, BarChart3, Database, Cable, Sparkles } from "lucide-react";
import heroVisual from "@/assets/hero-visual.png";

const CAPABILITY_PILLS = [
  { icon: Cable, label: "Enterprise Data Connectors" },
  { icon: ShieldCheck, label: "Decision Audit Trails" },
  { icon: Target, label: "Forecast Calibration" },
  { icon: AlertTriangle, label: "Overconfidence Detection" },
  { icon: BarChart3, label: "Board-Ready Defensibility" },
];

const HeroSection = forwardRef<HTMLElement>((_, ref) => {
  return (
    <header ref={ref} className="relative min-h-[85vh] min-h-[85dvh] flex items-center overflow-hidden pt-20" role="banner">
      <img
        src={heroVisual}
        alt=""
        role="presentation"
        loading="eager"
        width={1920}
        height={1080}
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-25"
      />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-background/60 via-background/40 to-background" />

      <div className="absolute inset-0 pointer-events-none z-[2]">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/6 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-primary/[0.04] rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-xs font-semibold text-primary mb-6 sm:mb-8"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              The Decision Operating System for Leadership Teams
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold font-display leading-[1.05] mb-4 sm:mb-6">
              The Operating System for{" "}
              <br className="hidden sm:block" />
              <span className="gradient-text">Billion-Dollar Decisions.</span>
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mb-6 sm:mb-10 leading-relaxed">
              Organizations lose an estimated $3 trillion+ annually from suboptimal strategic decisions.
              Quantivis closes the gap between data and decisive action — transforming raw intelligence into{" "}
              <span className="text-foreground font-medium">
                calibrated, board-defensible outcomes with a decision ledger that learns from every result.
              </span>
            </p>

            {/* Capability pills */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap gap-2.5 justify-center mb-6 sm:mb-10"
            >
              {CAPABILITY_PILLS.map((pill, i) => (
                <motion.div
                  key={pill.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card/60 backdrop-blur-sm text-sm font-medium text-foreground/80"
                >
                  <pill.icon className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                  {pill.label}
                </motion.div>
              ))}
            </motion.div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link
                to="/free-analysis"
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-10 py-3.5 sm:py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm sm:text-base hover:brightness-110 transition-all shadow-lg shadow-primary/25"
              >
                <Sparkles className="w-4 h-4" /> Run Free Business Analysis <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-10 py-3.5 sm:py-4 rounded-xl border border-border bg-card/50 text-foreground font-semibold text-sm sm:text-base hover:border-primary/30 transition-all"
              >
                <Database className="w-4 h-4" /> Connect Your Data
              </Link>
            </div>

            {/* 90-day promise strip */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mt-12 pt-6 border-t border-border/30"
            >
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/50 mb-3">Your 90-day path to calibrated decisions</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 justify-center">
                {[
                  { month: "Month 1", label: "Decision Ledger" },
                  { month: "Month 2", label: "Outcome Tracking" },
                  { month: "Month 3", label: "Calibration Active" },
                ].map((step, i) => (
                  <span key={step.month} className="text-xs sm:text-sm text-muted-foreground/60">
                    <span className="text-primary font-semibold">{step.month}</span>
                    <span className="mx-1.5 text-border">→</span>
                    {step.label}
                  </span>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </header>
  );
};

export default HeroSection;

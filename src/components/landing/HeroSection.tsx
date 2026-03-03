import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Target, TrendingDown, BarChart3 } from "lucide-react";
import heroVisual from "@/assets/hero-visual.png";

const CAPABILITY_PILLS = [
  { icon: ShieldCheck, label: "Overconfidence Protection" },
  { icon: Target, label: "Board-Ready Defensibility" },
  { icon: TrendingDown, label: "Downside Risk Reduction" },
  { icon: BarChart3, label: "Decision Accuracy Tracking" },
];

const HeroSection = () => {
  return (
    <header className="relative min-h-[85vh] flex items-center overflow-hidden pt-20" role="banner">
      {/* Background image */}
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

      {/* Ambient glow */}
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
              Executive Decision Governance Platform
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold font-display leading-[1.05] mb-4 sm:mb-6">
              Reduce Overconfidence.{" "}
              <br className="hidden sm:block" />
              Defend Every{" "}
              <span className="gradient-text">Strategic Call.</span>
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mb-6 sm:mb-10 leading-relaxed">
              Leadership teams systematically overestimate strategic bets by 7–12 percentage points. Quantivis measures, corrects, and{" "}
              <span className="text-foreground font-medium">continuously improves your decision accuracy</span> — so every call is board-defensible.
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

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/demo"
                className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:brightness-110 transition-all shadow-lg shadow-primary/25"
              >
                See How It Protects You <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-xl border border-border bg-card/50 text-foreground font-semibold text-base hover:border-primary/30 transition-all"
              >
                Start 14-Day Free Trial
              </Link>
            </div>

            {/* Risk stats strip */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mt-12 pt-6 border-t border-border/30"
            >
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/50 mb-3">What you're leaving unprotected</p>
              <div className="flex flex-wrap gap-6 justify-center">
                {[
                  "Unaudited Board Decisions",
                  "Unchecked Confidence Bias",
                  "Invisible Strategic Drift",
                  "Manual Risk Assessment",
                  "Gut-Feel Capital Allocation",
                ].map((risk) => (
                  <span key={risk} className="text-sm text-muted-foreground/40 line-through decoration-muted-foreground/20">{risk}</span>
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

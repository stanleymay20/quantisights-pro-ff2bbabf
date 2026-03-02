import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Brain, Shield, TrendingUp, Zap } from "lucide-react";
import heroVisual from "@/assets/hero-visual.png";

const CAPABILITY_PILLS = [
  { icon: Brain, label: "Causal Inference" },
  { icon: Shield, label: "Bias Detection" },
  { icon: TrendingUp, label: "Predictive Forecasting" },
  { icon: Zap, label: "Prescriptive Advisory" },
];

const HeroSection = () => {
  return (
    <header className="relative min-h-[92vh] flex items-center overflow-hidden pt-20" role="banner">
      {/* Background image */}
      <img
        src={heroVisual}
        alt=""
        role="presentation"
        fetchPriority="high"
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-xs font-semibold text-primary mb-8"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              The #1 Artificial Decision Intelligence Platform
            </motion.div>

            <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold font-display leading-[1.05] mb-6">
              Stop Reporting.{" "}
              <br className="hidden sm:block" />
              Start{" "}
              <span className="gradient-text">Deciding.</span>
            </h1>
            <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              The only platform that combines causal inference, cognitive bias detection, and counterfactual analysis to transform your operational data into{" "}
              <span className="text-foreground font-medium">defensible strategic decisions</span>.
            </p>

            {/* Capability pills */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap gap-2.5 justify-center mb-10"
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
                Try Live Demo <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-xl border border-border bg-card/50 text-foreground font-semibold text-base hover:border-primary/30 transition-all"
              >
                Start 14-Day Free Trial
              </Link>
            </div>

            {/* Replaces strip */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mt-12 pt-6 border-t border-border/30"
            >
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/50 mb-3">Replaces</p>
              <div className="flex flex-wrap gap-4 justify-center">
                {["McKinsey Engagements", "Manual Board Prep", "Spreadsheet Strategy", "Siloed BI Dashboards", "Advisory Retainers"].map((tool) => (
                  <span key={tool} className="text-sm text-muted-foreground/40 line-through decoration-muted-foreground/20">{tool}</span>
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

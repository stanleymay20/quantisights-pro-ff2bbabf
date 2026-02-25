import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Shield, BarChart3, Zap, TrendingUp, Brain, CheckCircle2 } from "lucide-react";
import heroVisual from "@/assets/hero-visual.png";

const PROOF_POINTS = [
  "From data ingestion to board-ready advisory in minutes",
  "Every insight traceable to verified operational data",
  "No dashboards to configure — intelligence is autonomous",
];

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/8 rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-xs font-medium text-primary mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              The Executive Operating System
            </motion.div>

            <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold font-display leading-[1.08] mb-6">
              Stop Reporting.{" "}
              <br className="hidden sm:block" />
              Start{" "}
              <span className="gradient-text">Deciding.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed">
              Quantivis isn't a dashboard — it's an autonomous intelligence engine that ingests your operational data, diagnoses root causes, and prescribes strategic action with traceable confidence scores.
            </p>

            {/* Proof points */}
            <div className="space-y-2.5 mb-8">
              {PROOF_POINTS.map((point) => (
                <div key={point} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm text-foreground/80">{point}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:brightness-110 transition-all shadow-lg shadow-primary/25"
              >
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl glass-card text-foreground font-semibold text-base hover:border-primary/30 transition-all"
              >
                See the Difference
              </a>
            </div>

            {/* Category differentiator */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-10 pt-8 border-t border-border/20"
            >
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground/60 mb-3">Replaces</p>
              <div className="flex flex-wrap gap-3">
                {["Tableau", "Power BI", "Looker", "Anaplan", "Manual Consulting"].map((tool) => (
                  <span key={tool} className="text-xs text-muted-foreground/50 line-through decoration-muted-foreground/30">{tool}</span>
                ))}
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="hidden lg:block"
          >
            <img
              src={heroVisual}
              alt="Autonomous intelligence engine — KPI diagnostics, advisory playbooks, and executive decision support"
              className="w-full animate-float"
              loading="lazy"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

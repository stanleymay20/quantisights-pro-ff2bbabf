import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Shield, BarChart3, Zap } from "lucide-react";
import heroVisual from "@/assets/hero-visual.png";

const TRUST_BADGES = [
  { icon: Shield, label: "Enterprise-grade security" },
  { icon: BarChart3, label: "Real-time KPI intelligence" },
  { icon: Zap, label: "Autonomous advisory" },
];

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
      {/* Background glow effects */}
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
              Executive Intelligence Platform
            </motion.div>

            <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold font-display leading-tight mb-6">
              Transforming Data{" "}
              <br className="hidden sm:block" />
              into Strategic{" "}
              <span className="gradient-text">Clarity</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed">
              Autonomous diagnostics, prescriptive advisory, and executive decision support — powered by your real operational data.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:brightness-110 transition-all shadow-lg shadow-primary/25"
              >
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl glass-card text-foreground font-semibold text-base hover:border-primary/30 transition-all"
              >
                See How It Works
              </a>
            </div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap gap-5 mt-10"
            >
              {TRUST_BADGES.map((badge) => (
                <div key={badge.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <badge.icon className="w-3.5 h-3.5 text-primary/60" />
                  {badge.label}
                </div>
              ))}
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
              alt="Executive intelligence dashboard visualization"
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

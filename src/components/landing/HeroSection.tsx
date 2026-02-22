import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import heroVisual from "@/assets/hero-visual.png";

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
            <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold font-display leading-tight mb-6">
              Transforming Data{" "}
              <br />
              into Strategic{" "}
              <span className="gradient-text">Clarity</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed">
              Expert data consulting and intelligent analytics to empower your global business decisions.
            </p>
            <div className="flex gap-4">
              <Link
                to="/dashboard"
                className="inline-flex items-center px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:brightness-110 transition-all shadow-lg shadow-primary/25"
              >
                Get Started
              </Link>
              <a
                href="#features"
                className="inline-flex items-center px-8 py-4 rounded-xl glass-card text-foreground font-semibold text-base hover:border-primary/30 transition-all"
              >
                Learn More
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="hidden lg:block"
          >
            <img
              src={heroVisual}
              alt="Data analytics visualization"
              className="w-full animate-float"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

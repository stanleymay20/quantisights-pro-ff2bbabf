import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const CTASection = () => {
  return (
    <section id="contact" className="py-32 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/8 rounded-full blur-[150px]" />
      </div>
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card glow-border p-12 md:p-16 text-center max-w-3xl mx-auto"
        >
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-4">The Category Is Decided</p>
          <h2 className="text-4xl font-bold font-display mb-4">
            Your Data Already Knows the Answer.
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            Stop paying consultants to tell you what your data already shows. Quantivis extracts strategic intelligence autonomously — with full traceability, institutional confidence scoring, and board-ready governance.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:brightness-110 transition-all shadow-lg shadow-primary/25"
          >
            Start Free Trial <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-xs text-muted-foreground mt-4">No credit card required · GDPR compliant · SOC 2 infrastructure</p>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;

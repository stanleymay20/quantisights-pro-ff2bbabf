import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Mail } from "lucide-react";

const CTASection = () => {
  return (
    <section id="contact" className="py-24 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/5 rounded-full blur-[120px]" />
      </div>
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="border border-border rounded-2xl bg-card/80 backdrop-blur-sm p-12 md:p-16 text-center max-w-3xl mx-auto shadow-lg"
        >
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-4">Beyond Business Intelligence</p>
          <h2 className="text-4xl font-bold font-display mb-4">
            Your Data Already Knows the Answer.
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            Stop paying consultants to tell you what your data already shows. Quantivis applies decision science — causal inference, bias detection, and counterfactual reasoning — to make every strategic choice defensible.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:brightness-110 transition-all shadow-lg shadow-primary/25"
            >
              Start 14-Day Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="mailto:hello@quantivis.io"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-xl border border-border bg-card/50 text-foreground font-semibold text-lg hover:border-primary/30 transition-all"
            >
              <Mail className="w-5 h-5" /> Contact Sales
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-4">14-day free trial · GDPR compliant · SOC 2 infrastructure</p>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;

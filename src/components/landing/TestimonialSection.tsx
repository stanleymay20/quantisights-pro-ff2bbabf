import { motion } from "framer-motion";
import { Star, Quote, TrendingUp, Clock, Brain } from "lucide-react";

const TESTIMONIALS = [
  {
    quote: "We cancelled our management consulting retainer within 3 months. The causal inference engine surfaces root causes in real-time — no more 6-week engagement cycles to discover what we already suspected.",
    role: "CFO",
    company: "Enterprise SaaS",
    detail: "Series C · €45M ARR",
    avatar: "CFO",
    highlight: "Replaced €220K/yr advisory spend",
    highlightIcon: TrendingUp,
  },
  {
    quote: "The cognitive bias detection flagged a €1.2M sunk cost fallacy in our product roadmap that our entire leadership team missed. That single alert paid for 5 years of the platform.",
    role: "CEO",
    company: "Industrial Manufacturing",
    detail: "600+ employees · DACH region",
    avatar: "CEO",
    highlight: "€1.2M misallocation prevented",
    highlightIcon: Brain,
  },
  {
    quote: "Board prep went from a 5-day scramble across 4 departments to pressing a single button. The convergence index showed we were structurally misaligned — we restructured OKRs within a week.",
    role: "COO",
    company: "HealthTech Scale-up",
    detail: "Series B · 120 employees",
    avatar: "COO",
    highlight: "Board prep: 5 days → 2 hours",
    highlightIcon: Clock,
  },
];

const METRICS = [
  { value: "78%", label: "Avg. reduction in board prep time" },
  { value: "3.2x", label: "ROI within first 6 months" },
  { value: "<5min", label: "Time to first strategic insight" },
  { value: "94%", label: "Executive renewal rate" },
];

const TestimonialSection = () => {
  return (
    <section id="case-studies" className="py-24 relative">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">From Our Customers</p>
          <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
            Leaders Who Stopped <span className="gradient-text">Guessing</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Real outcomes from executive teams who replaced intuition with decision science.
          </p>
        </motion.div>

        {/* Metrics strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-14"
        >
          {METRICS.map((m) => (
            <div key={m.label} className="glass-card p-5 text-center">
              <p className="text-2xl lg:text-3xl font-bold font-display gradient-text">{m.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Testimonial cards */}
        <div className="grid lg:grid-cols-3 gap-5 mb-16">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.role + t.company}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className="glass-card-hover p-7 flex flex-col"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5 fill-warning text-warning" />
                ))}
              </div>

              {/* Quote */}
              <div className="relative flex-1 mb-6">
                <Quote className="absolute -top-1 -left-1 w-6 h-6 text-primary/10" />
                <p className="text-sm text-foreground/90 leading-relaxed pl-4">
                  "{t.quote}"
                </p>
              </div>

              {/* Highlight badge */}
              <div className="mb-5 px-3 py-2 rounded-lg bg-success/[0.06] border border-success/20 flex items-center gap-2">
                <t.highlightIcon className="w-3.5 h-3.5 text-success shrink-0" />
                <p className="text-xs font-semibold text-success">{t.highlight}</p>
              </div>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-border/40">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.role}</p>
                  <p className="text-[11px] text-muted-foreground">{t.company}</p>
                  <p className="text-[10px] text-muted-foreground/60">{t.detail}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Anonymity note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-[11px] text-muted-foreground/40"
        >
          Customer identities anonymized per NDA agreements. Full case studies available upon request.
        </motion.p>
      </div>
    </section>
  );
};

export default TestimonialSection;

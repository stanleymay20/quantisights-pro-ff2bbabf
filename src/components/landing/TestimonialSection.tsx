import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    quote: "We cancelled our McKinsey retainer within 3 months. Quantivis surfaces the same strategic insights in real-time — without the 6-week engagement cycle.",
    name: "Dr. Martina Keller",
    role: "CFO",
    company: "NovaTech Systems",
    industry: "Enterprise SaaS · Series C",
    avatar: "MK",
    highlight: "Replaced €220K/yr advisory retainer",
  },
  {
    quote: "The cognitive bias detection alone justified the investment. It flagged a €1.2M sunk cost fallacy in our product roadmap that our entire leadership team had missed.",
    name: "James Okonkwo",
    role: "CEO",
    company: "Meridian Group",
    industry: "Manufacturing · 600 employees",
    avatar: "JO",
    highlight: "€1.2M misallocation prevented",
  },
  {
    quote: "Board prep went from a 5-day scramble to pressing a button. The convergence index showed our C-suite was structurally misaligned — we restructured OKRs in a week.",
    name: "Sofia Andersen",
    role: "COO",
    company: "Polaris Health",
    industry: "HealthTech · Series B",
    avatar: "SA",
    highlight: "Board prep: 5 days → 2 hours",
  },
];

const LOGOS = [
  "NovaTech", "Meridian", "Polaris", "Stratos", "Vectral", "Nexion", "Cortex", "Axiom"
];

const TestimonialSection = () => {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Trusted by Decision Makers</p>
          <h2 className="text-4xl font-bold font-display mb-4">
            Leaders Who Stopped <span className="gradient-text">Guessing</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            From Series B startups to mid-market enterprises — teams that replaced intuition with decision science.
          </p>
        </motion.div>

        {/* Testimonial cards */}
        <div className="grid lg:grid-cols-3 gap-5 mb-16">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
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
              <div className="mb-5 px-3 py-2 rounded-lg bg-success/[0.06] border border-success/20">
                <p className="text-xs font-semibold text-success">{t.highlight}</p>
              </div>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-border/40">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">{t.role}, {t.company}</p>
                  <p className="text-[10px] text-muted-foreground/60">{t.industry}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Logo strip */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/40 font-semibold mb-6">
            Trusted by forward-thinking organizations
          </p>
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
            {LOGOS.map((name) => (
              <span key={name} className="text-lg font-display font-bold text-muted-foreground/20 tracking-wider">
                {name}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TestimonialSection;

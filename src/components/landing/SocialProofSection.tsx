import { motion } from "framer-motion";
import { TrendingUp, Clock, DollarSign, ShieldCheck, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const ROI_METRICS = [
  { icon: Clock, value: "92%", label: "Reduction in reporting time", detail: "From 40hrs/month to 3hrs" },
  { icon: TrendingUp, value: "3.2×", label: "Faster strategic decisions", detail: "Board-ready intelligence in minutes" },
  { icon: DollarSign, value: "€180K", label: "Avg. annual consulting savings", detail: "Replacing manual advisory cycles" },
  { icon: ShieldCheck, value: "100%", label: "Decision traceability", detail: "Every insight linked to verified data" },
];

const CASE_STUDIES = [
  {
    industry: "SaaS",
    company: "Series B · 120 employees",
    challenge: "Manual KPI tracking across 12 spreadsheets. Monthly board reports took 5 days to compile.",
    result: "Automated intelligence pipeline reduced board prep to 2 hours. Identified €340K revenue leak through autonomous diagnostics.",
    metrics: ["5 days → 2 hours", "€340K recovered", "4 C-suite roles unified"],
  },
  {
    industry: "Manufacturing",
    company: "Mid-market · 800 employees",
    challenge: "Siloed data across ERP, CRM, and BI tools. No unified risk view for executive team.",
    result: "Single intelligence layer across all data sources. Strategic Risk Index flagged supply chain disruption 6 weeks before impact.",
    metrics: ["6-week early warning", "3 systems unified", "Convergence Index: 87"],
  },
  {
    industry: "Financial Services",
    company: "Enterprise · 2,400 employees",
    challenge: "Compliance reporting consumed 30% of analyst capacity. Advisory recommendations lacked data provenance.",
    result: "Fully traceable advisory engine with confidence scoring. Audit-ready intelligence trail for every strategic recommendation.",
    metrics: ["30% capacity freed", "100% traceability", "SOC 2 aligned"],
  },
];

const SocialProofSection = () => {
  return (
    <>
      {/* ROI Section */}
      <section className="py-32 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">Measurable Impact</p>
            <h2 className="text-4xl font-bold font-display mb-4">
              The ROI of <span className="gradient-text">Autonomous Intelligence</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Quantivis doesn't just visualize data — it eliminates the entire manual consulting cycle.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {ROI_METRICS.map((metric, i) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-8 text-center"
              >
                <metric.icon className="w-8 h-8 text-primary mx-auto mb-4" />
                <p className="text-4xl font-bold font-display gradient-text mb-1">{metric.value}</p>
                <p className="text-sm font-semibold mb-1">{metric.label}</p>
                <p className="text-xs text-muted-foreground">{metric.detail}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Case Studies */}
      <section id="case-studies" className="py-32 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">Proven Results</p>
            <h2 className="text-4xl font-bold font-display mb-4">
              How Leaders Use <span className="gradient-text">Quantivis</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From SaaS to manufacturing to financial services — autonomous intelligence transforms strategic operations.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            {CASE_STUDIES.map((study, i) => (
              <motion.div
                key={study.industry}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="glass-card-hover p-8 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-6">
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">{study.industry}</span>
                  <span className="text-xs text-muted-foreground">{study.company}</span>
                </div>

                <div className="mb-4">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-1.5">Challenge</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{study.challenge}</p>
                </div>

                <div className="mb-6">
                  <p className="text-[11px] uppercase tracking-widest text-primary/80 font-semibold mb-1.5">Result</p>
                  <p className="text-sm text-foreground/90 leading-relaxed">{study.result}</p>
                </div>

                <div className="mt-auto pt-4 border-t border-border/20 flex flex-wrap gap-2">
                  {study.metrics.map((m) => (
                    <span key={m} className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-primary/5 text-primary/90">{m}</span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Link
              to="/register"
              className="inline-flex items-center gap-2 text-primary font-semibold hover:underline"
            >
              Start your own success story <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
};

export default SocialProofSection;

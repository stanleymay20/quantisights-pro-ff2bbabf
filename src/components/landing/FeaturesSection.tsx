import { motion } from "framer-motion";
import {
  Brain, Zap, Shield, TrendingUp, FileText, Users,
  ArrowRight, Network, BrainCircuit, FlipVertical,
  BarChart3, Target, Sparkles, Bell,
} from "lucide-react";

const HOW_IT_WORKS = [
  { step: "01", title: "Ingest", desc: "Connect CSV, webhook, or API. Data flows in with versioning, quality scoring, and lineage tracking." },
  { step: "02", title: "Diagnose", desc: "Autonomous root cause analysis with causal inference DAGs — not just correlation, but true causation." },
  { step: "03", title: "Prescribe", desc: "AI generates actionable playbooks with confidence scores, bias detection, and traceable evidence chains." },
  { step: "04", title: "Govern", desc: "Board-ready reports, convergence indices, counterfactual validation, and multi-role executive intelligence." },
];

const DIFFERENTIATORS = [
  {
    icon: Network,
    title: "Causal Inference Engine",
    description: "Directed Acyclic Graphs distinguish true causation from coincidence. Know exactly why your KPIs moved.",
    tag: "Only Platform",
    category: "Decision Science",
  },
  {
    icon: BrainCircuit,
    title: "Cognitive Bias Detection",
    description: "Auto-detect anchoring, sunk cost, confirmation bias, recency bias, and overconfidence in your decision patterns.",
    tag: "Unique",
    category: "Decision Science",
  },
  {
    icon: FlipVertical,
    title: "Counterfactual Explanations",
    description: "'What would need to change for the opposite recommendation?' Critical for executive trust and audit trails.",
    tag: "Unique",
    category: "Decision Science",
  },
  {
    icon: Sparkles,
    title: "Predictive Forecasting",
    description: "AI-powered exponential smoothing with seasonality detection, growth rates, and MAPE accuracy scoring.",
    category: "Intelligence",
  },
  {
    icon: Brain,
    title: "Prescriptive Advisory Engine",
    description: "Every recommendation comes with confidence scoring, epistemic capping, actionable playbooks, and lifecycle tracking.",
    category: "Advisory",
  },
  {
    icon: Shield,
    title: "Executive Convergence Index",
    description: "Detects strategic conflicts across CEO, CFO, CMO, and COO roles. Unified alignment scoring with escalation triggers.",
    category: "Governance",
  },
  {
    icon: TrendingUp,
    title: "Monte Carlo War Room",
    description: "Model multi-variable scenarios with probability distributions. Project P10/P50/P90 impacts on your Strategic Risk Index.",
    category: "Strategy",
  },
  {
    icon: FileText,
    title: "Board Governance Reports",
    description: "One-click export with governance posture banners, trend intelligence, risk attribution, and deterministic action frameworks.",
    category: "Reporting",
  },
  {
    icon: Target,
    title: "OKR Alignment & Benchmarking",
    description: "Cascading objectives with weighted key results, KPI linking, and industry percentile benchmarking (P25/P50/P75/P90).",
    category: "Strategy",
  },
  {
    icon: Bell,
    title: "Alert Playbooks & Escalation",
    description: "Configurable threshold-based escalation chains with cooldown periods, Slack/email routing, and execution audit logs.",
    category: "Operations",
  },
  {
    icon: BarChart3,
    title: "Decision Ledger",
    description: "Track every strategic decision with calibration scoring. Learn from past predictions to improve future confidence.",
    category: "Governance",
  },
  {
    icon: Users,
    title: "Multi-Org Command Center",
    description: "Manage multiple client organizations. RBAC, team invitations, audit logs, and tiered subscription enforcement.",
    category: "Scale",
  },
];

const FeaturesSection = () => {
  return (
    <>
      {/* How It Works */}
      <section id="how-it-works" className="py-24 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">How It Works</p>
            <h2 className="text-4xl font-bold font-display mb-4">
              Four Steps to <span className="gradient-text">Strategic Autonomy</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Replace the manual cycle of data gathering, analysis, consulting, and reporting with an autonomous intelligence loop.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {HOW_IT_WORKS.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                <div className="glass-card p-7 h-full">
                  <span className="text-3xl font-bold font-display text-primary/20">{item.step}</span>
                  <h3 className="text-lg font-semibold font-display mt-2 mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden lg:flex absolute top-1/2 -right-3 z-10">
                    <ArrowRight className="w-5 h-5 text-primary/30" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Unique differentiators banner */}
      <section className="py-16 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card-elevated p-10 md:p-14 text-center"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">What Makes Us Different</p>
            <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
              Three Capabilities <span className="gradient-text">No One Else Has</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-10">
              We don't just visualize data. We apply decision science — causal reasoning, cognitive psychology, and counterfactual logic — to make your strategic choices defensible and auditable.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {DIFFERENTIATORS.slice(0, 3).map((d, i) => (
                <motion.div
                  key={d.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 }}
                  className="p-6 rounded-xl border border-primary/20 bg-primary/[0.03] text-left"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <d.icon className="w-5 h-5 text-primary" />
                    </div>
                    {d.tag && (
                      <span className="text-[10px] uppercase tracking-widest font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {d.tag}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold font-display mb-2">{d.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{d.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Full Capabilities Grid */}
      <section id="features" className="py-24 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Full Platform</p>
            <h2 className="text-4xl font-bold font-display mb-4">
              20+ Modules. One <span className="gradient-text">Intelligence Engine.</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Every feature converts raw data into confident, defensible strategic decisions — with full provenance and audit trails.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {DIFFERENTIATORS.slice(3).map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="glass-card-hover p-7 group"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">{feature.category}</span>
                </div>
                <h3 className="text-lg font-semibold font-display mb-2">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default FeaturesSection;

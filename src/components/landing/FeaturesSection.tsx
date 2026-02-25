import { motion } from "framer-motion";
import { BarChart3, Brain, Shield, Zap, Target, TrendingUp, ArrowRight, FileText, Users } from "lucide-react";

const HOW_IT_WORKS = [
  { step: "01", title: "Ingest", desc: "Connect CSV, webhook, or API. Data flows in with versioning and quality scoring." },
  { step: "02", title: "Diagnose", desc: "Autonomous root cause analysis identifies exactly why KPIs moved — no manual exploration." },
  { step: "03", title: "Prescribe", desc: "AI generates actionable playbooks with confidence scores and traceable evidence chains." },
  { step: "04", title: "Govern", desc: "Board-ready reports, convergence indices, and multi-role executive intelligence — automatically." },
];

const capabilities = [
  {
    icon: Brain,
    title: "Autonomous Diagnostics",
    description: "AI continuously monitors your data, detects anomalies, traces root causes, and flags strategic risks before they surface.",
    category: "Intelligence",
  },
  {
    icon: Zap,
    title: "Prescriptive Advisory Engine",
    description: "Every recommendation comes with a confidence score, traceable data provenance, actionable playbooks, and lifecycle tracking.",
    category: "Advisory",
  },
  {
    icon: Shield,
    title: "Executive Command Center",
    description: "Role-specific intelligence for CEO, CFO, CMO, and COO. Convergence indices detect strategic conflicts across roles.",
    category: "Governance",
  },
  {
    icon: TrendingUp,
    title: "Scenario War Room",
    description: "Model multi-variable scenarios and project impacts on your Strategic Risk Index with AI narrative layers.",
    category: "Strategy",
  },
  {
    icon: FileText,
    title: "Board Governance Reports",
    description: "One-click export with governance posture banners, trend intelligence, risk attribution, and deterministic action frameworks.",
    category: "Reporting",
  },
  {
    icon: Users,
    title: "Multi-Org Consultancy Model",
    description: "Manage multiple client organizations from one account. RBAC, team invitations, audit logs, and tiered subscription enforcement.",
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
            <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">How It Works</p>
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

      {/* Capabilities */}
      <section id="features" className="py-24 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">Capabilities</p>
            <h2 className="text-4xl font-bold font-display mb-4">
              Not a Dashboard. An <span className="gradient-text">Intelligence Engine.</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Every feature converts raw data into confident, defensible strategic decisions.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {capabilities.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
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

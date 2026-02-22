import { motion } from "framer-motion";
import { BarChart3, Brain, Shield, Zap, Globe, TrendingUp } from "lucide-react";

const features = [
  {
    icon: BarChart3,
    title: "Executive Dashboards",
    description: "Real-time KPI tracking with interactive visualizations for revenue, customers, and growth metrics.",
  },
  {
    icon: Brain,
    title: "AI-Powered Insights",
    description: "Machine learning models that detect patterns and generate strategic recommendations automatically.",
  },
  {
    icon: TrendingUp,
    title: "Predictive Forecasting",
    description: "Advanced time-series analysis delivering 3-6 month forecasts with confidence intervals.",
  },
  {
    icon: Shield,
    title: "Anomaly Detection",
    description: "Instant alerts for revenue drops, cost spikes, and unusual churn changes across all regions.",
  },
  {
    icon: Zap,
    title: "Automated Reports",
    description: "One-click PDF generation with KPI summaries, growth charts, and strategic recommendations.",
  },
  {
    icon: Globe,
    title: "Multi-Tenant SaaS",
    description: "Enterprise-grade isolation with role-based access for organizations of any scale.",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-32 relative">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold font-display mb-4">
            Intelligence at <span className="gradient-text">Every Level</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            From raw data to decisive advantage — everything your enterprise needs.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-card-hover p-8 group"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold font-display mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;

import { motion } from "framer-motion";
import { CheckCircle2, Clock, Upload, Webhook } from "lucide-react";

const INTEGRATIONS = [
  { name: "Stripe", desc: "Revenue, MRR, churn, subscription metrics", status: "live" as const },
  { name: "Google Analytics", desc: "Traffic, conversions, acquisition data", status: "live" as const },
  { name: "CSV Upload", desc: "Drag-and-drop with column mapping & validation", status: "live" as const, icon: Upload },
  { name: "Webhook API", desc: "Push data from any system in real-time", status: "live" as const, icon: Webhook },
  { name: "QuickBooks", desc: "P&L, balance sheet, cash flow automation", status: "coming" as const },
  { name: "Xero", desc: "Accounting data with multi-currency support", status: "coming" as const },
  { name: "HubSpot", desc: "Pipeline, deal velocity, lead scoring", status: "coming" as const },
  { name: "Salesforce", desc: "CRM data, forecasts, activity metrics", status: "coming" as const },
];

const IntegrationsSection = () => (
  <section className="py-24 relative">
    <div className="container mx-auto px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-14"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Integrations</p>
        <h2 className="text-4xl font-bold font-display mb-4">
          Connect Your <span className="gradient-text">Source of Truth</span>
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          No more weekly CSV exports. Connect your tools and let intelligence flow automatically.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
        {INTEGRATIONS.map((integration, i) => (
          <motion.div
            key={integration.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="glass-card p-5 group relative"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-sm">{integration.name}</h3>
              {integration.status === "live" ? (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Live
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" /> Q3 2026
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{integration.desc}</p>
          </motion.div>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="text-center text-sm text-muted-foreground mt-8"
      >
        Need a specific integration?{" "}
        <a href="mailto:hello@quantivis.io" className="text-primary hover:underline">
          Let us know
        </a>{" "}
        — we ship fast.
      </motion.p>
    </div>
  </section>
);

export default IntegrationsSection;

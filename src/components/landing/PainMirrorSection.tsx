import { motion } from "framer-motion";
import { ArrowRight, FileQuestion, Brain, TrendingUp } from "lucide-react";

const BLIND_SPOTS = [
  { icon: FileQuestion, text: "Where forecasts were overconfident" },
  { icon: Brain, text: "Which signals actually predicted success" },
  { icon: TrendingUp, text: "Which types of decisions create the most value" },
];

const PainMirrorSection = () => {
  return (
    <section className="py-20 sm:py-28 relative">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center mb-12 sm:mb-16"
        >
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-4">The Decision Quality Gap</p>
          <h2 className="text-2xl sm:text-4xl font-bold font-display mb-5">
            The Analytics-Action Gap Costs Fortune 500s $3 Trillion Annually
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Traditional BI answers "what happened." But strategic decisions require causal inference, 
            counterfactual reasoning, and prescriptive guidance. Without Decision Intelligence, 
            the same cognitive biases and overconfidence patterns repeat unchecked.
          </p>
        </motion.div>

        {/* Workflow diagram */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="max-w-3xl mx-auto mb-12"
        >
          <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-6 sm:p-8">
            {/* Current flow */}
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground/50 mb-4">How most companies operate today</p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-6">
              {["Data", "Dashboards", "Meetings", "Opinions", "PowerPoint", "Decision"].map((step, i) => (
                <div key={step} className="flex items-center gap-2 sm:gap-3">
                  <span className="px-3 py-1.5 rounded-lg bg-muted text-xs sm:text-sm font-medium text-foreground/70">{step}</span>
                  {i < 5 && <ArrowRight className="w-3 h-3 text-muted-foreground/30 shrink-0" />}
                </div>
              ))}
            </div>
            <div className="flex justify-center mb-6">
              <div className="px-4 py-2 rounded-lg border border-destructive/20 bg-destructive/5 text-xs sm:text-sm font-medium text-destructive">
                ✗ No record of accuracy. No institutional learning.
              </div>
            </div>

            {/* Blind spots */}
            <div className="border-t border-border/50 pt-6">
              <p className="text-xs text-muted-foreground/60 mb-3">Companies never learn:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {BLIND_SPOTS.map((item) => (
                  <div
                    key={item.text}
                    className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50"
                  >
                    <item.icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm text-foreground/70">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Closing line */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-center text-sm sm:text-base text-muted-foreground max-w-xl mx-auto"
        >
          Quantivis creates a <span className="text-foreground font-medium">decision ledger</span> for your organization — so every strategic call becomes measurable, reviewable, and improvable.
        </motion.p>
      </div>
    </section>
  );
};

export default PainMirrorSection;

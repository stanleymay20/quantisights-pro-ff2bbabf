import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

const comparisons = [
  {
    category: "Decision Protection",
    rows: [
      { feature: "Overconfidence detection & correction", quantivis: true, mckinsey: false, tableau: false, mosaic: false },
      { feature: "Self-correcting confidence scores", quantivis: true, mckinsey: false, tableau: false, mosaic: false },
      { feature: "Decision outcome tracking", quantivis: true, mckinsey: "Manual", tableau: false, mosaic: false },
      { feature: "Cognitive bias detection", quantivis: true, mckinsey: "Manual", tableau: false, mosaic: false },
      { feature: "Counterfactual analysis", quantivis: true, mckinsey: false, tableau: false, mosaic: false },
    ],
  },
  {
    category: "Board Defensibility",
    rows: [
      { feature: "Audit-ready decision trail", quantivis: true, mckinsey: false, tableau: false, mosaic: false },
      { feature: "Role-based risk scoring", quantivis: true, mckinsey: "Manual", tableau: false, mosaic: false },
      { feature: "C-suite alignment index", quantivis: true, mckinsey: false, tableau: false, mosaic: false },
      { feature: "One-click board reports", quantivis: true, mckinsey: true, tableau: "Manual", mosaic: "Basic" },
      { feature: "Corrected probability disclosures", quantivis: true, mckinsey: false, tableau: false, mosaic: false },
    ],
  },
  {
    category: "Cost & Speed",
    rows: [
      { feature: "Time to first insight", quantivis: "5 min", mckinsey: "4-6 weeks", tableau: "Days", mosaic: "Hours" },
      { feature: "Monthly cost", quantivis: "From €99", mckinsey: "€50K+/project", tableau: "€70/user", mosaic: "€800+" },
      { feature: "No implementation required", quantivis: true, mckinsey: false, tableau: false, mosaic: false },
      { feature: "Continuously learning system", quantivis: true, mckinsey: false, tableau: false, mosaic: false },
    ],
  },
];

const CellIcon = ({ value }: { value: boolean | string }) => {
  if (value === true) return <Check className="w-4 h-4 text-primary mx-auto" />;
  if (value === false) return <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />;
  return <span className="text-xs font-medium text-foreground">{value}</span>;
};

const ComparisonSection = ({ inline = false }: { inline?: boolean }) => (
  <section className={inline ? "max-w-5xl mx-auto" : "py-20"}>
    <div className={inline ? "" : "container mx-auto px-6"}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-10"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Why Quantivis</p>
        <h2 className="text-2xl md:text-3xl font-bold font-display mb-3">
          Decision Protection, <span className="gradient-text">SaaS Pricing</span>
        </h2>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto">
          The strategic defensibility of a top-tier consultancy with the speed, learning, and cost of modern software.
        </p>
      </motion.div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 px-4 md:px-6 text-muted-foreground font-medium w-[35%]">Capability</th>
                <th className="text-center py-4 px-3 md:px-4 font-semibold text-primary">
                  <div>Quantivis</div>
                  <div className="text-[10px] font-normal text-primary/70">Decision Governance</div>
                </th>
                <th className="text-center py-4 px-3 md:px-4 font-semibold">
                  <div>McKinsey</div>
                  <div className="text-[10px] font-normal text-muted-foreground">Consulting</div>
                </th>
                <th className="text-center py-4 px-3 md:px-4 font-semibold hidden sm:table-cell">
                  <div>Tableau</div>
                  <div className="text-[10px] font-normal text-muted-foreground">BI Tool</div>
                </th>
                <th className="text-center py-4 px-3 md:px-4 font-semibold hidden sm:table-cell">
                  <div>Mosaic</div>
                  <div className="text-[10px] font-normal text-muted-foreground">FP&A</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((group) => (
                <>
                  <tr key={group.category}>
                    <td colSpan={5} className="py-3 px-4 md:px-6 text-xs uppercase tracking-widest text-primary font-semibold bg-primary/[0.03] border-b border-border/50">
                      {group.category}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.feature} className="border-b border-border/20 hover:bg-card/50 transition-colors">
                      <td className="py-3 px-4 md:px-6 font-medium text-xs md:text-sm">{row.feature}</td>
                      <td className="text-center py-3 px-3 md:px-4 bg-primary/[0.02]"><CellIcon value={row.quantivis} /></td>
                      <td className="text-center py-3 px-3 md:px-4"><CellIcon value={row.mckinsey} /></td>
                      <td className="text-center py-3 px-3 md:px-4 hidden sm:table-cell"><CellIcon value={row.tableau} /></td>
                      <td className="text-center py-3 px-3 md:px-4 hidden sm:table-cell"><CellIcon value={row.mosaic} /></td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
);

export default ComparisonSection;

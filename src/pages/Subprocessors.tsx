import { Link } from "react-router-dom";
import logo from "@/assets/quantivis-logo.png";

const SUBPROCESSORS = [
  { name: "Amazon Web Services (AWS)", location: "EU-West-1 (Ireland)", purpose: "Cloud infrastructure, database hosting, file storage", safeguards: "EU Data Center, SOC 2 Type II" },
  { name: "Stripe, Inc.", location: "United States", purpose: "Payment processing, subscription management, invoicing", safeguards: "PCI DSS Level 1, SCCs" },
  { name: "Google LLC", location: "EU / United States", purpose: "AI model inference (Gemini) for diagnostics, advisory, and copilot features", safeguards: "SCCs, data not retained post-inference" },
  { name: "Resend, Inc.", location: "United States", purpose: "Transactional email delivery (password resets, alerts, weekly briefs)", safeguards: "SCCs, TLS encryption" },
];

const Subprocessors = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border/30 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="container mx-auto px-6 h-14 flex items-center">
        <Link to="/"><img src={logo} alt="Quantivis Global" className="h-8" /></Link>
      </div>
    </header>
    <main className="container mx-auto px-6 py-16 max-w-3xl">
      <h1 className="text-3xl font-bold font-display mb-2">Subprocessor List</h1>
      <p className="text-muted-foreground text-sm mb-10">Last updated: February 25, 2026</p>

      <div className="prose prose-sm prose-invert max-w-none space-y-6 text-foreground/90 text-sm leading-relaxed">
        <section>
          <p>Quantivis Global GmbH uses the following third-party subprocessors to deliver its services. All subprocessors are contractually bound to equivalent data protection standards under GDPR-compliant agreements.</p>
          <p>We provide 30 days' advance notice before adding or replacing a subprocessor. Subscribe to updates by emailing <span className="text-primary">dpo@quantivis.io</span>.</p>
        </section>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 pr-4 font-semibold">Subprocessor</th>
                <th className="text-left py-3 pr-4 font-semibold">Location</th>
                <th className="text-left py-3 pr-4 font-semibold">Purpose</th>
                <th className="text-left py-3 font-semibold">Safeguards</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {SUBPROCESSORS.map((sp) => (
                <tr key={sp.name} className="border-b border-border/30">
                  <td className="py-3 pr-4 font-medium text-foreground">{sp.name}</td>
                  <td className="py-3 pr-4">{sp.location}</td>
                  <td className="py-3 pr-4">{sp.purpose}</td>
                  <td className="py-3">{sp.safeguards}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-2">Data Residency</h2>
          <p>All primary data storage (databases, file storage, backups) is located within the European Union (AWS EU-West-1, Ireland). Data transferred to subprocessors outside the EU is protected by Standard Contractual Clauses (SCCs) approved by the European Commission.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Contact</h2>
          <p>Data Protection Officer: <span className="text-primary">dpo@quantivis.io</span></p>
        </section>
      </div>
    </main>
  </div>
);

export default Subprocessors;

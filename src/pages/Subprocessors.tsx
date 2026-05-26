import { Link } from "react-router-dom";
import logo from "@/assets/quantivis-logo.png";
import { CONTACT } from "@/lib/contact-config";
import { Badge } from "@/components/ui/badge";

type Subprocessor = {
  name: string;
  category: "Infrastructure" | "AI/ML" | "Payments" | "Email" | "Observability" | "Developer";
  location: string;
  region: "EU" | "US" | "EU/US";
  purpose: string;
  dataCategories: string;
  retention: string;
  dpa: string;
  safeguards: string;
};

const SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Amazon Web Services (AWS)",
    category: "Infrastructure",
    location: "EU-West-1 (Ireland)",
    region: "EU",
    purpose: "Cloud infrastructure, database hosting, file storage, backups",
    dataCategories: "All customer data (encrypted at rest)",
    retention: "Per customer retention policy",
    dpa: "Signed (SCCs, AWS GDPR DPA)",
    safeguards: "ISO 27001, SOC 2 Type II, EU Data Center, AES-256 KMS",
  },
  {
    name: "Supabase (Lovable Cloud)",
    category: "Infrastructure",
    location: "EU (Frankfurt)",
    region: "EU",
    purpose: "Managed PostgreSQL, authentication, edge function runtime, realtime",
    dataCategories: "All operational data (RLS-isolated per organization)",
    retention: "Per customer retention policy",
    dpa: "Signed (SCCs)",
    safeguards: "SOC 2 Type II, ISO 27001, EU processing region",
  },
  {
    name: "Lovable AB",
    category: "Developer",
    location: "Sweden (EU)",
    region: "EU",
    purpose: "Build platform and Cloud orchestration",
    dataCategories: "Application code, build metadata (no customer data)",
    retention: "Lifetime of project",
    dpa: "Signed",
    safeguards: "EU-based, ISO 27001 controls",
  },
  {
    name: "Google LLC (Gemini API)",
    category: "AI/ML",
    location: "EU / United States",
    region: "EU/US",
    purpose: "LLM inference for diagnostics, advisory, copilot, narrative generation",
    dataCategories: "Redacted operational metrics (PII redacted by default)",
    retention: "Not retained for model training; ephemeral inference only",
    dpa: "Signed (SCCs, Google Cloud DPA)",
    safeguards: "SCCs, no training on customer data, request-scoped logging",
  },
  {
    name: "OpenAI, L.L.C.",
    category: "AI/ML",
    location: "United States",
    region: "US",
    purpose: "Optional LLM inference (failover; disabled by default)",
    dataCategories: "Redacted operational metrics if enabled",
    retention: "30 days zero-retention via API; not used for training",
    dpa: "Signed (SCCs, OpenAI Business DPA)",
    safeguards: "SCCs, zero-data-retention configuration, opt-in per organization",
  },
  {
    name: "Anthropic, PBC",
    category: "AI/ML",
    location: "United States",
    region: "US",
    purpose: "Optional LLM inference (failover; disabled by default)",
    dataCategories: "Redacted operational metrics if enabled",
    retention: "Not retained for training; 30-day operational logs",
    dpa: "Signed (SCCs, Anthropic DPA)",
    safeguards: "SCCs, no training on customer data, opt-in per organization",
  },
  {
    name: "Stripe, Inc.",
    category: "Payments",
    location: "Ireland (EU) / United States",
    region: "EU/US",
    purpose: "Payment processing, subscription management, invoicing",
    dataCategories: "Billing contact, payment method tokens (no card data stored by us)",
    retention: "Per Stripe retention policy",
    dpa: "Signed (SCCs, Stripe DPA)",
    safeguards: "PCI DSS Level 1, SCCs, tokenized payment data",
  },
  {
    name: "Resend, Inc.",
    category: "Email",
    location: "United States",
    region: "US",
    purpose: "Transactional email (password reset, alerts, weekly briefs, invites)",
    dataCategories: "Email address, message content (operational notifications only)",
    retention: "30-day delivery logs",
    dpa: "Signed (SCCs, Resend DPA)",
    safeguards: "SCCs, TLS in transit, SPF/DKIM/DMARC enforced",
  },
  {
    name: "Sentry (Functional Software, Inc.)",
    category: "Observability",
    location: "EU (Frankfurt) / United States",
    region: "EU/US",
    purpose: "Application error tracking and performance monitoring",
    dataCategories: "Error stack traces with PII scrubbing applied",
    retention: "90 days",
    dpa: "Signed (SCCs, Sentry DPA)",
    safeguards: "SCCs, scrubbing rules for PII, EU region for ingest",
  },
];

const regionColor = (r: Subprocessor["region"]) =>
  r === "EU"
    ? "border-green-500/30 text-green-500"
    : r === "EU/US"
    ? "border-yellow-500/30 text-yellow-500"
    : "border-orange-500/30 text-orange-500";

const Subprocessors = () => (
  <div className="min-h-dvh bg-background">
    <header className="border-b border-border/30 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="container mx-auto px-6 h-14 flex items-center">
        <Link to="/"><img src={logo} alt="Quantivis Global" className="h-8" /></Link>
      </div>
    </header>
    <main className="container mx-auto px-6 py-12 max-w-5xl">
      <h1 className="text-3xl font-bold font-display mb-2">Sub-processor Registry</h1>
      <p className="text-muted-foreground text-sm mb-1">Last reviewed: May 26, 2026 · Version 2026.2</p>
      <p className="text-muted-foreground text-sm mb-6">
        Sub-processors used by {CONTACT.companyLegal} to deliver the service. Each entry includes
        purpose, data categories, retention, signed Art. 28 DPA status, and technical safeguards.
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        <Badge variant="outline" className="border-green-500/30 text-green-500">EU-only: 3</Badge>
        <Badge variant="outline" className="border-yellow-500/30 text-yellow-500">EU/US (SCCs): 3</Badge>
        <Badge variant="outline" className="border-orange-500/30 text-orange-500">US (SCCs): 3</Badge>
        <Badge variant="outline">100% DPAs signed</Badge>
        <Badge variant="outline">30-day change notice</Badge>
      </div>

      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr className="border-b border-border/30">
                <th className="text-left py-2.5 px-3 font-semibold">Sub-processor</th>
                <th className="text-left py-2.5 px-3 font-semibold">Category</th>
                <th className="text-left py-2.5 px-3 font-semibold">Region</th>
                <th className="text-left py-2.5 px-3 font-semibold">Purpose</th>
                <th className="text-left py-2.5 px-3 font-semibold">Data Categories</th>
                <th className="text-left py-2.5 px-3 font-semibold">Retention</th>
                <th className="text-left py-2.5 px-3 font-semibold">DPA</th>
                <th className="text-left py-2.5 px-3 font-semibold">Safeguards</th>
              </tr>
            </thead>
            <tbody>
              {SUBPROCESSORS.map((sp) => (
                <tr key={sp.name} className="border-b border-border/20 hover:bg-muted/20">
                  <td className="py-3 px-3 align-top">
                    <div className="font-medium text-foreground">{sp.name}</div>
                    <div className="text-muted-foreground/60 text-[10px] mt-0.5">{sp.location}</div>
                  </td>
                  <td className="py-3 px-3 align-top text-muted-foreground">{sp.category}</td>
                  <td className="py-3 px-3 align-top">
                    <Badge variant="outline" className={`text-[10px] ${regionColor(sp.region)}`}>
                      {sp.region}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 align-top text-muted-foreground max-w-[180px]">{sp.purpose}</td>
                  <td className="py-3 px-3 align-top text-muted-foreground max-w-[160px]">{sp.dataCategories}</td>
                  <td className="py-3 px-3 align-top text-muted-foreground max-w-[140px]">{sp.retention}</td>
                  <td className="py-3 px-3 align-top text-muted-foreground max-w-[140px]">{sp.dpa}</td>
                  <td className="py-3 px-3 align-top text-muted-foreground max-w-[180px]">{sp.safeguards}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10 text-sm">
        <section>
          <h2 className="text-base font-semibold mb-2">Data Residency</h2>
          <p className="text-muted-foreground leading-relaxed">
            All primary data storage (databases, object storage, backups) is located within the
            European Union. Data transferred to sub-processors outside the EU is protected by
            Standard Contractual Clauses (SCCs) approved by the European Commission and, where
            applicable, supplementary measures (encryption, pseudonymization, PII redaction).
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold mb-2">Change Notification</h2>
          <p className="text-muted-foreground leading-relaxed">
            We provide 30 days' advance notice before adding or replacing a material
            sub-processor. To subscribe to updates, email{" "}
            <a href={`mailto:${CONTACT.email.dpo}`} className="text-primary hover:underline">
              {CONTACT.email.dpo}
            </a>. Customers may object on legitimate data-protection grounds.
          </p>
        </section>
      </div>

      <section className="mt-8 text-sm">
        <h2 className="text-base font-semibold mb-2">Contact</h2>
        <p className="text-muted-foreground">
          Data Protection Officer:{" "}
          <a href={`mailto:${CONTACT.email.dpo}`} className="text-primary hover:underline">
            {CONTACT.email.dpo}
          </a>
          {" · "}
          Legal:{" "}
          <a href={`mailto:${CONTACT.email.legal}`} className="text-primary hover:underline">
            {CONTACT.email.legal}
          </a>
        </p>
      </section>
    </main>
  </div>
);

export default Subprocessors;

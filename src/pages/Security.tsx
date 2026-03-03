import { Link } from "react-router-dom";
import { useState } from "react";
import {
  Shield, Lock, Eye, Database, FileCheck, Users, Server,
  KeyRound, ScrollText, Globe, AlertTriangle, CheckCircle2,
  ArrowRight, Fingerprint, Network, ShieldCheck, ChevronDown,
  Terminal, HardDrive, Clock
} from "lucide-react";
import logo from "@/assets/quantivis-logo.png";

const HERO_STATS = [
  { value: "AES-256", label: "Encryption at Rest" },
  { value: "TLS 1.3", label: "Encryption in Transit" },
  { value: "100%", label: "Tables with RLS" },
  { value: "MFA", label: "Enforced Authentication" },
];

const PILLARS = [
  {
    icon: Server,
    title: "Infrastructure Security",
    description: "Enterprise-grade hosting on SOC 2 Type II certified infrastructure, automated backups, and network isolation.",
    items: [
      "All data encrypted at rest (AES-256) and in transit (TLS 1.3)",
      "Automated encrypted backups with point-in-time recovery",
      "Environment variables and secrets stored in encrypted vaults",
      "Service role keys never exposed to client-side code",
      "DDoS protection and network-level firewalling",
      "Infrastructure hosted in EU-compliant data centers",
    ],
  },
  {
    icon: KeyRound,
    title: "Authentication & Access Control",
    description: "Multi-layered authentication with mandatory MFA and strict role-based access control.",
    items: [
      "Multi-factor authentication (MFA) enforced at route level (AAL2)",
      "Password strength validation with breach database checking (HaveIBeenPwned)",
      "JWT-based session management with automatic token refresh",
      "Role-based access: Owner, Admin, Executive, Analyst, Viewer",
      "Least-privilege enforcement — viewers cannot access strategic data",
      "Secure password reset flow with expiring, single-use tokens",
    ],
  },
  {
    icon: Database,
    title: "Multi-Tenant Data Isolation",
    description: "Complete organizational data separation enforced at the database layer — not the application layer.",
    items: [
      "Row-Level Security (RLS) policies on every table without exception",
      "All queries scoped to organization_id at the database level",
      "No cross-organization data access is architecturally possible",
      "Organization membership verified on every API request",
      "Edge functions validate JWT + org membership before processing",
      "Strategic tables restricted to leadership roles (Owner/Admin/Executive)",
    ],
  },
  {
    icon: ScrollText,
    title: "Immutable Audit Trail",
    description: "Every action is logged, timestamped, and attributed. Logs cannot be altered or deleted — even by administrators.",
    items: [
      "Comprehensive audit_log with actor, action, resource, and payload",
      "No UPDATE or DELETE policies on audit tables — immutable by design",
      "IP address and user ID recorded for every action",
      "Decision ledger tracks predict → decide → execute → measure lifecycle",
      "Calibration history preserves AI confidence evolution over time",
      "Full data export available for compliance and portability (GDPR Art. 20)",
    ],
  },
  {
    icon: Eye,
    title: "AI Data Governance",
    description: "Your data is yours. We do not train our models on client data. Third-party AI processing is scoped and stateless.",
    items: [
      "Client data is never used to train or fine-tune Quantivis models",
      "All AI outputs include confidence scores and attribution explanations",
      "Cognitive bias detection monitors AI recommendation quality",
      "No cross-organization learning without explicit opt-in",
      "AI explanations stored with full feature attribution for auditability",
      "Counterfactual analysis provides transparency into AI reasoning",
    ],
  },
  {
    icon: FileCheck,
    title: "Compliance & Legal Framework",
    description: "Built for GDPR, with a comprehensive legal framework covering data processing, retention, and sub-processor disclosure.",
    items: [
      "Data Processing Agreement (DPA) available for all enterprise customers",
      "GDPR-compliant account deletion with full data purge across 25+ tables",
      "Data retention policies with configurable freshness controls",
      "Sub-processor disclosure with contractual data protection obligations",
      "Automated data export for Subject Access Requests (SAR)",
      "Cookie policy limited to essential session cookies — no tracking",
    ],
  },
];

const ROLE_MATRIX = [
  { role: "Owner", strategic: true, metrics: true, config: true, audit: true, team: true },
  { role: "Admin", strategic: true, metrics: true, config: true, audit: true, team: true },
  { role: "Executive", strategic: true, metrics: true, config: false, audit: false, team: false },
  { role: "Analyst", strategic: false, metrics: true, config: false, audit: false, team: false },
  { role: "Viewer", strategic: false, metrics: false, config: false, audit: false, team: false },
];

const CERTIFICATIONS = [
  { icon: ShieldCheck, title: "SOC 2 Type II", subtitle: "Infrastructure Provider", status: "Audit Planned" },
  { icon: Globe, title: "GDPR", subtitle: "Data Protection", status: "Compliant" },
  { icon: Fingerprint, title: "MFA (AAL2)", subtitle: "Authentication", status: "Enforced" },
  { icon: Network, title: "RLS", subtitle: "Data Isolation", status: "100% Coverage" },
];

const PROOF_ITEMS = [
  { icon: Database, claim: "RLS enforced on 100% of tables", detail: "Every table in the public schema has Row-Level Security enabled with RESTRICTIVE policies scoped to organization_id." },
  { icon: Shield, claim: "Org isolation via organization_id policies", detail: "All queries are scoped at the PostgreSQL layer — application code cannot bypass isolation." },
  { icon: Terminal, claim: "Service role key never shipped to client", detail: "Client bundle only contains the anon key. Service role keys exist exclusively in encrypted Edge Function secrets." },
  { icon: Lock, claim: "Edge functions authenticated + least-privileged", detail: "Every Edge Function validates JWT auth and verifies organization membership before processing any request." },
  { icon: HardDrive, claim: "Audit logs are append-only", detail: "No UPDATE or DELETE RLS policies exist on the audit_log table — records are immutable by design." },
  { icon: Users, claim: "Strategic data restricted to leadership", detail: "Tables like decision_ledger and advisory_instances use RESTRICTIVE policies limiting access to Owner, Admin, and Executive roles." },
];

const SECURITY_FAQ = [
  { q: "Is Quantivis SOC 2 certified?", a: "Our infrastructure provider holds SOC 2 Type II certification. Quantivis has aligned its application-level controls to SOC 2 standards — including RLS enforcement, immutable audit logging, MFA, and encrypted secrets management. A formal SOC 2 Type II audit for Quantivis as an entity is planned." },
  { q: "Where is my data stored?", a: "All data is stored in managed PostgreSQL databases hosted in SOC 2 and ISO 27001 certified data centers. Encryption at rest uses AES-256. Backups are automated and encrypted." },
  { q: "Can Quantivis employees access my data?", a: "No. All data access is scoped by organization_id at the database layer via Row-Level Security. Administrative access to infrastructure is limited to a small team with MFA and audit logging." },
  { q: "How do you handle a security breach?", a: "We follow GDPR Article 33 requirements: affected customers are notified within 72 hours where required by applicable law. Our incident response process includes containment, forensic investigation, customer communication, and post-incident review." },
  { q: "What happens when I delete my account?", a: "A secure Edge Function performs atomic deletion or anonymization across 25+ tables (metrics, advisories, audit logs, decisions, copilot sessions, etc.) and purges your record from the authentication system." },
  { q: "Do you train AI models on my data?", a: "No. Client data is never used to train, fine-tune, or improve Quantivis models. AI features use third-party inference APIs (e.g. Google Gemini) in stateless, per-request mode — no data is retained by the provider after processing." },
  { q: "How is MFA enforced?", a: "MFA is enforced at the route level using AAL2 (Authenticator Assurance Level 2). Users must complete a second-factor challenge to access protected pages. TOTP-based authenticator apps are supported." },
  { q: "Can I get a DPA or subprocessor list?", a: "Yes. Our Data Processing Agreement (DPA), subprocessor list, data retention policy, and privacy policy are all publicly available and linked from this page." },
];

const Security = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  return (
  <div className="min-h-screen bg-background">
    {/* Header */}
    <header className="border-b border-border/30 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="container mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/"><img src={logo} alt="Quantivis Global" className="h-8" /></Link>
        <div className="flex items-center gap-4">
          <Link to="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">Privacy</Link>
          <Link to="/dpa" className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">DPA</Link>
          <Link to="/register" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all">
            Start Free Trial
          </Link>
        </div>
      </div>
    </header>

    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container mx-auto px-6 pt-20 pb-16 relative">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-6">
              <Shield className="w-3.5 h-3.5" />
              Enterprise Security Architecture
            </div>
            <h1 className="text-4xl md:text-5xl font-bold font-display mb-4 tracking-tight">
              Security Built for<br />
              <span className="text-primary">Decision Governance</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Quantivis enforces strict least-privilege role separation, immutable audit trails,
              and database-level data isolation. Every forecast is auditable. Every decision is traceable.
              No data leaves your organization without consent.
            </p>
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              Last reviewed: March 3, 2026
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 text-center">
                <div className="text-xl font-bold font-display text-primary mb-1">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance badges */}
      <section className="border-y border-border/30 bg-card/20">
        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {CERTIFICATIONS.map((cert) => (
              <div key={cert.title} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <cert.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{cert.title}</div>
                  <div className="text-xs text-muted-foreground">{cert.subtitle} · <span className="text-success">{cert.status}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Pillars */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-2xl md:text-3xl font-bold font-display mb-3">Six Pillars of Enterprise Security</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Security is not a feature — it's the architecture. Every layer is designed to protect
            strategic intelligence from unauthorized access.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="rounded-xl border border-border/50 bg-card/50 p-6 hover:border-primary/30 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <pillar.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{pillar.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{pillar.description}</p>
              <ul className="space-y-2">
                {pillar.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-foreground/80">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Role-Based Access Matrix */}
      <section className="border-y border-border/30 bg-card/20">
        <div className="container mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold font-display mb-3">Role-Based Access Matrix</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Least-privilege enforcement ensures each role only accesses what's necessary.
              Strategic intelligence is restricted to leadership by default.
            </p>
          </div>

          <div className="max-w-3xl mx-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold">Role</th>
                  <th className="text-center py-3 px-4 font-semibold">Strategic Decisions</th>
                  <th className="text-center py-3 px-4 font-semibold">Business Metrics</th>
                  <th className="text-center py-3 px-4 font-semibold">Data Sources</th>
                  <th className="text-center py-3 px-4 font-semibold">Audit Logs</th>
                  <th className="text-center py-3 px-4 font-semibold">Team Mgmt</th>
                </tr>
              </thead>
              <tbody>
                {ROLE_MATRIX.map((row) => (
                  <tr key={row.role} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium">{row.role}</td>
                    {[row.strategic, row.metrics, row.config, row.audit, row.team].map((access, i) => (
                      <td key={i} className="text-center py-3 px-4">
                        {access ? (
                          <CheckCircle2 className="w-4 h-4 text-success mx-auto" />
                        ) : (
                          <Lock className="w-4 h-4 text-muted-foreground/40 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Data Commitment */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold font-display mb-3">Our Data Commitment</h2>
            <p className="text-muted-foreground">
              Clear, unambiguous commitments to how we handle your data.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Shield, title: "No model training on your data", desc: "Your business data is never used to train or fine-tune Quantivis models. Third-party AI inference is stateless and per-request." },
              { icon: Database, title: "Complete data isolation", desc: "Organization data is siloed at the database layer. No cross-org queries are architecturally possible." },
              { icon: Lock, title: "You own your data", desc: "Export all data at any time. Delete your account and all data is purged across 25+ tables within 30 days." },
              { icon: AlertTriangle, title: "Breach notification", desc: "In the unlikely event of a breach, affected customers are notified within 72 hours where required by applicable law." },
              { icon: Users, title: "No cross-org learning", desc: "Insights, patterns, and intelligence from one organization are never shared with another without explicit consent." },
              { icon: ScrollText, title: "Immutable decision history", desc: "Decision logs, calibration data, and audit trails cannot be altered retroactively — not even by administrators." },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-border/50 bg-card/50 p-5 flex gap-4">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vulnerability Disclosure */}
      <section className="border-t border-border/30 bg-card/20">
        <div className="container mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-xl font-bold font-display mb-3">Responsible Disclosure</h2>
            <p className="text-sm text-muted-foreground mb-6">
              We maintain a public <code className="bg-muted px-1.5 py-0.5 rounded text-xs">security.txt</code> policy
              for responsible vulnerability reporting. If you discover a security issue, please report it to{" "}
              <a href="mailto:security@quantivis.io" className="text-primary hover:underline">security@quantivis.io</a>.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/dpa"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                Data Processing Agreement <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/privacy"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                Privacy Policy <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/subprocessors"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                Subprocessors <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Proof */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold font-display mb-3">Verifiable Security Controls</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Not marketing claims — architecture facts. Every statement below is enforced
            by database policies, not application code.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {PROOF_ITEMS.map((item) => (
            <div key={item.claim} className="rounded-xl border border-primary/20 bg-primary/5 p-5 group hover:border-primary/40 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">{item.claim}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Security FAQ */}
      <section className="border-y border-border/30 bg-card/20">
        <div className="container mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold font-display mb-3">Security FAQ</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Common questions from security reviewers and procurement teams.
            </p>
          </div>
          <div className="max-w-3xl mx-auto space-y-2">
            {SECURITY_FAQ.map((item, index) => (
              <div key={index} className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <span className="text-sm font-semibold pr-4">{item.q}</span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${openFaq === index ? "rotate-180" : ""}`} />
                </button>
                {openFaq === index && (
                  <div className="px-4 pb-4 pt-0">
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What We Can Provide */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-8">
            <h2 className="text-xl font-bold font-display mb-2">Enterprise Security Pack</h2>
            <p className="text-sm text-muted-foreground mb-6">Available on request for procurement and security review teams.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                "Data Processing Agreement (DPA)",
                "RLS policy summary & architecture overview",
                "Role-based access control matrix",
                "Incident response procedure",
                "Subprocessor list with safeguards",
                "Data retention & deletion policy",
                "AI governance & third-party processing disclosure",
                "Security questionnaire responses (SIG Lite / CAIQ)",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Link
                to="/security-questionnaire"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all"
              >
                View Security Questionnaire <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="mailto:security@quantivis.io?subject=Enterprise%20Security%20Pack%20Request"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                Request Custom Pack
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold font-display mb-3">Ready to see enterprise-grade security in action?</h2>
          <p className="text-muted-foreground mb-6">
            Start your 14-day free trial. No credit card required. Full security from day one.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              to="/register"
              className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:brightness-110 transition-all"
            >
              Start Free Trial
            </Link>
            <a
              href="mailto:security@quantivis.io"
              className="px-6 py-3 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              Contact Security Team
            </a>
          </div>
        </div>
      </section>
    </main>

    {/* Minimal footer */}
    <footer className="border-t border-border/30 py-8">
      <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Quantivis Global. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <Link to="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
          <Link to="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
          <Link to="/dpa" className="text-xs text-muted-foreground hover:text-foreground transition-colors">DPA</Link>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Home</Link>
        </div>
      </div>
    </footer>
  </div>
  );
};

export default Security;

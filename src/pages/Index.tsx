import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/**
 * Quantivis homepage — enterprise B2B for COOs & Compliance Officers (DACH).
 * Palette: navy #1E2761, accent #3D5AFE, white. No gradients, no animations.
 */

const NAVY = "#1E2761";
const ACCENT = "#3D5AFE";

const Nav = () => (
  <header className="border-b border-white/10" style={{ backgroundColor: NAVY }}>
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
      <Link to="/" className="font-serif text-xl tracking-tight text-white">
        Quantivis
      </Link>
      <nav className="hidden gap-8 text-sm text-white/80 md:flex">
        <a href="#platform" className="hover:text-white">Platform</a>
        <a href="#pricing" className="hover:text-white">Pricing</a>
        <Link to="/trust-center" className="hover:text-white">Security</Link>
        <Link to="/api-docs" className="hover:text-white">Docs</Link>
      </nav>
      <a
        href="#demo"
        className="rounded-sm border border-white/40 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white hover:text-[#1E2761]"
      >
        Request Demo
      </a>
    </div>
  </header>
);

const Hero = () => (
  <section style={{ backgroundColor: NAVY }} className="text-white">
    <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
      <p className="mb-8 text-xs font-medium uppercase tracking-[0.2em] text-white/60">
        EU AI Act · Decision Governance
      </p>
      <h1 className="max-w-4xl font-serif text-4xl leading-[1.15] tracking-tight md:text-6xl">
        Every AI decision your organisation makes needs an audit trail.
        Quantivis creates it automatically.
      </h1>
      <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/75">
        Log decisions. Attach evidence. Track outcomes. Know what worked and why
        — with a governance score on every recommendation.
      </p>
      <div className="mt-10 flex flex-wrap items-center gap-6">
        <a
          href="#demo"
          className="inline-flex items-center rounded-sm px-6 py-3 text-sm font-semibold text-white"
          style={{ backgroundColor: ACCENT }}
        >
          Request a Demo
        </a>
        <a
          href="#platform"
          className="inline-flex items-center gap-2 text-sm font-medium text-white hover:opacity-80"
        >
          See the platform <ArrowRight className="h-4 w-4" />
        </a>
      </div>
      <div className="mt-16 flex h-72 items-center justify-center border border-white/10 bg-white/[0.04] md:h-96">
        <span className="text-xs uppercase tracking-[0.2em] text-white/40">
          Decision Ledger · Live platform
        </span>
      </div>
    </div>
  </section>
);

const Problem = () => {
  const rows = [
    "Who approved this decision, and what evidence did they have?",
    "What outcome did we predict, and what actually happened?",
    "Did our AI recommendation perform better than human judgment?",
  ];
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <p className="mb-6 text-xs font-medium uppercase tracking-[0.2em] text-[#1E2761]/60">
          The Problem
        </p>
        <h2 className="max-w-4xl font-serif text-3xl leading-tight tracking-tight text-[#1E2761] md:text-5xl">
          Your organisation runs on decisions. But when a decision fails, can
          you answer these?
        </h2>
        <div className="mt-16 border-t border-[#1E2761]/15">
          {rows.map((r) => (
            <div
              key={r}
              className="border-b border-[#1E2761]/15 py-8 font-serif text-xl text-[#1E2761] md:text-2xl"
            >
              {r}
            </div>
          ))}
        </div>
        <p className="mt-10 max-w-3xl font-serif text-lg italic text-[#1E2761]/70">
          Most organisations cannot answer any of these — and under the EU AI
          Act, that gap is a compliance liability.
        </p>
      </div>
    </section>
  );
};

const HowItWorks = () => {
  const steps = [
    {
      n: "01",
      t: "Log",
      d: "Record every strategic decision with confidence level, expected outcome, and supporting evidence. Takes 90 seconds.",
    },
    {
      n: "02",
      t: "Govern",
      d: "Every AI recommendation is scored for quality, evidence strength, and alignment with past outcomes. The audit trail is automatic.",
    },
    {
      n: "03",
      t: "Learn",
      d: "When outcomes arrive, the system compares prediction vs reality. Confidence scores self-correct. Every future recommendation improves.",
    },
  ];
  return (
    <section className="bg-[#F5F6F8]">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <p className="mb-6 text-xs font-medium uppercase tracking-[0.2em] text-[#1E2761]/60">
          How it works
        </p>
        <h2 className="max-w-3xl font-serif text-3xl leading-tight tracking-tight text-[#1E2761] md:text-5xl">
          Three steps. One governance record.
        </h2>
        <div className="mt-16 grid gap-12 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="border-t border-[#1E2761]/20 pt-6">
              <div className="font-serif text-2xl text-[#3D5AFE]">{s.n}</div>
              <div className="mt-3 font-serif text-2xl text-[#1E2761]">{s.t}</div>
              <p className="mt-4 text-base leading-relaxed text-[#1E2761]/75">
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Platform = () => {
  const cards = [
    {
      t: "Decision Ledger",
      d: "A permanent, auditable record of every decision. Searchable, exportable, board-defensible.",
    },
    {
      t: "Governance Score",
      d: "Every recommendation receives an evidence score, confidence rating, and risk flag. Reviewers see the reasoning, not just the conclusion.",
    },
    {
      t: "Outcome Intelligence",
      d: "Track what AI predicted against what happened. The system recalibrates automatically.",
    },
  ];
  return (
    <section id="platform" className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <p className="mb-6 text-xs font-medium uppercase tracking-[0.2em] text-[#1E2761]/60">
          The Platform
        </p>
        <h2 className="max-w-3xl font-serif text-3xl leading-tight tracking-tight text-[#1E2761] md:text-5xl">
          Built for the decisions that matter.
        </h2>
        <div className="mt-16 grid gap-10 md:grid-cols-3">
          {cards.map((c) => (
            <div key={c.t} className="border-t-2 border-[#3D5AFE] pt-6">
              <h3 className="font-serif text-2xl text-[#1E2761]">{c.t}</h3>
              <p className="mt-4 text-base leading-relaxed text-[#1E2761]/75">
                {c.d}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const EUAIAct = () => {
  const left = [
    "Article 9 — Risk management",
    "Article 13 — Transparency",
    "Article 14 — Human oversight",
  ];
  const right = [
    "Automated audit trail",
    "Evidence chain per decision",
    "Board-ready governance reports",
  ];
  return (
    <section style={{ backgroundColor: NAVY }} className="text-white">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <p className="mb-6 text-xs font-medium uppercase tracking-[0.2em] text-white/60">
          Compliance
        </p>
        <h2 className="max-w-4xl font-serif text-3xl leading-tight tracking-tight md:text-5xl">
          The EU AI Act requires documented decision trails. Quantivis provides
          them.
        </h2>
        <div className="mt-16 grid gap-12 md:grid-cols-2">
          <ul className="space-y-4 border-t border-white/20 pt-6">
            {left.map((x) => (
              <li key={x} className="font-serif text-lg text-white/90">{x}</li>
            ))}
          </ul>
          <ul className="space-y-4 border-t border-white/20 pt-6">
            {right.map((x) => (
              <li key={x} className="font-serif text-lg text-white/90">{x}</li>
            ))}
          </ul>
        </div>
        <div className="mt-12">
          <Link
            to="/eu-ai-act"
            className="inline-flex items-center gap-2 rounded-sm border border-white px-6 py-3 text-sm font-medium text-white hover:bg-white hover:text-[#1E2761]"
          >
            Read our EU AI Act compliance guide <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

const Pricing = () => {
  const plans = [
    {
      name: "Essentials",
      price: "€499",
      cadence: "/month",
      seats: "5 seats",
      features: [
        "Decision ledger",
        "Governance scoring",
        "EU AI Act documentation",
      ],
      cta: "Get started",
      featured: false,
    },
    {
      name: "Governance",
      price: "€1,999",
      cadence: "/month",
      seats: "15 seats",
      features: [
        "Everything in Essentials",
        "Causal inference",
        "Outcome learning",
        "Advanced reporting",
      ],
      cta: "Request demo",
      featured: true,
    },
    {
      name: "Enterprise",
      price: "From €6,500",
      cadence: "/month",
      seats: "Custom seats",
      features: [
        "Everything in Governance",
        "On-premise deployment",
        "Onboarding programme",
        "Service Level Agreement",
      ],
      cta: "Contact sales",
      featured: false,
    },
  ];
  return (
    <section id="pricing" className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <p className="mb-6 text-xs font-medium uppercase tracking-[0.2em] text-[#1E2761]/60">
          Pricing
        </p>
        <h2 className="max-w-3xl font-serif text-3xl leading-tight tracking-tight text-[#1E2761] md:text-5xl">
          Straightforward pricing. No hidden costs.
        </h2>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`flex flex-col border p-8 ${
                p.featured
                  ? "border-[#3D5AFE] border-2"
                  : "border-[#1E2761]/20"
              }`}
            >
              {p.featured && (
                <div
                  className="mb-4 inline-block self-start px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white"
                  style={{ backgroundColor: ACCENT }}
                >
                  Featured
                </div>
              )}
              <h3 className="font-serif text-2xl text-[#1E2761]">{p.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-serif text-4xl text-[#1E2761]">{p.price}</span>
                <span className="text-sm text-[#1E2761]/60">{p.cadence}</span>
              </div>
              <p className="mt-2 text-sm text-[#1E2761]/70">{p.seats}</p>
              <ul className="mt-6 flex-1 space-y-3 border-t border-[#1E2761]/15 pt-6 text-sm text-[#1E2761]/80">
                {p.features.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
              <a
                href="#demo"
                className={`mt-8 inline-flex items-center justify-center rounded-sm px-5 py-3 text-sm font-semibold ${
                  p.featured
                    ? "text-white"
                    : "border border-[#1E2761] text-[#1E2761] hover:bg-[#1E2761] hover:text-white"
                }`}
                style={p.featured ? { backgroundColor: ACCENT } : undefined}
              >
                {p.cta}
              </a>
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm text-[#1E2761]/60">
          All plans include a 30-day pilot period. No long-term commitment required.
        </p>
      </div>
    </section>
  );
};

const Demo = () => (
  <section id="demo" style={{ backgroundColor: NAVY }} className="text-white">
    <div className="mx-auto max-w-4xl px-6 py-24 md:py-32">
      <h2 className="font-serif text-3xl leading-tight tracking-tight md:text-5xl">
        See Quantivis running on your data.
      </h2>
      <p className="mt-6 text-lg leading-relaxed text-white/75">
        We run a live demo using a dataset from your industry. You leave with a
        working governance record, not a slide deck.
      </p>
      <div className="mt-10">
        <a
          href="mailto:hello@quantivis.io?subject=Demo%20request"
          className="inline-flex items-center rounded-sm px-6 py-3 text-sm font-semibold text-white"
          style={{ backgroundColor: ACCENT }}
        >
          Request a Demo
        </a>
      </div>
      <p className="mt-8 text-sm text-white/60">hello@quantivis.io · Germany</p>
    </div>
  </section>
);

const SiteFooter = () => {
  const cols: { title: string; links: { label: string; to: string }[] }[] = [
    {
      title: "Platform",
      links: [
        { label: "Decision Ledger", to: "/decisions" },
        { label: "Governance Score", to: "/governance" },
        { label: "Outcome Intelligence", to: "/outcomes" },
        { label: "Pricing", to: "/#pricing" },
      ],
    },
    {
      title: "Enterprise Trust",
      links: [
        { label: "Trust Center", to: "/trust-center" },
        { label: "EU AI Act", to: "/eu-ai-act" },
        { label: "Security", to: "/security" },
        { label: "DPIA", to: "/dpia" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Impressum", to: "/impressum" },
        { label: "Privacy", to: "/privacy" },
        { label: "Terms", to: "/terms" },
        { label: "Cookies", to: "/cookie-policy" },
      ],
    },
    {
      title: "Get Started",
      links: [
        { label: "Request Demo", to: "/#demo" },
        { label: "Contact", to: "mailto:hello@quantivis.io" },
        { label: "Docs", to: "/api-docs" },
      ],
    },
  ];
  return (
    <footer className="border-t border-[#1E2761]/15 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-5">
          <div className="md:col-span-1">
            <div className="font-serif text-xl text-[#1E2761]">Quantivis</div>
            <p className="mt-3 text-sm text-[#1E2761]/70">
              Enterprise decision governance.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#1E2761]">
                {c.title}
              </h4>
              <ul className="mt-4 space-y-2 text-sm text-[#1E2761]/70">
                {c.links.map((l) => (
                  <li key={l.label}>
                    {l.to.startsWith("mailto:") || l.to.startsWith("/#") ? (
                      <a href={l.to} className="hover:text-[#3D5AFE]">{l.label}</a>
                    ) : (
                      <Link to={l.to} className="hover:text-[#3D5AFE]">{l.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 border-t border-[#1E2761]/15 pt-6 text-xs text-[#1E2761]/60">
          © 2026 Quantivis Global. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

const Index = forwardRef<HTMLDivElement>((_, ref) => (
  <div ref={ref} className="min-h-dvh bg-white font-sans">
    <Nav />
    <main id="main-content">
      <Hero />
      <Problem />
      <HowItWorks />
      <Platform />
      <EUAIAct />
      <Pricing />
      <Demo />
    </main>
    <SiteFooter />
  </div>
));

Index.displayName = "Index";
export default Index;

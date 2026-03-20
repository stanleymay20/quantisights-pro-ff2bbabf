import {
  ArrowRight, ArrowDown, AlertTriangle, Lightbulb, Target, TrendingUp, Shield,
  Users, BarChart3, Rocket, CheckCircle2, Brain, MapPin, Crosshair, Layers, Lock, Database
} from "lucide-react";
import { CONTACT } from "@/lib/contact-config";
import { Link } from "react-router-dom";
import decisionLedgerPreview from "@/assets/decision-ledger-preview.png";

export interface Slide {
  number: number;
  title: string;
  icon: typeof Brain;
  content: React.ReactNode;
}

export const SLIDES: Slide[] = [
  {
    number: 1,
    title: "Cover",
    icon: Rocket,
    content: (
      <div className="text-center">
        <h3 className="text-2xl sm:text-3xl font-bold font-display mb-3">Quantivis</h3>
        <p className="text-primary font-semibold text-lg mb-2">Decision Governance Infrastructure</p>
        <p className="text-xs text-primary/70 font-medium mb-4">AI platform for tracking, calibrating, and improving strategic decisions</p>
        <p className="text-muted-foreground">
          The operating system for strategic decisions — making every executive call traceable, calibrated, and board-defensible.
        </p>
        <div className="mt-6 text-xs text-muted-foreground space-y-1">
          <p>Quantivis Global GmbH · Germany</p>
          <p>hello@quantivis.io · quantivis.io</p>
          <p>Pre-Seed · B2B SaaS · Decision Intelligence</p>
        </div>
      </div>
    ),
  },
  {
    number: 2,
    title: "Problem",
    icon: AlertTriangle,
    content: (
      <div className="space-y-4">
        <p className="text-base sm:text-lg font-semibold text-foreground">Executives make high-stakes decisions with no institutional memory, no calibration, and no audit trail.</p>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-2"><span className="text-destructive font-bold mt-0.5">✕</span> <span><strong className="text-foreground">73% of executives</strong> are systematically overconfident in strategic forecasts (HBR 2023)</span></li>
          <li className="flex items-start gap-2"><span className="text-destructive font-bold mt-0.5">✕</span> <span>No enterprise tool tracks whether past predictions were accurate — or adjusts future confidence</span></li>
          <li className="flex items-start gap-2"><span className="text-destructive font-bold mt-0.5">✕</span> <span>Boards lack defensible decision trails — exposing organizations to governance risk</span></li>
          <li className="flex items-start gap-2"><span className="text-destructive font-bold mt-0.5">✕</span> <span>PE/VC firms can't measure portfolio management quality across companies</span></li>
        </ul>
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-xs font-semibold text-foreground mb-1">Real-World Example</p>
          <p className="text-xs text-muted-foreground">Meta invested $36B+ in the metaverse with no calibrated decision process or outcome tracking. WeWork's $47B valuation collapse had zero governance trail. These aren't outliers — they're systemic.</p>
        </div>
        <div className="p-3 sm:p-4 rounded-lg bg-destructive/5 border border-destructive/20">
          <p className="text-xs sm:text-sm font-semibold text-destructive leading-snug">No enterprise tool closes the loop: Decision → Outcome → Learning</p>
          <p className="text-xs text-muted-foreground mt-1.5">$2.3 Trillion in annual value destruction from ungoverned strategic decisions</p>
          <p className="text-[10px] text-muted-foreground mt-1">Sources: McKinsey, HBR 2023, Gartner Data Quality Report 2022</p>
        </div>
      </div>
    ),
  },
  {
    number: 3,
    title: "Solution",
    icon: Lightbulb,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground mb-4">Quantivis creates a permanent institutional memory for strategic decisions — closing the loop between prediction and outcome.</p>
        
        {/* Decision Loop Visual — mobile-responsive */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-1 text-xs font-semibold py-3">
          {["Decision", "Prediction", "Outcome", "Calibration", "Better Decisions"].map((step, i) => (
            <div key={step} className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-1">
              <span className="px-2.5 py-1.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-center whitespace-nowrap text-[11px] sm:text-xs">{step}</span>
              {i < 4 && (
                <>
                  <ArrowDown className="w-3 h-3 text-muted-foreground sm:hidden" />
                  <ArrowRight className="w-3 h-3 text-muted-foreground hidden sm:block" />
                </>
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-3">
          {[
            { m: "Month 1", t: "Decision Ledger", d: "Log every strategic call with confidence scores, predicted impact, and accountability." },
            { m: "Month 2", t: "Outcome Tracking", d: "Record real results. Measure where forecasts diverged from reality." },
            { m: "Month 3", t: "Calibration Engine", d: "AI adjusts confidence based on track record. Your organization makes measurably better decisions." },
          ].map((s) => (
            <div key={s.m} className="p-3 rounded-lg border border-border bg-card/50">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{s.m}</span>
              <p className="font-semibold text-sm">{s.t}</p>
              <p className="text-xs text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    number: 4,
    title: "Product",
    icon: Brain,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground mb-4">Full-stack Decision Governance platform with 20+ analytical frameworks built for enterprise leadership.</p>
        
        {/* Product Screenshot */}
        <div className="rounded-lg overflow-hidden border border-border shadow-sm">
          <img src={decisionLedgerPreview} alt="Quantivis Decision Ledger — track decisions, predictions, confidence grades, and owners" className="w-full h-auto" />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          {[
            "Monte Carlo Simulation",
            "Bayesian Prior Calibration",
            "DROI & TCI Calculators",
            "Decision Fitness Assessment",
            "Decision Velocity Curve",
            "Cognitive Bias Detection",
            "Free Strategy Diagnosis",
            "Decision Maturity Roadmap",
          ].map((f) => (
            <div key={f} className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
              <span>{f}</span>
            </div>
          ))}
        </div>

        {/* Use Case Example */}
        <div className="mt-3 p-3 rounded-lg border border-border bg-muted/30">
          <p className="text-xs font-semibold text-foreground mb-2">Example: "Should we open 5 stores in France?"</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" /> Probability of success: 67%</div>
            <div className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" /> Confidence calibration: B+</div>
            <div className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" /> 10,000 scenario simulations</div>
            <div className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" /> Board-ready explanation</div>
          </div>
        </div>

        <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
          <p className="text-xs font-semibold text-primary">Evidence Contract: Every recommendation graded A–F with full traceability, assumptions, and risk-if-wrong</p>
        </div>
      </div>
    ),
  },
  {
    number: 5,
    title: "Category Creation",
    icon: Layers,
    content: (
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">Quantivis defines a new software layer that sits between data infrastructure and executive action.</p>

        {/* Category Stack */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">The Enterprise Decision Stack</p>
          {[
            { layer: "Executive Action", tool: "Quantivis", highlight: true, desc: "Decision Governance" },
            { layer: "Analytics & BI", tool: "Tableau / Power BI", highlight: false, desc: "Visualization" },
            { layer: "Data Infrastructure", tool: "Snowflake / Databricks", highlight: false, desc: "Storage & Compute" },
          ].map((l) => (
            <div
              key={l.layer}
              className={`p-3 rounded-lg border flex items-center justify-between ${
                l.highlight
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card/50"
              }`}
            >
              <div>
                <p className={`text-sm font-semibold ${l.highlight ? "text-primary" : "text-foreground"}`}>{l.layer}</p>
                <p className="text-[10px] text-muted-foreground">{l.desc}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${
                l.highlight
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}>{l.tool}</span>
            </div>
          ))}
        </div>

        {/* Positioning */}
        <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
          <p className="text-xs font-semibold text-primary mb-1">The GitHub for Strategic Decisions</p>
          <p className="text-xs text-muted-foreground">Version control for decisions. Track every call, prediction, outcome, and calibration — creating a permanent institutional memory.</p>
        </div>

        <div className="p-3 rounded-lg border border-border bg-muted/30">
          <p className="text-xs font-semibold text-foreground mb-1">Why Now?</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" /> AI governance regulations emerging globally (EU AI Act)</li>
            <li className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" /> Boards demanding traceable decision processes post-SVB, FTX</li>
            <li className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" /> LLMs make calibrated confidence scoring accessible at scale</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    number: 6,
    title: "Market",
    icon: TrendingUp,
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            { l: "TAM", v: "$4.2B", d: "Decision Intelligence (2026)" },
            { l: "CAGR", v: "22%", d: "Growth through 2030" },
            { l: "SAM", v: "$850M", d: "EU enterprise segment" },
            { l: "SOM", v: "$42M", d: "PE/VC + mid-market DACH" },
          ].map((m) => (
            <div key={m.l} className="text-center p-3 rounded-lg border border-border">
              <p className="text-[10px] font-bold text-primary uppercase">{m.l}</p>
              <p className="text-xl font-bold">{m.v}</p>
              <p className="text-[10px] text-muted-foreground">{m.d}</p>
            </div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong className="text-foreground">ICP:</strong> CEO, CFO, COO at 50–5,000 employee companies; PE/VC portfolio managers</p>
          <p><strong className="text-foreground">ACV:</strong> €18K – €72K per organization (usage-based tiers)</p>
        </div>
        <div className="p-2 rounded-lg bg-muted/30 border border-border">
          <p className="text-[10px] text-muted-foreground"><strong className="text-foreground">Sources:</strong> Gartner Decision Intelligence Market Guide 2024 · McKinsey AI Governance Spending Report · Deloitte Enterprise Analytics Budget Survey 2023</p>
        </div>
      </div>
    ),
  },
  {
    number: 7,
    title: "Traction",
    icon: BarChart3,
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            { v: "Live", l: "Production platform deployed" },
            { v: "3", l: "Companies evaluating pilots" },
            { v: "2", l: "PE funds testing portfolio governance" },
            { v: "20+", l: "Decision science frameworks" },
          ].map((t) => (
            <div key={t.l} className="text-center p-3 rounded-lg border border-border">
              <p className="text-2xl font-bold text-primary">{t.v}</p>
              <p className="text-xs text-muted-foreground">{t.l}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> Full platform live — ready for enterprise pilot deployment</div>
          <div className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> Enterprise-grade: RLS on 100% of tables, RBAC, SSO, workspace isolation</div>
          <div className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> Paid pilot model (€5K–€15K) validates demand before full deployment</div>
          <div className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> 15-month seeded demo environment with real decision simulations</div>
        </div>
      </div>
    ),
  },
  {
    number: 8,
    title: "Business Model",
    icon: Target,
    content: (
      <div className="space-y-4">
        <div className="space-y-3">
          {[
            { tier: "Starter", price: "€99/mo", features: "1 org, 1 dataset, core dashboards, CSV uploads, 2 seats — for teams testing decision intelligence" },
            { tier: "Growth", price: "€499/mo", features: "Unlimited datasets, AI advisory, forecasting, Monte Carlo, copilot, calibration, board reports, 10 seats" },
            { tier: "Enterprise", price: "€18K–€72K/yr", features: "Unlimited everything, cognitive bias detection, SSO/RBAC, audit logs, multi-org, scenario war room" },
          ].map((t) => (
            <div key={t.tier} className="p-3 rounded-lg border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">{t.tier}</p>
                <p className="text-xs text-muted-foreground">{t.features}</p>
              </div>
              <p className="font-bold text-primary whitespace-nowrap">{t.price}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Paid pilot (€5K–€15K) de-risks adoption · Usage-based AI compute add-on · PE portfolio pricing available</p>
      </div>
    ),
  },
  {
    number: 9,
    title: "Competitive Landscape",
    icon: Shield,
    content: (
      <div className="space-y-4">
        {/* Named competitor comparison */}
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-xs min-w-[360px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-2 text-muted-foreground font-medium">Capability</th>
                <th className="text-center py-2 px-1.5 font-semibold text-primary">Quantivis</th>
                <th className="text-center py-2 px-1.5 font-semibold">Palantir</th>
                <th className="text-center py-2 px-1.5 font-semibold">Tableau</th>
                <th className="text-center py-2 px-1.5 font-semibold">Mosaic</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                { f: "Decision → Outcome loop", q: true, p: false, t: false, m: false },
                { f: "Calibrated confidence", q: true, p: false, t: false, m: false },
                { f: "Board audit trail", q: true, p: "Partial", t: false, m: false },
                { f: "Bias detection", q: true, p: false, t: false, m: false },
                { f: "Time to insight", q: "5 min", p: "Weeks", t: "Days", m: "Hours" },
                { f: "Monthly cost", q: "€99+", p: "€50K+", t: "€70/u", m: "€800+" },
              ].map((row) => (
                <tr key={row.f} className="border-b border-border/30">
                  <td className="py-1.5 pr-2 font-medium text-foreground">{row.f}</td>
                  {[row.q, row.p, row.t, row.m].map((v, i) => (
                    <td key={i} className={`text-center py-1.5 px-1.5 ${i === 0 ? "bg-primary/5" : ""}`}>
                      {v === true ? <CheckCircle2 className="w-3.5 h-3.5 text-primary mx-auto" /> :
                       v === false ? <span className="text-muted-foreground/30">✕</span> :
                       <span className="text-foreground font-medium">{v}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
          <p className="text-xs font-semibold text-primary">Category: Decision Governance — not BI, not data infra. We own the layer between data and executive action.</p>
        </div>
      </div>
    ),
  },
  {
    number: 10,
    title: "Defensibility & AI Moat",
    icon: Lock,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Quantivis builds compounding defensibility that cannot be replicated by general-purpose AI tools.</p>

        <div className="space-y-3">
          {[
            { icon: Database, title: "Decision Data Accumulation", desc: "Every logged decision, prediction, and outcome trains organization-specific calibration models. Competitors start at zero." },
            { icon: Brain, title: "Calibration Models Improve Over Time", desc: "Bayesian models get smarter with each resolved decision. After 6 months, switching costs become prohibitive." },
            { icon: Users, title: "Organizational Memory Graph", desc: "Decision patterns, bias profiles, and team calibration scores create an irreplaceable institutional knowledge base." },
          ].map((m) => (
            <div key={m.title} className="p-3 rounded-lg border border-border bg-card/50 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <m.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{m.title}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
          <p className="text-xs font-semibold text-primary mb-1">Data Network Effect</p>
          <p className="text-xs text-muted-foreground">The more decisions a company logs, the smarter Quantivis becomes. This creates a compounding moat that general-purpose AI tools like Microsoft Copilot or ChatGPT cannot replicate.</p>
        </div>

        <div className="p-3 rounded-lg border border-border bg-muted/30">
          <p className="text-xs font-semibold text-foreground mb-1">Why not Microsoft Copilot or OpenAI?</p>
          <p className="text-xs text-muted-foreground">General AI assists with tasks. Quantivis governs decisions — tracking predictions against outcomes, calibrating confidence, and building organizational memory. Different layer, different value.</p>
        </div>
      </div>
    ),
  },
  {
    number: 11,
    title: "The Ask",
    icon: Rocket,
    content: (
      <div className="text-center space-y-5">
        <div className="p-5 rounded-xl border border-primary/20 bg-primary/5">
          <p className="text-sm text-muted-foreground mb-2">We're raising</p>
          <p className="text-2xl font-bold text-primary">€500K Pre-Seed</p>
          <p className="text-sm text-muted-foreground mt-2">to close first 10 enterprise customers and reach €150K ARR in 12 months</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-border">
            <p className="font-bold text-lg">40%</p>
            <p className="text-muted-foreground">Product & Engineering</p>
          </div>
          <div className="p-3 rounded-lg border border-border">
            <p className="font-bold text-lg">35%</p>
            <p className="text-muted-foreground">Sales & GTM</p>
          </div>
          <div className="p-3 rounded-lg border border-border">
            <p className="font-bold text-lg">25%</p>
            <p className="text-muted-foreground">Operations</p>
          </div>
        </div>

        {/* GTM Strategy */}
        <div className="text-left p-3 rounded-lg border border-border bg-muted/30">
          <p className="text-xs font-semibold text-foreground mb-2">Go-To-Market Strategy</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-muted-foreground">
            <div className="flex items-start gap-1.5"><Crosshair className="w-3 h-3 text-primary shrink-0 mt-0.5" /> PE portfolio governance deals</div>
            <div className="flex items-start gap-1.5"><Crosshair className="w-3 h-3 text-primary shrink-0 mt-0.5" /> CFO & COO network outreach</div>
            <div className="flex items-start gap-1.5"><Crosshair className="w-3 h-3 text-primary shrink-0 mt-0.5" /> Board risk committee partnerships</div>
            <div className="flex items-start gap-1.5"><Crosshair className="w-3 h-3 text-primary shrink-0 mt-0.5" /> Consulting firm channel partners</div>
          </div>
        </div>

        {/* Founder Story */}
        <div className="text-left p-3 rounded-lg border border-border bg-card/50">
          <p className="text-xs font-semibold text-foreground mb-1">Why I Built This</p>
          <p className="text-xs text-muted-foreground italic">"After building AI systems and working with enterprise data, I saw a major gap: companies track everything — revenue, customers, code — but not the decisions that drive them. Quantivis closes that loop."</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/demo"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:brightness-110 transition-all"
          >
            Try the Demo <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href={`mailto:${CONTACT.email.general}`}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border font-semibold hover:border-primary/30 transition-all"
          >
            Contact Founder
          </a>
        </div>
      </div>
    ),
  },
];

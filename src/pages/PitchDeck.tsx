import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight, AlertTriangle, Lightbulb, Target, TrendingUp, Shield,
  Users, BarChart3, Rocket, Globe, CheckCircle2, Brain, Database,
  Lock, Zap, Download, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/quantivis-logo.png";
import { CONTACT } from "@/lib/contact-config";
import { generatePitchDeckPDF } from "@/lib/pitch-deck-pdf";

interface Slide {
  number: number;
  title: string;
  icon: typeof Brain;
  content: React.ReactNode;
}

const SLIDES: Slide[] = [
  {
    number: 1,
    title: "Cover",
    icon: Rocket,
    content: (
      <div className="text-center">
        <h3 className="text-2xl sm:text-3xl font-bold font-display mb-3">Quantivis</h3>
        <p className="text-primary font-semibold text-lg mb-4">Executive Overconfidence Insurance</p>
        <p className="text-muted-foreground">
          The first Decision Governance platform that makes every strategic call board-defensible.
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
        <p className="text-lg font-semibold text-foreground">73% of executives are systematically overconfident in their strategic forecasts.</p>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-2"><span className="text-destructive font-bold mt-0.5">✕</span> Poor data quality costs organizations <strong className="text-foreground">$12.9M annually</strong> (Gartner 2022)</li>
          <li className="flex items-start gap-2"><span className="text-destructive font-bold mt-0.5">✕</span> <strong className="text-foreground">85% of AI projects fail</strong> due to inadequate data governance (MIT Sloan)</li>
          <li className="flex items-start gap-2"><span className="text-destructive font-bold mt-0.5">✕</span> Ungoverned orgs face <strong className="text-foreground">40% higher operational costs</strong> from data errors (TDWI 2023)</li>
          <li className="flex items-start gap-2"><span className="text-destructive font-bold mt-0.5">✕</span> Analysts spend <strong className="text-foreground">80% of time</strong> on data cleansing instead of analysis</li>
        </ul>
        <div className="mt-4 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
          <p className="text-sm font-semibold text-destructive">$2.3 Trillion in annual value destruction from the "Data-to-Wisdom Gap"</p>
          <p className="text-xs text-muted-foreground mt-1">Sources: McKinsey, HBR 2023, Gartner Data Quality Report 2022</p>
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
        <p className="text-sm text-muted-foreground mb-4">A 90-day path from tracking decisions to measurably better judgment.</p>
        <div className="grid gap-3">
          {[
            { m: "Month 1", t: "Decision Ledger", d: "Log strategic calls with confidence scores and accountability." },
            { m: "Month 2", t: "Outcome Tracking", d: "Record real results. Measure forecast divergence." },
            { m: "Month 3", t: "Calibration Active", d: "AI adjusts confidence based on track record." },
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
        <p className="text-sm text-muted-foreground mb-4">Full-stack Decision Intelligence platform with 20+ analytical frameworks.</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            "Monte Carlo Simulation",
            "Bayesian Prior Calibration",
            "Regret Minimization",
            "Causal Inference Engine",
            "Value of Information",
            "Cognitive Bias Detection",
            "Sensitivity Analysis",
            "Scenario Branching",
          ].map((f) => (
            <div key={f} className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
              <span>{f}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-lg border border-primary/20 bg-primary/5">
          <p className="text-xs font-semibold text-primary">Evidence Contract: Every recommendation graded A–F with traceability, assumptions, and risk-if-wrong</p>
        </div>
      </div>
    ),
  },
  {
    number: 5,
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
        <div className="text-xs text-muted-foreground">
          <p><strong className="text-foreground">ICP:</strong> CEO, CFO, COO at 50–5,000 employee companies; PE/VC portfolio managers</p>
          <p><strong className="text-foreground">ACV:</strong> €18K – €72K per organization (usage-based tiers)</p>
        </div>
      </div>
    ),
  },
  {
    number: 6,
    title: "Traction",
    icon: BarChart3,
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            { v: "236", l: "Automated tests" },
            { v: "50+", l: "Edge functions" },
            { v: "20+", l: "Decision frameworks" },
            { v: "Zero", l: "Security vulnerabilities" },
          ].map((t) => (
            <div key={t.l} className="text-center p-3 rounded-lg border border-border">
              <p className="text-2xl font-bold text-primary">{t.v}</p>
              <p className="text-xs text-muted-foreground">{t.l}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> Full platform live with demo environment (15 months seeded data)</div>
          <div className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> Enterprise-grade: RLS on 100% of tables, RBAC, SSO, GDPR-ready</div>
          <div className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> Multi-tenant architecture with workspace isolation</div>
        </div>
      </div>
    ),
  },
  {
    number: 7,
    title: "Business Model",
    icon: Target,
    content: (
      <div className="space-y-4">
        <div className="space-y-3">
          {[
            { tier: "Starter", price: "€99/mo", features: "1 org, 1 dataset, basic dashboards, CSV uploads, 2 seats" },
            { tier: "Growth", price: "€249/mo", features: "Unlimited datasets, AI advisory, forecasting, Monte Carlo, copilot, calibration, 5 seats" },
            { tier: "Enterprise", price: "Custom", features: "Unlimited everything, cognitive bias detection, SSO/RBAC, audit logs, multi-org, unlimited seats" },
          ].map((t) => (
            <div key={t.tier} className="p-3 rounded-lg border border-border flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{t.tier}</p>
                <p className="text-xs text-muted-foreground">{t.features}</p>
              </div>
              <p className="font-bold text-primary">{t.price}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Enterprise ACV: €18K–€72K annually · Usage-based AI compute add-on · PE portfolio pricing</p>
      </div>
    ),
  },
  {
    number: 8,
    title: "Competitive Edge",
    icon: Shield,
    content: (
      <div className="space-y-3">
        {[
          { us: "Decision Ledger (Decision → Outcome → Learning)", them: "Static dashboards" },
          { us: "Epistemic governance caps AI confidence", them: "Unchecked AI hallucination" },
          { us: "Cost of Delay from real revenue data", them: "Fabricated currency values" },
          { us: "Output classified: Fact vs. Inference vs. AI", them: "Undifferentiated outputs" },
          { us: "236 automated integrity tests", them: "Manual QA" },
        ].map((row) => (
          <div key={row.us} className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-start gap-1.5 p-2 rounded bg-primary/5 border border-primary/10">
              <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />
              <span>{row.us}</span>
            </div>
            <div className="flex items-start gap-1.5 p-2 rounded bg-muted/50 border border-border/50">
              <span className="text-muted-foreground">✕ {row.them}</span>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    number: 9,
    title: "The Ask",
    icon: Rocket,
    content: (
      <div className="text-center space-y-6">
        <div className="p-6 rounded-xl border border-primary/20 bg-primary/5">
          <p className="text-sm text-muted-foreground mb-2">We're looking for</p>
          <p className="text-2xl font-bold text-primary">€500K Pre-Seed</p>
          <p className="text-sm text-muted-foreground mt-2">to acquire first 10 enterprise customers and reach €150K ARR in 12 months</p>
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
            Contact Us
          </a>
        </div>
      </div>
    ),
  },
];

const PitchDeck = () => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await generatePitchDeckPDF();
    } catch (e) {
      console.error("PDF generation failed", e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-2xl">
        <div className="container mx-auto flex items-center justify-between py-4 px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Quantivis" className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
              className="hidden sm:inline-flex"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? "Generating…" : "Download PDF"}
            </Button>
            <Link to="/pitch" className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:border-primary/30 transition-all hidden sm:inline-flex">
              One-Pager
            </Link>
            <Link to="/demo" className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all">
              Live Demo
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6 text-center mb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl sm:text-4xl font-bold font-display mb-3">Pitch Deck</h1>
            <p className="text-muted-foreground mb-6">Scroll through each slide — ready for competition submissions.</p>
            <Button
              onClick={handleDownload}
              disabled={downloading}
              size="lg"
              className="gap-2"
            >
              {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              {downloading ? "Generating PDF…" : "Download Pitch Deck"}
            </Button>
          </motion.div>
        </div>

        <div className="max-w-2xl mx-auto px-6 space-y-6">
          {SLIDES.map((slide) => (
            <motion.div
              key={slide.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              className="rounded-2xl border border-border bg-card p-6 sm:p-8"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <slide.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Slide {slide.number}</p>
                  <p className="font-bold text-sm">{slide.title}</p>
                </div>
              </div>
              {slide.content}
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default PitchDeck;

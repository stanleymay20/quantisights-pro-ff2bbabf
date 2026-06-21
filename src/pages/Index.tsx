import { forwardRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, Shield, TrendingUp, AlertCircle, Globe } from "lucide-react";
import heroVideoAsset from "@/assets/hero-video.mp4.asset.json";

const NAVY = "#1E2761";
const DEEP = "#0E1628";
const ACCENT = "#3D5AFE";
const MUTED = "#F4F6F9";
const SLATE = "#64748B";

const DECISIONS = [
  { id: "DL-2847", category: "Risk Mitigation", confidence: 90, impact: "+€20K", tag: "Pending", time: "2m ago", governance: "Active" },
  { id: "DL-2846", category: "Revenue Growth", confidence: 88, impact: "+€15K", tag: "Approved", time: "14m ago", governance: "Logged" },
  { id: "DL-2845", category: "Cost Optimisation", confidence: 85, impact: "+€8K", tag: "Review", time: "31m ago", governance: "Active" },
  { id: "DL-2844", category: "Supply Chain", confidence: 92, impact: "+€42K", tag: "Approved", time: "1h ago", governance: "Logged" },
  { id: "DL-2843", category: "Risk Mitigation", confidence: 79, impact: "+€11K", tag: "Pending", time: "2h ago", governance: "Active" },
];

const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  Approved: { bg: "#DCFCE7", color: "#15803D" },
  Pending: { bg: "#FEF9C3", color: "#854D0E" },
  Review: { bg: "#EFF6FF", color: "#1D4ED8" },
};

const ResponsiveStyles = () => (
  <style>{`
    .qv-page { min-height: 100dvh; background: #fff; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .qv-wrap { max-width: 1280px; margin: 0 auto; padding: 96px 24px; }
    .qv-nav-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; height: 64px; display: flex; align-items: center; justify-content: space-between; }
    .qv-nav-links { display: flex; gap: 28px; align-items: center; }
    .qv-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 64px; align-items: center; }
    .qv-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; }
    .qv-grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .qv-hero { position: relative; min-height: 100vh; display: flex; flex-direction: column; justify-content: flex-end; color: #fff; overflow: hidden; }
    .qv-hero-content { position: relative; z-index: 2; max-width: 1280px; margin: 0 auto; padding: 128px 24px 80px; width: 100%; }
    .qv-hero h1 { font-family: Georgia, serif; font-size: clamp(36px, 5vw, 64px); line-height: 1.1; letter-spacing: -0.02em; max-width: 860px; margin: 28px 0; font-weight: 400; text-shadow: 0 2px 20px rgba(0,0,0,0.4); }
    .qv-hero-copy { font-size: 18px; line-height: 1.7; color: rgba(255,255,255,0.72); max-width: 580px; margin: 0 0 40px; text-shadow: 0 1px 8px rgba(0,0,0,0.3); }
    .qv-cta-row { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 64px; }
    .qv-primary-cta { display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: ${ACCENT}; color: #fff; padding: 14px 28px; border-radius: 4px; font-size: 14px; font-weight: 700; text-decoration: none; }
    .qv-secondary-cta { display: inline-flex; align-items: center; justify-content: center; gap: 6px; color: rgba(255,255,255,0.65); font-size: 14px; text-decoration: none; }
    .qv-ledger { margin-top: 40px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); border-radius: 8px; overflow: hidden; }
    .qv-ledger-row, .qv-ledger-head { display: grid; grid-template-columns: 80px 1fr 90px 80px 90px 90px 110px; align-items: center; }
    .qv-ledger-head { padding: 8px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .qv-ledger-row { padding: 14px 20px; }
    .qv-mobile-card { display: none; }
    .qv-heading { font-family: Georgia, serif; font-size: clamp(28px, 4vw, 52px); line-height: 1.15; color: ${NAVY}; font-weight: 400; letter-spacing: -0.02em; margin: 0; }
    .qv-card { background: #fff; padding: 40px 36px; }
    .qv-footer-grid { display: grid; grid-template-columns: 1.4fr repeat(4, 1fr); gap: 48px; margin-bottom: 48px; }
    .qv-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: rgba(255,255,255,0.06); }

    @media (max-width: 900px) {
      .qv-wrap { padding: 72px 18px; }
      .qv-nav-inner { height: 60px; padding: 0 18px; }
      .qv-nav-links a:not(:last-child):not([href='#demo']) { display: none; }
      .qv-nav-links { gap: 14px; }
      .qv-grid-2, .qv-grid-3, .qv-grid-4, .qv-footer-grid { grid-template-columns: 1fr; gap: 24px; }
      .qv-hero { min-height: auto; }
      .qv-hero-content { padding: 104px 18px 48px; }
      .qv-hero h1 { font-size: clamp(34px, 11vw, 48px); line-height: 1.05; margin: 22px 0; max-width: 100%; }
      .qv-hero-copy { font-size: 16px; line-height: 1.65; margin-bottom: 28px; }
      .qv-cta-row { display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 32px; }
      .qv-primary-cta, .qv-secondary-cta { width: 100%; min-height: 48px; box-sizing: border-box; }
      .qv-ledger { margin-top: 28px; }
      .qv-ledger-head, .qv-ledger-row { display: none; }
      .qv-mobile-card { display: block; padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
      .qv-mobile-card-title { color: #fff; font-weight: 600; font-size: 13px; line-height: 1.35; margin: 8px 0; }
      .qv-mobile-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
      .qv-mobile-metric { background: rgba(255,255,255,0.06); border-radius: 6px; padding: 10px; text-align: center; }
      .qv-card { padding: 30px 22px; }
      .qv-heading { font-size: clamp(28px, 9vw, 40px); }
      .qv-form-grid { grid-template-columns: 1fr; }
      .qv-hide-mobile { display: none !important; }
      input, textarea, button, a { font-size: 16px; }
    }

    @media (max-width: 520px) {
      .qv-nav-links a[href='#demo'] { padding: 8px 12px !important; font-size: 12px !important; }
      .qv-badge { font-size: 9px !important; line-height: 1.4; }
      .qv-stat-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .qv-footer-bottom { flex-direction: column; align-items: flex-start !important; gap: 16px; }
    }
  `}</style>
);

const Nav = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, backgroundColor: scrolled ? "rgba(14,22,40,0.97)" : DEEP, borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent", backdropFilter: "blur(12px)", transition: "background-color 0.3s, border-color 0.3s" }}>
      <div className="qv-nav-inner">
        <Link to="/" style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 600, color: "#fff", textDecoration: "none", letterSpacing: "-0.02em" }}>Quantivis</Link>
        <nav className="qv-nav-links">
          <a href="#platform" style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>Platform</a>
          <a href="#pricing" style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>Pricing</a>
          <Link to="/trust-center" style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>Security</Link>
          <Link to="/login" style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>Sign In</Link>
          <a href="#demo" style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: ACCENT, padding: "9px 18px", borderRadius: 4, textDecoration: "none" }}>Request Demo</a>
        </nav>
      </div>
    </header>
  );
};

const LedgerTicker = () => {
  const [visible, setVisible] = useState([0, 1, 2]);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFade(true);
      window.setTimeout(() => {
        setVisible(prev => prev.map(i => (i + 1) % DECISIONS.length));
        setFade(false);
      }, 350);
    }, 3200);
    return () => window.clearInterval(interval);
  }, []);

  const primaryDecision = DECISIONS[visible[0]];
  const primaryTag = TAG_STYLES[primaryDecision.tag] ?? TAG_STYLES.Pending;

  return (
    <div className="qv-ledger">
      <div style={{ background: "rgba(0,0,0,0.35)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["#EF4444", "#F59E0B", "#22C55E"].map(color => <div key={color} style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />)}
        </div>
        <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.05em" }}>app.quantivis.io/decisions</div>
        <span className="qv-hide-mobile" style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}>GOVERNANCE ACTIVE</span>
      </div>

      <div className="qv-mobile-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>{primaryDecision.id}</span>
          <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 3, background: primaryTag.bg, color: primaryTag.color, fontWeight: 700 }}>{primaryDecision.tag}</span>
        </div>
        <div className="qv-mobile-card-title">{primaryDecision.category} Risk — Immediate investigation required</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{primaryDecision.time} · Sample: 1000 · Governance {primaryDecision.governance}</div>
        <div className="qv-mobile-metrics">
          <div className="qv-mobile-metric"><div style={{ color: "#22C55E", fontWeight: 800 }}>{primaryDecision.confidence}%</div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>Confidence</div></div>
          <div className="qv-mobile-metric"><div style={{ color: "#22C55E", fontWeight: 800 }}>{primaryDecision.impact}</div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>Impact</div></div>
          <div className="qv-mobile-metric"><div style={{ color: "#fff", fontWeight: 800 }}>Active</div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>Record</div></div>
        </div>
      </div>

      <div className="qv-ledger-head">
        {["ID", "Decision", "Confidence", "Impact", "Status", "Governance", ""].map((heading, i) => <div key={heading || i} style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", textAlign: i > 1 ? "center" : "left" }}>{heading}</div>)}
      </div>
      {visible.map((idx, row) => {
        const decision = DECISIONS[idx];
        const tag = TAG_STYLES[decision.tag] ?? TAG_STYLES.Pending;
        return (
          <div key={`${row}-${idx}`} className="qv-ledger-row" style={{ borderBottom: row < 2 ? "1px solid rgba(255,255,255,0.05)" : "none", opacity: fade ? 0.3 : 1, transition: "opacity 0.35s ease" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>{decision.id}</div>
            <div><div style={{ fontSize: 12, color: "#fff", fontWeight: 500 }}>{decision.category} Risk — Immediate investigation required</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{decision.time} · Sample: 1000</div></div>
            <div style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: decision.confidence >= 90 ? "#22C55E" : "#F59E0B" }}>{decision.confidence}%</div>
            <div style={{ textAlign: "center", fontSize: 12, color: "#22C55E", fontWeight: 600 }}>{decision.impact}</div>
            <div style={{ textAlign: "center" }}><span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 3, background: tag.bg, color: tag.color, fontWeight: 600 }}>{decision.tag}</span></div>
            <div style={{ textAlign: "center" }}><span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.07)", padding: "3px 8px", borderRadius: 3 }}>{decision.governance}</span></div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}><button style={{ fontSize: 10, padding: "4px 10px", borderRadius: 3, background: "#22C55E", color: "#fff", border: "none", fontWeight: 600 }}>Approve</button><button style={{ fontSize: 10, padding: "4px 10px", borderRadius: 3, background: "transparent", color: "#EF4444", border: "1px solid #EF4444", fontWeight: 600 }}>Reject</button></div>
          </div>
        );
      })}
    </div>
  );
};

const Hero = () => (
  <section className="qv-hero">
    <video src={heroVideoAsset.url} autoPlay muted loop playsInline preload="metadata" poster="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", zIndex: 0 }} />
    <div style={{ position: "absolute", inset: 0, zIndex: 1, background: "linear-gradient(to bottom, rgba(14,22,40,0.60) 0%, rgba(14,22,40,0.50) 38%, rgba(14,22,40,0.84) 74%, rgba(14,22,40,0.98) 100%)" }} />
    <div className="qv-hero-content">
      <span className="qv-badge" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", padding: "5px 12px", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 2, background: "rgba(255,255,255,0.04)" }}>EU AI Act · Decision Governance · DACH</span>
      <h1>Every AI decision your organisation makes needs an audit trail. <span style={{ color: "rgba(255,255,255,0.56)" }}>Quantivis creates it automatically.</span></h1>
      <p className="qv-hero-copy">Log decisions. Attach evidence. Track outcomes. Know what worked and why — with a governance score on every recommendation.</p>
      <div className="qv-cta-row">
        <a href="#demo" className="qv-primary-cta">Request a Demo <ArrowRight size={16} /></a>
        <a href="#platform" className="qv-secondary-cta">See the platform <ArrowRight size={14} /></a>
      </div>
      <LedgerTicker />
    </div>
  </section>
);

const DecisionBrief = () => (
  <section style={{ background: DEEP, paddingBottom: 96 }}>
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
      <div className="qv-grid-2">
        <div>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 20 }}>The governance record</span>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(26px, 3vw, 42px)", lineHeight: 1.15, letterSpacing: "-0.02em", color: "#fff", fontWeight: 400, margin: "0 0 24px" }}>Every decision. Full evidence chain. One auditable record.</h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.75, margin: "0 0 32px" }}>The Decision Ledger captures every AI recommendation — who approved it, what evidence supported it, what outcome was predicted, and what actually happened. Board-defensible by design.</p>
          {[["Recommendation → Decision → Outcome → Learning", "The full loop, automatically recorded"], ["Anti-hallucination validation on every output", "AI claims checked against your actual source data"], ["Brier-scored calibration after every outcome", "Predictions get more accurate over time"]].map(([title, sub]) => (
            <div key={title} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 }}><div style={{ width: 20, height: 20, borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}><span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span></div><div><div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{title}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{sub}</div></div></div>
          ))}
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}><div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}><span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 2, background: "#FEF9C3", color: "#854D0E", fontWeight: 600 }}>Risk Mitigation</span><span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 2, background: "#DCFCE7", color: "#15803D", fontWeight: 600 }}>Governance Active</span></div><div style={{ fontSize: 13, color: "#fff", fontWeight: 500, lineHeight: 1.4 }}>Address Inventory Turnover and Working Capital Inefficiencies</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>Logged 2 minutes ago · Sample: 1,000 · Source: SAP connector</div></div>
          <div className="qv-form-grid">{[["90%", "Confidence", "#22C55E"], ["+€20K", "Est. Impact", ACCENT], ["Strong", "Evidence", "#F59E0B"]].map(([value, label, color]) => <div key={label} style={{ background: "rgba(255,255,255,0.03)", padding: "14px 16px" }}><div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div></div>)}</div>
          <div style={{ padding: "14px 20px" }}>{["SAP ERP export verified", "Causal inference engine passed", "Anti-hallucination layer passed"].map(item => <div key={item} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} /><span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>{item}</span></div>)}</div>
        </div>
      </div>
    </div>
  </section>
);

const Stats = () => (
  <div style={{ background: MUTED, borderBottom: `1px solid rgba(30,39,97,0.1)` }}>
    <div className="qv-grid-4 qv-stat-strip" style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>{[["100+", "Automated governance workflows"], ["179", "Governance rules enforced"], ["211", "Countries monitored by AICIS"], ["15+", "Enterprise data connectors"]].map(([value, label]) => <div key={label} style={{ padding: "26px 14px", borderRight: `1px solid rgba(30,39,97,0.1)` }}><div style={{ fontFamily: "Georgia, serif", fontSize: 32, fontWeight: 400, color: NAVY, letterSpacing: "-0.03em" }}>{value}</div><div style={{ fontSize: 12, color: SLATE, marginTop: 4, lineHeight: 1.5 }}>{label}</div></div>)}</div>
  </div>
);

const Problem = () => (
  <section style={{ background: "#fff" }}><div className="qv-wrap"><p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: `${NAVY}66`, marginBottom: 24 }}>The Problem</p><h2 className="qv-heading" style={{ maxWidth: 760, marginBottom: 48 }}>Your organisation runs on decisions. But when one fails, can you answer these?</h2>{[["Who approved this decision, and what evidence did they have?", "Without a logged approval chain, accountability is anecdotal."], ["What outcome did we predict, and what actually happened?", "Quantivis shows whether your prediction was accurate — and adjusts future recommendations accordingly."], ["Did our AI recommendation perform better than human judgment?", "Quantivis tracks the full loop so decision-making improves over time."]].map(([question, answer]) => <div key={question} className="qv-grid-2" style={{ gap: 32, padding: "30px 0", borderTop: `1px solid rgba(30,39,97,0.12)` }}><div style={{ fontFamily: "Georgia, serif", fontSize: 24, color: NAVY, lineHeight: 1.35 }}>{question}</div><div style={{ fontSize: 15, color: SLATE, lineHeight: 1.7 }}>{answer}</div></div>)}</div></section>
);

const HowItWorks = () => (
  <section style={{ background: MUTED }}><div className="qv-wrap"><p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: `${NAVY}66`, marginBottom: 24 }}>How it works</p><h2 className="qv-heading" style={{ maxWidth: 640, marginBottom: 48 }}>Three steps. One governance record.</h2><div className="qv-grid-3">{[["01", "Log", "Record strategic decisions with confidence level, expected outcome, and supporting evidence."], ["02", "Govern", "Score every recommendation for evidence quality, confidence accuracy, and risk."], ["03", "Learn", "Compare predicted outcomes against reality and recalibrate future recommendations."]].map(([number, title, description], i) => <div key={title} className="qv-card" style={{ borderLeft: i === 0 ? `4px solid ${ACCENT}` : "none" }}><div style={{ fontFamily: "Georgia, serif", fontSize: 48, color: i === 0 ? ACCENT : `${NAVY}20`, lineHeight: 1, marginBottom: 20 }}>{number}</div><h3 style={{ fontFamily: "Georgia, serif", fontSize: 26, color: NAVY, marginBottom: 16, fontWeight: 400 }}>{title}</h3><p style={{ fontSize: 14, color: SLATE, lineHeight: 1.75 }}>{description}</p></div>)}</div></div></section>
);

const Platform = () => {
  const features = [
    { icon: <CheckCircle size={20} color={ACCENT} />, title: "Decision Ledger", description: "A permanent, auditable record of every decision made across your organisation." },
    { icon: <Shield size={20} color={ACCENT} />, title: "Governance Score", description: "Every recommendation receives an evidence score, confidence rating, and risk flag." },
    { icon: <TrendingUp size={20} color={ACCENT} />, title: "Outcome Intelligence", description: "Track what your AI predicted against what actually happened." },
    { icon: <Globe size={20} color={ACCENT} />, title: "AICIS Geopolitical Signals", description: "Live geopolitical risk signals can trigger governed decision workflows." },
    { icon: <Shield size={20} color={ACCENT} />, title: "Anti-Hallucination Layer", description: "AI claims are checked against actual source data before approval." },
    { icon: <Shield size={20} color={ACCENT} />, title: "Enterprise Connectors", description: "SAP, Salesforce, Dynamics, HubSpot, NetSuite, BigQuery, Snowflake, S3, Sheets, and REST APIs." },
  ];
  return <section id="platform" style={{ background: "#fff" }}><div className="qv-wrap"><p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: `${NAVY}66`, marginBottom: 24 }}>The Platform</p><div className="qv-grid-2" style={{ gap: 48, marginBottom: 48 }}><h2 className="qv-heading">Built for the decisions that matter.</h2><p style={{ fontSize: 16, color: SLATE, lineHeight: 1.75, margin: 0 }}>Quantivis is not a dashboard. It is a governed decision record — the layer between AI recommendations and the humans who act on them.</p></div><div className="qv-grid-3" style={{ background: `rgba(30,39,97,0.08)` }}>{features.map(feature => <div key={feature.title} className="qv-card"><div style={{ marginBottom: 16 }}>{feature.icon}</div><h3 style={{ fontFamily: "Georgia, serif", fontSize: 20, color: NAVY, marginBottom: 12, fontWeight: 400 }}>{feature.title}</h3><p style={{ fontSize: 13, color: SLATE, lineHeight: 1.75, margin: 0 }}>{feature.description}</p></div>)}</div></div></section>;
};

const Architecture = () => (
  <section style={{ background: MUTED, borderTop: `1px solid rgba(30,39,97,0.1)`, borderBottom: `1px solid rgba(30,39,97,0.1)` }}><div style={{ maxWidth: 1280, margin: "0 auto", padding: "64px 24px" }}><p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: `${NAVY}66`, marginBottom: 32 }}>Infrastructure</p><div className="qv-grid-4" style={{ gap: 32 }}>{[["Data layer", "PostgreSQL · EU data residency · Row-level security"], ["Compute layer", "Deno edge functions · Cron orchestration · Circuit breakers"], ["Auth & access", "PKCE OAuth · MFA · WebAuthn · SSO-ready"], ["Compliance", "GDPR · DPA · EU AI Act framing · DPIA documentation"]].map(([label, value]) => <div key={label}><div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: NAVY, marginBottom: 10 }}>{label}</div><div style={{ fontSize: 13, color: SLATE, lineHeight: 1.7 }}>{value}</div></div>)}</div></div></section>
);

const EUAIAct = () => (
  <section style={{ background: DEEP, color: "#fff" }}><div className="qv-wrap"><p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>Compliance</p><div className="qv-grid-2" style={{ gap: 64 }}><div><h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 52px)", lineHeight: 1.15, fontWeight: 400, letterSpacing: "-0.02em", margin: "0 0 32px" }}>The EU AI Act requires documented decision trails. Quantivis provides them.</h2><Link to="/ai-governance" className="qv-primary-cta" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.25)" }}>Read our EU AI Act guide <ArrowRight size={14} /></Link></div><div className="qv-grid-2" style={{ gap: 32, alignItems: "start" }}>{[["Requirements", ["Article 9 — Risk management", "Article 13 — Transparency", "Article 14 — Human oversight"]], ["What Quantivis provides", ["Automated audit trail", "Evidence chain", "Board-ready reports"]]].map(([title, items]) => <div key={title as string}><div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>{title as string}</div>{(items as string[]).map(item => <div key={item} style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.08)", lineHeight: 1.4 }}>{item}</div>)}</div>)}</div></div></div></section>
);

const Pricing = () => {
  const plans = [
    { name: "Essentials", price: "€499", cadence: "/month", seats: "5 seats", features: ["Decision ledger", "Governance scoring", "EU AI Act documentation", "5 enterprise connectors", "Email support"], featured: false },
    { name: "Governance", price: "€1,999", cadence: "/month", seats: "15 seats", features: ["Everything in Essentials", "Causal inference engine", "Outcome learning + calibration", "AICIS geopolitical signals", "Advanced board reporting", "SCIM + SSO"], featured: true },
    { name: "Enterprise", price: "From €6,500", cadence: "/month", seats: "Unlimited seats", features: ["Everything in Governance", "All connectors", "On-premise deployment option", "Dedicated onboarding", "99.9% SLA", "Procurement pack"], featured: false },
  ];
  return <section id="pricing" style={{ background: "#fff" }}><div className="qv-wrap"><p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: `${NAVY}66`, marginBottom: 24 }}>Pricing</p><div className="qv-grid-2" style={{ gap: 48, marginBottom: 48 }}><h2 className="qv-heading">Straightforward pricing. No hidden costs.</h2><p style={{ fontSize: 15, color: SLATE, lineHeight: 1.75, margin: 0 }}>All plans include a 30-day pilot period. You get a working governance record, not a sandbox.</p></div><div className="qv-grid-3" style={{ background: `rgba(30,39,97,0.08)` }}>{plans.map(plan => <div key={plan.name} className="qv-card" style={{ display: "flex", flexDirection: "column", position: "relative", outline: plan.featured ? `2px solid ${ACCENT}` : "none", outlineOffset: -2 }}>{plan.featured && <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: ACCENT, textAlign: "center", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", padding: "5px 0" }}>Most Popular</div>}<div style={{ paddingTop: plan.featured ? 20 : 0 }}><h3 style={{ fontFamily: "Georgia, serif", fontSize: 22, color: NAVY, fontWeight: 400, margin: "0 0 20px" }}>{plan.name}</h3><div><span style={{ fontFamily: "Georgia, serif", fontSize: 40, color: NAVY }}>{plan.price}</span><span style={{ fontSize: 13, color: SLATE }}> {plan.cadence}</span></div><div style={{ fontSize: 13, color: SLATE, marginBottom: 24 }}>{plan.seats}</div>{plan.features.map(feature => <div key={feature} style={{ display: "flex", gap: 10, marginBottom: 12 }}><span style={{ color: ACCENT }}>✓</span><span style={{ fontSize: 13, color: `${NAVY}CC`, lineHeight: 1.5 }}>{feature}</span></div>)}</div><a href="#demo" className="qv-primary-cta" style={{ marginTop: "auto", background: plan.featured ? ACCENT : "transparent", color: plan.featured ? "#fff" : NAVY, border: plan.featured ? "none" : `1.5px solid ${NAVY}` }}>Request demo</a></div>)}</div></div></section>;
};

const Demo = () => {
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.email || !form.company) return;
    setStatus("sending");
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.from("enterprise_leads").insert({ full_name: form.name, work_email: form.email, company: form.company, use_case: form.message || null, source: "homepage_demo_form", status: "new" });
      if (error) throw error;
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  return <section id="demo" style={{ background: NAVY, color: "#fff" }}><div className="qv-wrap qv-grid-2" style={{ gap: 64, alignItems: "start" }}><div><h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 1.15, fontWeight: 400, letterSpacing: "-0.02em", margin: "0 0 20px" }}>See Quantivis running on your data.</h2><p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", lineHeight: 1.75, margin: "0 0 32px", maxWidth: 440 }}>We run a live demo using a dataset from your industry. You leave with a working governance record — not a slide deck.</p><div className="qv-form-grid">{[["< 1 week", "Typical onboarding"], ["100%", "Decisions auditable"], ["15+", "Data connectors"], ["211", "Countries monitored"]].map(([value, label]) => <div key={label} style={{ padding: "22px 18px", background: "rgba(255,255,255,0.03)" }}><div style={{ fontFamily: "Georgia, serif", fontSize: 28, color: "#fff" }}>{value}</div><div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div></div>)}</div></div><div>{status === "sent" ? <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "48px 30px", textAlign: "center" }}><div style={{ fontSize: 40, marginBottom: 16 }}>✓</div><h3 style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 400, color: "#fff", marginBottom: 12 }}>Request received</h3><p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>We will be in touch within one business day to schedule your live demo.</p></div> : <form onSubmit={handleSubmit} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>{[["Full name *", "name", "Jane Smith", "text"], ["Work email *", "email", "jane@company.com", "email"], ["Company *", "company", "Acme GmbH", "text"]].map(([label, key, placeholder, type]) => <label key={key} style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}<input type={type} required value={form[key as keyof typeof form]} placeholder={placeholder} onChange={event => setForm(prev => ({ ...prev, [key]: event.target.value }))} style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, padding: "13px 14px", fontSize: 16, color: "#fff", outline: "none", boxSizing: "border-box" }} /></label>)}<label style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.1em" }}>What are you trying to govern? <span style={{ opacity: 0.5 }}>(optional)</span><textarea rows={3} value={form.message} placeholder="e.g. AI procurement decisions, supply chain risk approvals..." onChange={event => setForm(prev => ({ ...prev, message: event.target.value }))} style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, padding: "13px 14px", fontSize: 16, color: "#fff", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} /></label>{status === "error" && <p style={{ fontSize: 13, color: "#EF4444", margin: 0 }}>Something went wrong. Please email hello@quantivis.io directly.</p>}<button type="submit" disabled={status === "sending"} className="qv-primary-cta" style={{ border: "none", cursor: status === "sending" ? "not-allowed" : "pointer" }}>{status === "sending" ? "Sending…" : <>Request a Demo <ArrowRight size={16} /></>}</button></form>}</div></div></section>;
};

const SiteFooter = () => {
  const cols = [
    { title: "Platform", links: [{ label: "Decision Ledger", to: "/decisions" }, { label: "Governance Score", to: "/governance" }, { label: "Outcome Intelligence", to: "/outcomes" }, { label: "AICIS Intelligence", to: "/intelligence-dashboard" }, { label: "Pricing", to: "/#pricing" }] },
    { title: "Enterprise Trust", links: [{ label: "Trust Center", to: "/trust-center" }, { label: "EU AI Act", to: "/ai-governance" }, { label: "Security", to: "/security" }, { label: "DPA", to: "/dpa" }, { label: "Procurement Pack", to: "/procurement-pack" }] },
    { title: "Legal", links: [{ label: "Impressum", to: "/impressum" }, { label: "Datenschutz", to: "/de/datenschutz" }, { label: "AGB", to: "/de/agb" }, { label: "Cookie Policy", to: "/cookies" }, { label: "Subprocessors", to: "/subprocessors" }] },
    { title: "Get Started", links: [{ label: "Request Demo", to: "/#demo" }, { label: "Documentation", to: "/api-docs" }, { label: "Contact", to: "mailto:hello@quantivis.io" }, { label: "System Status", to: "/system-status" }] },
  ];
  return <footer style={{ background: DEEP, color: "rgba(255,255,255,0.6)", borderTop: "1px solid rgba(255,255,255,0.06)" }}><div style={{ maxWidth: 1280, margin: "0 auto", padding: "56px 24px" }}><div className="qv-footer-grid"><div><div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: "#fff", marginBottom: 10, letterSpacing: "-0.02em" }}>Quantivis</div><p style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 260, color: "rgba(255,255,255,0.4)" }}>Enterprise decision governance for AI-powered organisations.</p><p style={{ fontSize: 12, marginTop: 16, color: "rgba(255,255,255,0.3)" }}>hello@quantivis.io<br />Germany</p></div>{cols.map(col => <div key={col.title}><h4 style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)", marginBottom: 18 }}>{col.title}</h4><ul style={{ listStyle: "none", padding: 0, margin: 0 }}>{col.links.map(link => <li key={link.label} style={{ marginBottom: 10 }}>{link.to.startsWith("mailto:") || link.to.startsWith("/#") ? <a href={link.to} style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>{link.label}</a> : <Link to={link.to} style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>{link.label}</Link>}</li>)}</ul></div>)}</div><div className="qv-footer-bottom" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>© 2026 Quantivis Global. All rights reserved.</span><div style={{ display: "flex", gap: 24 }}>{[["GDPR", "/privacy"], ["Impressum", "/impressum"], ["Terms", "/terms"]].map(([label, to]) => <Link key={label} to={to} style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>{label}</Link>)}</div></div></div></footer>;
};

const Index = forwardRef<HTMLDivElement>((_, ref) => {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token=")) {
      window.location.replace("/auth/callback" + (hash.startsWith("#") ? "?" + hash.slice(1) : hash));
    }
  }, []);

  return (
    <div ref={ref} className="qv-page">
      <ResponsiveStyles />
      <Nav />
      <main id="main-content">
        <Hero />
        <DecisionBrief />
        <Stats />
        <Problem />
        <HowItWorks />
        <Platform />
        <Architecture />
        <EUAIAct />
        <Pricing />
        <Demo />
      </main>
      <SiteFooter />
    </div>
  );
});

Index.displayName = "Index";
export default Index;

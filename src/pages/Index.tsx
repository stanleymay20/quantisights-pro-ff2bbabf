import { forwardRef, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, Shield, TrendingUp, AlertCircle, Clock } from "lucide-react";

/* ─── Design tokens ───────────────────────────────────────────────── */
const NAVY   = "#1E2761";
const DEEP   = "#0E1628";
const ACCENT = "#3D5AFE";
const MUTED  = "#F4F6F9";
const SLATE  = "#64748B";

/* ─── Ledger ticker data ──────────────────────────────────────────── */
const DECISIONS = [
  { id: "DL-2847", category: "Risk Mitigation",   confidence: 90, impact: "+€20K", tag: "Pending",  time: "2m ago",  governance: "Active" },
  { id: "DL-2846", category: "Revenue Growth",     confidence: 88, impact: "+€15K", tag: "Approved", time: "14m ago", governance: "Logged" },
  { id: "DL-2845", category: "Cost Optimisation",  confidence: 85, impact: "+€8K",  tag: "Review",   time: "31m ago", governance: "Active" },
  { id: "DL-2844", category: "Supply Chain",       confidence: 92, impact: "+€42K", tag: "Approved", time: "1h ago",  governance: "Logged" },
  { id: "DL-2843", category: "Risk Mitigation",    confidence: 79, impact: "+€11K", tag: "Pending",  time: "2h ago",  governance: "Active" },
];

const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  Approved: { bg: "#DCFCE7", color: "#15803D" },
  Pending:  { bg: "#FEF9C3", color: "#854D0E" },
  Review:   { bg: "#EFF6FF", color: "#1D4ED8" },
};

/* ─── Nav ─────────────────────────────────────────────────────────── */
const Nav = () => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        backgroundColor: scrolled ? "rgba(14,22,40,0.97)" : DEEP,
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
        backdropFilter: "blur(12px)",
        transition: "background-color 0.3s, border-color 0.3s",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/" style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 600, color: "#fff", textDecoration: "none", letterSpacing: "-0.02em" }}>
          Quantivis
        </Link>
        <nav style={{ display: "flex", gap: 36, alignItems: "center" }}>
          {[["Platform", "#platform"], ["Pricing", "#pricing"], ["Security", "/trust-center"], ["Docs", "/api-docs"]].map(([label, href]) => (
            href.startsWith("#") ? (
              <a key={label} href={href} style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", textDecoration: "none", transition: "color 0.15s" }}
                onMouseOver={e => (e.currentTarget.style.color = "#fff")}
                onMouseOut={e => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
              >{label}</a>
            ) : (
              <Link key={label} to={href} style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>{label}</Link>
            )
          ))}
          <a
            href="#demo"
            style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: ACCENT, padding: "8px 18px", borderRadius: 4, textDecoration: "none", letterSpacing: "0.01em", transition: "opacity 0.15s" }}
            onMouseOver={e => (e.currentTarget.style.opacity = "0.88")}
            onMouseOut={e => (e.currentTarget.style.opacity = "1")}
          >
            Request Demo
          </a>
        </nav>
      </div>
    </header>
  );
};

/* ─── Ledger ticker ───────────────────────────────────────────────── */
const LedgerTicker = () => {
  const [visible, setVisible] = useState([0, 1, 2]);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => {
      setFade(true);
      setTimeout(() => {
        setVisible(prev => prev.map(i => (i + 1) % DECISIONS.length));
        setFade(false);
      }, 350);
    }, 3200);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{
      marginTop: 40,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 8,
      overflow: "hidden",
    }}>
      {/* chrome bar */}
      <div style={{ background: "rgba(0,0,0,0.35)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["#EF4444","#F59E0B","#22C55E"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.9 }} />)}
        </div>
        <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.05em" }}>
          app.quantivis.io/decisions
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}>GOVERNANCE ACTIVE</span>
        </div>
      </div>

      {/* header row */}
      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 90px 80px 90px 90px 110px", gap: 0, padding: "8px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {["ID","Decision","Confidence","Impact","Status","Governance",""].map((h, i) => (
          <div key={i} style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", textAlign: i > 1 ? "center" : "left" }}>{h}</div>
        ))}
      </div>

      {/* decision rows */}
      {visible.map((idx, row) => {
        const d = DECISIONS[idx];
        const ts = TAG_STYLES[d.tag] ?? TAG_STYLES.Pending;
        return (
          <div
            key={`${row}-${idx}`}
            style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr 90px 80px 90px 90px 110px",
              gap: 0,
              padding: "14px 20px",
              borderBottom: row < 2 ? "1px solid rgba(255,255,255,0.05)" : "none",
              opacity: fade ? 0.3 : 1,
              transition: "opacity 0.35s ease",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>{d.id}</div>
            <div>
              <div style={{ fontSize: 12, color: "#fff", fontWeight: 500, marginBottom: 2 }}>{d.category} Risk — Immediate investigation required</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{d.time} · Sample: 1000</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: d.confidence >= 90 ? "#22C55E" : d.confidence >= 80 ? "#F59E0B" : "#94A3B8" }}>{d.confidence}%</span>
            </div>
            <div style={{ textAlign: "center", fontSize: 12, color: "#22C55E", fontWeight: 600 }}>{d.impact}</div>
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 3, background: ts.bg, color: ts.color, fontWeight: 600, letterSpacing: "0.03em" }}>{d.tag}</span>
            </div>
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.07)", padding: "3px 8px", borderRadius: 3 }}>{d.governance}</span>
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button style={{ fontSize: 10, padding: "4px 10px", borderRadius: 3, background: "#22C55E", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}>Approve</button>
              <button style={{ fontSize: 10, padding: "4px 10px", borderRadius: 3, background: "transparent", color: "#EF4444", border: "1px solid #EF4444", fontWeight: 600, cursor: "pointer" }}>Reject</button>
            </div>
          </div>
        );
      })}

      {/* footer stats */}
      <div style={{ padding: "10px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 32 }}>
        {[["11", "Pending decisions"],["0", "Critical alerts"],["Active", "Governance record"]].map(([val, label]) => (
          <div key={label} style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "Georgia, serif" }}>{val}</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.05em" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Hero ────────────────────────────────────────────────────────── */
const Hero = () => (
  <section style={{ background: `linear-gradient(180deg, ${DEEP} 0%, ${NAVY} 100%)`, paddingTop: 128, paddingBottom: 96, color: "#fff" }}>
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
      <div style={{ marginBottom: 24 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", padding: "5px 12px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 2 }}>
          EU AI Act · Decision Governance · DACH
        </span>
      </div>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(36px, 5vw, 64px)", lineHeight: 1.1, letterSpacing: "-0.02em", maxWidth: 860, margin: "0 0 28px", fontWeight: 400 }}>
        Every AI decision your organisation makes needs an audit trail.{" "}
        <span style={{ color: "rgba(255,255,255,0.45)" }}>Quantivis creates it automatically.</span>
      </h1>
      <p style={{ fontSize: 18, lineHeight: 1.7, color: "rgba(255,255,255,0.65)", maxWidth: 580, margin: "0 0 40px" }}>
        Log decisions. Attach evidence. Track outcomes. Know what worked and why — with a governance score on every recommendation.
      </p>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <a href="#demo" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: ACCENT, color: "#fff", padding: "14px 28px", borderRadius: 4, fontSize: 14, fontWeight: 700, textDecoration: "none", letterSpacing: "0.02em", transition: "opacity 0.15s" }}
          onMouseOver={e => (e.currentTarget.style.opacity = "0.88")}
          onMouseOut={e => (e.currentTarget.style.opacity = "1")}
        >
          Request a Demo <ArrowRight size={16} />
        </a>
        <a href="#platform" style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, transition: "color 0.15s" }}
          onMouseOver={e => (e.currentTarget.style.color = "#fff")}
          onMouseOut={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
        >
          See the platform <ArrowRight size={14} />
        </a>
      </div>
      <LedgerTicker />
    </div>
  </section>
);

/* ─── Decision Brief panel ────────────────────────────────────────── */
const DecisionBrief = () => (
  <section style={{ background: DEEP, paddingBottom: 96 }}>
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 20 }}>
            The governance record
          </span>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(26px, 3vw, 42px)", lineHeight: 1.15, letterSpacing: "-0.02em", color: "#fff", fontWeight: 400, margin: "0 0 24px" }}>
            Every decision. Full evidence chain. One auditable record.
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.75, margin: "0 0 32px" }}>
            The Decision Ledger captures every AI recommendation — who approved it, what evidence supported it, what outcome was predicted, and what actually happened. Board-defensible by design.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              ["Recommendation → Decision → Outcome → Learning", "The full loop, automatically recorded"],
              ["Anti-hallucination validation on every output", "AI claims checked against your actual source data"],
              ["Brier-scored calibration after every outcome", "Predictions get more accurate over time"],
            ].map(([title, sub]) => (
              <div key={title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{title}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ background: "rgba(0,0,0,0.4)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["#EF4444","#F59E0B","#22C55E"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
            </div>
            <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.28)", letterSpacing: "0.04em" }}>app.quantivis.io/decisions/DL-2847</div>
          </div>
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 2, background: "#FEF9C3", color: "#854D0E", fontWeight: 600 }}>Risk Mitigation</span>
              <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 2, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>DL-2847</span>
              <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 2, background: "#DCFCE7", color: "#15803D", fontWeight: 600 }}>Governance Active</span>
            </div>
            <div style={{ fontSize: 13, color: "#fff", fontWeight: 500, lineHeight: 1.4 }}>
              Address Inventory Turnover and Working Capital Inefficiencies: Immediate investigation required to prevent further exposure
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>Logged 2 minutes ago · Sample: 1,000 · Source: SAP connector</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "rgba(255,255,255,0.06)" }}>
            {[["90%", "Confidence", "#22C55E"], ["+€20K", "Est. Impact", ACCENT], ["Strong", "Evidence", "#F59E0B"]].map(([val, label, color]) => (
              <div key={label} style={{ background: "rgba(255,255,255,0.03)", padding: "12px 16px" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color, marginBottom: 2 }}>{val}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Evidence chain</div>
            {[
              ["SAP ERP export", "Inventory turnover ratio: 2.1x (industry avg: 4.8x)", "✓ Verified"],
              ["Causal inference engine", "Root cause: 3 slow-moving SKU categories identified", "✓ Verified"],
              ["Anti-hallucination layer", "No fabricated metrics detected in recommendation", "✓ Passed"],
            ].map(([src, desc, status]) => (
              <div key={src} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", flexShrink: 0, marginTop: 4 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "#fff", fontWeight: 500 }}>{src} <span style={{ color: "#22C55E", fontSize: 9 }}>{status}</span></div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: "14px 20px", display: "flex", gap: 10 }}>
            <button style={{ flex: 1, background: "#22C55E", color: "#fff", border: "none", padding: "10px", borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Approve</button>
            <button style={{ flex: 1, background: "transparent", color: "#EF4444", border: "1px solid #EF4444", padding: "10px", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Reject</button>
            <button style={{ flex: 1, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.12)", padding: "10px", borderRadius: 4, fontSize: 12, cursor: "pointer" }}>Simulate</button>
          </div>
        </div>
      </div>
    </div>
  </section>
);


/* ─── Stats strip ─────────────────────────────────────────────────── */
const Stats = () => (
  <div style={{ background: MUTED, borderBottom: `1px solid rgba(30,39,97,0.1)` }}>
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
      {[
        ["100+",  "Edge functions deployed"],
        ["179",   "Database migrations"],
        ["211",   "Countries covered by AICIS intelligence"],
        ["15+",   "Enterprise data connectors"],
      ].map(([val, label]) => (
        <div key={label} style={{ padding: "28px 0", borderRight: `1px solid rgba(30,39,97,0.1)`, paddingLeft: 24, paddingRight: 24 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 32, fontWeight: 400, color: NAVY, letterSpacing: "-0.03em" }}>{val}</div>
          <div style={{ fontSize: 12, color: SLATE, marginTop: 4, lineHeight: 1.5 }}>{label}</div>
        </div>
      ))}
    </div>
  </div>
);

/* ─── Problem ─────────────────────────────────────────────────────── */
const Problem = () => (
  <section style={{ background: "#fff" }}>
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "96px 24px" }}>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: `${NAVY}66`, marginBottom: 24 }}>The Problem</p>
      <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 52px)", lineHeight: 1.15, color: NAVY, maxWidth: 820, margin: "0 0 56px", fontWeight: 400, letterSpacing: "-0.02em" }}>
        Your organisation runs on decisions. But when one fails, can you answer these?
      </h2>
      <div style={{ borderTop: `1px solid rgba(30,39,97,0.12)` }}>
        {[
          ["Who approved this decision, and what evidence did they have?", "Without a logged approval chain, accountability is anecdotal. Boards and regulators require more."],
          ["What outcome did we predict, and what actually happened?", "Most platforms show you what happened. Quantivis shows you whether your prediction was accurate — and adjusts future recommendations accordingly."],
          ["Did our AI recommendation perform better than human judgment?", "If you cannot answer this, you cannot improve your decision-making process. Quantivis tracks the full loop."],
        ].map(([q, a], i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, padding: "40px 0", borderBottom: `1px solid rgba(30,39,97,0.12)`, alignItems: "start" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "clamp(18px, 2vw, 24px)", color: NAVY, lineHeight: 1.35, fontWeight: 400 }}>{q}</div>
            <div style={{ fontSize: 15, color: SLATE, lineHeight: 1.7, paddingTop: 4 }}>{a}</div>
          </div>
        ))}
      </div>
      <p style={{ fontFamily: "Georgia, serif", fontSize: 16, fontStyle: "italic", color: `${NAVY}80`, marginTop: 40, maxWidth: 700, lineHeight: 1.6 }}>
        Most organisations cannot answer any of these — and under the EU AI Act, that gap is a compliance liability.
      </p>
    </div>
  </section>
);

/* ─── How it works ────────────────────────────────────────────────── */
const HowItWorks = () => (
  <section style={{ background: MUTED }}>
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "96px 24px" }}>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: `${NAVY}66`, marginBottom: 24 }}>How it works</p>
      <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 52px)", lineHeight: 1.15, color: NAVY, maxWidth: 640, margin: "0 0 64px", fontWeight: 400, letterSpacing: "-0.02em" }}>
        Three steps. One governance record.
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
        {[
          { n: "01", t: "Log", d: "Record every strategic decision with confidence level, expected outcome, and supporting evidence. Takes 90 seconds. The system attaches the AI recommendation, the evidence chain, and the approver." },
          { n: "02", t: "Govern", d: "Every recommendation is scored for evidence quality, confidence accuracy, and alignment with past outcomes. The audit trail is automatic — no manual documentation required." },
          { n: "03", t: "Learn", d: "When outcomes arrive, the system compares prediction vs reality. Confidence scores self-correct via Bayesian calibration. Every future recommendation is informed by actual results." },
        ].map((s, i) => (
          <div key={i} style={{ background: "#fff", padding: "40px 36px", borderLeft: i === 0 ? `4px solid ${ACCENT}` : "none" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 48, color: i === 0 ? ACCENT : `${NAVY}20`, fontWeight: 400, lineHeight: 1, marginBottom: 20 }}>{s.n}</div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: 26, color: NAVY, marginBottom: 16, fontWeight: 400 }}>{s.t}</h3>
            <p style={{ fontSize: 14, color: SLATE, lineHeight: 1.75 }}>{s.d}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ─── Platform ────────────────────────────────────────────────────── */
const Platform = () => {
  const features = [
    { icon: <CheckCircle size={20} color={ACCENT} />, t: "Decision Ledger", d: "A permanent, auditable record of every decision made across your organisation. Every row includes the AI recommendation, the human approval, the evidence attached, and the outcome recorded. Searchable, exportable, board-defensible." },
    { icon: <Shield size={20} color={ACCENT} />, t: "Governance Score", d: "Every recommendation receives an evidence score, a confidence rating, and a risk flag before it reaches a decision-maker. Reviewers see the full reasoning chain, not just the conclusion. Nothing gets approved without a governance record." },
    { icon: <TrendingUp size={20} color={ACCENT} />, t: "Outcome Intelligence", d: "Track what your AI predicted against what actually happened. The system writes a Brier score for every completed prediction and feeds it back into the calibration engine — so every future recommendation is more accurate than the last." },
    { icon: <AlertCircle size={20} color={ACCENT} />, t: "AICIS Geopolitical Signals", d: "Quantivis ingests live geopolitical risk signals across 211 countries via the AICIS intelligence layer. High-risk predictions above your configured threshold are automatically converted into pending decision workflows — every 15 minutes." },
    { icon: <Clock size={20} color={ACCENT} />, t: "Anti-Hallucination Layer", d: "Every AI output is validated against your actual source data before it reaches a decision-maker. Fabricated metrics, wrong values, and unsupported claims are flagged and removed. The audit trail is trustworthy, not just complete." },
    { icon: <Shield size={20} color={ACCENT} />, t: "Enterprise Connectors", d: "SAP, Salesforce, Dynamics 365, HubSpot, NetSuite, BigQuery, Snowflake, S3, Google Sheets, and REST APIs. All read-only. All running on a circuit-breaker architecture. Data stays in the EU." },
  ];

  return (
    <section id="platform" style={{ background: "#fff" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "96px 24px" }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: `${NAVY}66`, marginBottom: 24 }}>The Platform</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginBottom: 64 }}>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 52px)", lineHeight: 1.15, color: NAVY, fontWeight: 400, letterSpacing: "-0.02em", margin: 0 }}>
            Built for the decisions that matter.
          </h2>
          <p style={{ fontSize: 16, color: SLATE, lineHeight: 1.75, margin: 0, paddingTop: 8 }}>
            Quantivis is not a dashboard. It is a governed decision record — the layer between your AI recommendations and the humans who act on them.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: `rgba(30,39,97,0.08)` }}>
          {features.map((f, i) => (
            <div key={i} style={{ background: "#fff", padding: "36px 32px" }}>
              <div style={{ marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: 20, color: NAVY, marginBottom: 12, fontWeight: 400 }}>{f.t}</h3>
              <p style={{ fontSize: 13, color: SLATE, lineHeight: 1.75, margin: 0 }}>{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ─── Architecture strip ──────────────────────────────────────────── */
const Architecture = () => (
  <section style={{ background: MUTED, borderTop: `1px solid rgba(30,39,97,0.1)`, borderBottom: `1px solid rgba(30,39,97,0.1)` }}>
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "64px 24px" }}>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: `${NAVY}66`, marginBottom: 32 }}>Infrastructure</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32 }}>
        {[
          { label: "Data layer", val: "PostgreSQL · EU data residency · Row-level security on all tables · 179 migrations" },
          { label: "Compute layer", val: "100+ Deno edge functions · Cron orchestration · Circuit-breaker architecture · Adaptive retry" },
          { label: "Auth & access", val: "PKCE OAuth · MFA (TOTP) · WebAuthn passkeys · SCIM provisioning · SAML SSO · Step-up auth" },
          { label: "Compliance", val: "GDPR · DPA · AVV (German) · EU AI Act framing · Retention policies · DPIA documentation" },
        ].map(({ label, val }) => (
          <div key={label}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: NAVY, marginBottom: 10 }}>{label}</div>
            <div style={{ fontSize: 13, color: SLATE, lineHeight: 1.7 }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ─── EU AI Act ───────────────────────────────────────────────────── */
const EUAIAct = () => (
  <section style={{ background: DEEP, color: "#fff" }}>
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "96px 24px" }}>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>Compliance</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "start" }}>
        <div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 52px)", lineHeight: 1.15, fontWeight: 400, letterSpacing: "-0.02em", margin: "0 0 32px" }}>
            The EU AI Act requires documented decision trails. Quantivis provides them.
          </h2>
          <Link to="/ai-governance" style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid rgba(255,255,255,0.25)", color: "#fff", padding: "12px 22px", fontSize: 13, textDecoration: "none", borderRadius: 3, fontWeight: 500, transition: "background 0.15s" }}
            onMouseOver={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.08)"; }}
            onMouseOut={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
          >
            Read our EU AI Act compliance guide <ArrowRight size={14} />
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, paddingTop: 8 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>Requirements</div>
            {["Article 9 — Risk management", "Article 13 — Transparency", "Article 14 — Human oversight"].map(x => (
              <div key={x} style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.08)", lineHeight: 1.4 }}>{x}</div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>What Quantivis provides</div>
            {["Automated audit trail on every decision", "Evidence chain per recommendation", "Board-ready governance reports"].map(x => (
              <div key={x} style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.08)", lineHeight: 1.4, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ color: ACCENT, marginTop: 2 }}>✓</span>{x}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);

/* ─── Pricing ─────────────────────────────────────────────────────── */
const Pricing = () => {
  const plans = [
    { name: "Essentials", price: "€499", cadence: "/month", seats: "5 seats", features: ["Decision ledger", "Governance scoring", "EU AI Act documentation", "5 enterprise connectors", "Email support"], cta: "Get started", featured: false },
    { name: "Governance", price: "€1,999", cadence: "/month", seats: "15 seats", features: ["Everything in Essentials", "Causal inference engine", "Outcome learning + calibration", "AICIS geopolitical signals", "Advanced board reporting", "SCIM + SSO"], cta: "Request demo", featured: true },
    { name: "Enterprise", price: "From €6,500", cadence: "/month", seats: "Unlimited seats", features: ["Everything in Governance", "All 15+ connectors", "On-premise deployment option", "Dedicated onboarding programme", "99.9% SLA", "Procurement pack"], cta: "Contact sales", featured: false },
  ];

  return (
    <section id="pricing" style={{ background: "#fff" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "96px 24px" }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: `${NAVY}66`, marginBottom: 24 }}>Pricing</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginBottom: 56 }}>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 52px)", lineHeight: 1.15, color: NAVY, fontWeight: 400, letterSpacing: "-0.02em", margin: 0 }}>
            Straightforward pricing. No hidden costs.
          </h2>
          <p style={{ fontSize: 15, color: SLATE, lineHeight: 1.75, margin: 0, paddingTop: 8 }}>
            All plans include a 30-day pilot period. You get a working governance record, not a sandbox. No long-term commitment required.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, background: `rgba(30,39,97,0.08)` }}>
          {plans.map(p => (
            <div key={p.name} style={{ background: "#fff", padding: "44px 36px", display: "flex", flexDirection: "column", position: "relative", outline: p.featured ? `2px solid ${ACCENT}` : "none", outlineOffset: -2 }}>
              {p.featured && (
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: ACCENT, textAlign: "center", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", padding: "5px 0" }}>Most Popular</div>
              )}
              <div style={{ paddingTop: p.featured ? 20 : 0 }}>
                <h3 style={{ fontFamily: "Georgia, serif", fontSize: 22, color: NAVY, fontWeight: 400, margin: "0 0 20px" }}>{p.name}</h3>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                  <span style={{ fontFamily: "Georgia, serif", fontSize: 40, color: NAVY, fontWeight: 400, letterSpacing: "-0.03em" }}>{p.price}</span>
                  <span style={{ fontSize: 13, color: SLATE }}>{p.cadence}</span>
                </div>
                <div style={{ fontSize: 13, color: SLATE, marginBottom: 32 }}>{p.seats}</div>
                <div style={{ borderTop: `1px solid rgba(30,39,97,0.1)`, paddingTop: 24, marginBottom: 32 }}>
                  {p.features.map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                      <span style={{ color: ACCENT, fontSize: 14, marginTop: 1, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 13, color: `${NAVY}CC`, lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <a href="#demo" style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "13px 20px", fontSize: 13, fontWeight: 700, textDecoration: "none", borderRadius: 3, background: p.featured ? ACCENT : "transparent", color: p.featured ? "#fff" : NAVY, border: p.featured ? "none" : `1.5px solid ${NAVY}`, transition: "opacity 0.15s" }}
                onMouseOver={e => (e.currentTarget.style.opacity = "0.8")}
                onMouseOut={e => (e.currentTarget.style.opacity = "1")}
              >
                {p.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ─── Demo CTA ────────────────────────────────────────────────────── */
const Demo = () => (
  <section id="demo" style={{ background: NAVY, color: "#fff" }}>
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "96px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
      <div>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 1.15, fontWeight: 400, letterSpacing: "-0.02em", margin: "0 0 24px" }}>
          See Quantivis running on your data.
        </h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.65)", lineHeight: 1.75, margin: "0 0 40px", maxWidth: 440 }}>
          We run a live demo using a dataset from your industry. You leave with a working governance record — not a slide deck.
        </p>
        <a href="mailto:hello@quantivis.io?subject=Demo%20request" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: ACCENT, color: "#fff", padding: "14px 28px", borderRadius: 4, fontSize: 14, fontWeight: 700, textDecoration: "none", transition: "opacity 0.15s" }}
          onMouseOver={e => (e.currentTarget.style.opacity = "0.88")}
          onMouseOut={e => (e.currentTarget.style.opacity = "1")}
        >
          Request a Demo <ArrowRight size={16} />
        </a>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 20 }}>hello@quantivis.io · Germany</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(255,255,255,0.06)" }}>
        {[
          { label: "Typical onboarding", val: "< 1 week", sub: "From first call to live governance record" },
          { label: "Decisions auditable", val: "100%", sub: "Every recommendation tracked end-to-end" },
          { label: "Data connectors", val: "15+", sub: "SAP, Salesforce, BigQuery and more" },
          { label: "Countries monitored", val: "211", sub: "Via AICIS geopolitical intelligence" },
        ].map(({ label, val, sub }) => (
          <div key={label} style={{ padding: "28px 24px", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 32, color: "#fff", marginBottom: 4, fontWeight: 400 }}>{val}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>{sub}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ─── Footer ──────────────────────────────────────────────────────── */
const SiteFooter = () => {
  const cols = [
    { title: "Platform", links: [{ label: "Decision Ledger", to: "/decisions" }, { label: "Governance Score", to: "/governance" }, { label: "Outcome Intelligence", to: "/outcomes" }, { label: "AICIS Intelligence", to: "/intelligence-dashboard" }, { label: "Pricing", to: "/#pricing" }] },
    { title: "Enterprise Trust", links: [{ label: "Trust Center", to: "/trust-center" }, { label: "EU AI Act", to: "/ai-governance" }, { label: "Security", to: "/security" }, { label: "DPA", to: "/dpa" }, { label: "Procurement Pack", to: "/procurement-pack" }] },
    { title: "Legal", links: [{ label: "Impressum", to: "/impressum" }, { label: "Datenschutz", to: "/de/datenschutz" }, { label: "AGB", to: "/de/agb" }, { label: "Cookie Policy", to: "/cookies" }, { label: "Subprocessors", to: "/subprocessors" }] },
    { title: "Get Started", links: [{ label: "Request Demo", to: "/#demo" }, { label: "Documentation", to: "/api-docs" }, { label: "Contact", to: "mailto:hello@quantivis.io" }, { label: "System Status", to: "/system-status" }] },
  ];

  return (
    <footer style={{ background: DEEP, color: "rgba(255,255,255,0.6)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "64px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", gap: 48, marginBottom: 48 }}>
          <div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: "#fff", marginBottom: 10, letterSpacing: "-0.02em" }}>Quantivis</div>
            <p style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 220, color: "rgba(255,255,255,0.4)" }}>Enterprise decision governance for AI-powered organisations.</p>
            <p style={{ fontSize: 12, marginTop: 16, color: "rgba(255,255,255,0.3)" }}>hello@quantivis.io<br />Germany</p>
          </div>
          {cols.map(c => (
            <div key={c.title}>
              <h4 style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)", marginBottom: 18 }}>{c.title}</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {c.links.map(l => (
                  <li key={l.label} style={{ marginBottom: 10 }}>
                    {l.to.startsWith("mailto:") || l.to.startsWith("/#") ? (
                      <a href={l.to} style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none", transition: "color 0.15s" }}
                        onMouseOver={e => (e.currentTarget.style.color = "#fff")}
                        onMouseOut={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
                      >{l.label}</a>
                    ) : (
                      <Link to={l.to} style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>{l.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>© 2026 Quantivis Global. All rights reserved.</span>
          <div style={{ display: "flex", gap: 24 }}>
            {[["GDPR", "/privacy"], ["Impressum", "/impressum"], ["Terms", "/terms"]].map(([l, to]) => (
              <Link key={l} to={to} style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>{l}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

/* ─── Page ────────────────────────────────────────────────────────── */
const Index = forwardRef<HTMLDivElement>((_, ref) => (
  <div ref={ref} style={{ minHeight: "100dvh", background: "#fff", fontFamily: "system-ui, -apple-system, sans-serif" }}>
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
));

Index.displayName = "Index";
export default Index;

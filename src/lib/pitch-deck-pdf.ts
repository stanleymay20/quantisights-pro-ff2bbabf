import jsPDF from "jspdf";
import logoUrl from "@/assets/quantivis-logo.png";

const W = 1920;
const H = 1080;
const PAD = 80;
const PRIMARY: [number, number, number] = [15, 118, 110];
const DARK: [number, number, number] = [17, 24, 39];
const MUTED: [number, number, number] = [107, 114, 128];
const WHITE: [number, number, number] = [255, 255, 255];
const DESTRUCTIVE: [number, number, number] = [220, 38, 38];

interface SlideData {
  number: number;
  title: string;
  render: (doc: jsPDF, logoImg: HTMLImageElement) => void;
}

function drawLogo(doc: jsPDF, logoImg: HTMLImageElement) {
  doc.addImage(logoImg, "PNG", PAD, 40, 200, 58);
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text("Executive Overconfidence Insurance", PAD + 210, 72);
}

function drawSlideNumber(doc: jsPDF, n: number) {
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text(`${n} / 9`, W - PAD, H - 40, { align: "right" });
}

function sectionTitle(doc: jsPDF, text: string, y: number) {
  doc.setFontSize(40);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(text, W / 2, y, { align: "center" });
}

function bodyText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, size = 18) {
  doc.setFontSize(size);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(text, x, y, { maxWidth });
}

function bullet(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, color = MUTED) {
  doc.setFontSize(17);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...color);
  doc.text(`•  ${text}`, x, y, { maxWidth });
}

function statBox(doc: jsPDF, value: string, label: string, x: number, y: number, w: number, h: number, valueColor = PRIMARY) {
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(1);
  doc.roundedRect(x, y, w, h, 8, 8, "S");
  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...valueColor);
  doc.text(value, x + w / 2, y + h / 2 - 8, { align: "center" });
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(label, x + w / 2, y + h / 2 + 18, { align: "center", maxWidth: w - 20 });
}

const SLIDES: SlideData[] = [
  // 1 — Cover
  {
    number: 1,
    title: "Cover",
    render: (doc, logoImg) => {
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, W, H, "F");
      doc.addImage(logoImg, "PNG", W / 2 - 140, 200, 280, 82);
      doc.setFontSize(52);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text("Quantivis", W / 2, 360, { align: "center" });
      doc.setFontSize(24);
      doc.setTextColor(...PRIMARY);
      doc.setFont("helvetica", "bold");
      doc.text("Executive Overconfidence Insurance", W / 2, 410, { align: "center" });
      doc.setFontSize(18);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      doc.text("The first Decision Governance platform that makes every", W / 2, 480, { align: "center" });
      doc.text("strategic call board-defensible.", W / 2, 508, { align: "center" });
      doc.setFontSize(14);
      doc.text("Quantivis Global GmbH  ·  Germany  ·  hello@quantivis.io  ·  quantivis.io", W / 2, 600, { align: "center" });
      doc.text("Pre-Seed  ·  B2B SaaS  ·  Decision Intelligence", W / 2, 628, { align: "center" });
    },
  },
  // 2 — Problem
  {
    number: 2,
    title: "Problem",
    render: (doc, logoImg) => {
      doc.setFillColor(...WHITE);
      doc.rect(0, 0, W, H, "F");
      drawLogo(doc, logoImg);
      sectionTitle(doc, "The Problem", 200);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text("73% of executives are systematically overconfident in their strategic forecasts.", W / 2, 280, { align: "center", maxWidth: 1400 });

      const problems = [
        ["$12.9M", "Avg. annual cost of poor data quality (Gartner 2022)"],
        ["85%", "AI projects fail due to inadequate data governance (MIT Sloan)"],
        ["40%", "Higher operational costs without governance (TDWI 2023)"],
        ["80%", "Analyst time wasted on data cleansing instead of analysis"],
      ];
      const boxW = 340;
      const startX = (W - (boxW * 4 + 60 * 3)) / 2;
      problems.forEach(([val, label], i) => {
        statBox(doc, val, label, startX + i * (boxW + 60), 360, boxW, 160, DESTRUCTIVE);
      });

      doc.setFillColor(254, 242, 242);
      doc.roundedRect(PAD + 200, 600, W - PAD * 2 - 400, 80, 8, 8, "F");
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DESTRUCTIVE);
      doc.text("$2.3 Trillion in annual value destruction from the \"Data-to-Wisdom Gap\"", W / 2, 648, { align: "center" });
      drawSlideNumber(doc, 2);
    },
  },
  // 3 — Solution
  {
    number: 3,
    title: "Solution",
    render: (doc, logoImg) => {
      doc.setFillColor(...WHITE);
      doc.rect(0, 0, W, H, "F");
      drawLogo(doc, logoImg);
      sectionTitle(doc, "The Solution", 200);
      bodyText(doc, "A 90-day path from tracking decisions to measurably better judgment.", PAD, 280, W - PAD * 2, 18);

      const steps = [
        { month: "Month 1", title: "Decision Ledger", desc: "Log strategic calls with confidence scores and accountability." },
        { month: "Month 2", title: "Outcome Tracking", desc: "Record real results. Measure forecast divergence." },
        { month: "Month 3", title: "Calibration Active", desc: "AI adjusts confidence based on track record." },
      ];
      const colW = 480;
      const startX = (W - (colW * 3 + 60 * 2)) / 2;
      steps.forEach((s, i) => {
        const x = startX + i * (colW + 60);
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(x, 340, colW, 280, 8, 8, "S");
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...PRIMARY);
        doc.text(s.month.toUpperCase(), x + 30, 380);
        doc.setFontSize(24);
        doc.setTextColor(...DARK);
        doc.text(s.title, x + 30, 420);
        bodyText(doc, s.desc, x + 30, 470, colW - 60, 16);
      });
      drawSlideNumber(doc, 3);
    },
  },
  // 4 — Product
  {
    number: 4,
    title: "Product",
    render: (doc, logoImg) => {
      doc.setFillColor(...WHITE);
      doc.rect(0, 0, W, H, "F");
      drawLogo(doc, logoImg);
      sectionTitle(doc, "The Product", 200);
      bodyText(doc, "Full-stack Decision Intelligence platform with 20+ analytical frameworks.", PAD, 270, W - PAD * 2, 18);

      const features = [
        "Monte Carlo Simulation", "Bayesian Prior Calibration",
        "Regret Minimization", "Causal Inference Engine",
        "Value of Information", "Cognitive Bias Detection",
        "Sensitivity Analysis", "Scenario Branching",
      ];
      const col1X = PAD + 100;
      const col2X = W / 2 + 60;
      features.forEach((f, i) => {
        const x = i < 4 ? col1X : col2X;
        const y = 340 + (i % 4) * 50;
        doc.setFontSize(16);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...PRIMARY);
        doc.text("✓", x, y);
        doc.setTextColor(...DARK);
        doc.text(f, x + 30, y);
      });

      doc.setFillColor(240, 253, 250);
      doc.roundedRect(PAD + 100, 580, W - PAD * 2 - 200, 70, 8, 8, "F");
      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PRIMARY);
      doc.text("Evidence Contract: Every recommendation graded A–F with traceability, assumptions, and risk-if-wrong", W / 2, 622, { align: "center", maxWidth: W - 400 });
      drawSlideNumber(doc, 4);
    },
  },
  // 5 — Market
  {
    number: 5,
    title: "Market",
    render: (doc, logoImg) => {
      doc.setFillColor(...WHITE);
      doc.rect(0, 0, W, H, "F");
      drawLogo(doc, logoImg);
      sectionTitle(doc, "Market Opportunity", 200);

      const data = [
        { l: "TAM", v: "$4.2B", d: "Decision Intelligence (2026)" },
        { l: "CAGR", v: "22%", d: "Growth through 2030" },
        { l: "SAM", v: "$850M", d: "EU enterprise segment" },
        { l: "SOM", v: "$42M", d: "PE/VC + mid-market DACH" },
      ];
      const boxW = 340;
      const startX = (W - (boxW * 4 + 60 * 3)) / 2;
      data.forEach((m, i) => {
        statBox(doc, m.v, `${m.l}\n${m.d}`, startX + i * (boxW + 60), 300, boxW, 180);
      });

      doc.setFontSize(16);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      doc.text("ICP:  CEO, CFO, COO at 50–5,000 employee companies; PE/VC portfolio managers", W / 2, 580, { align: "center" });
      doc.text("ACV:  €18K – €72K per organization (usage-based tiers)", W / 2, 620, { align: "center" });
      drawSlideNumber(doc, 5);
    },
  },
  // 6 — Traction
  {
    number: 6,
    title: "Traction",
    render: (doc, logoImg) => {
      doc.setFillColor(...WHITE);
      doc.rect(0, 0, W, H, "F");
      drawLogo(doc, logoImg);
      sectionTitle(doc, "Technical Traction", 200);

      const traction = [
        { v: "236", l: "Automated tests" },
        { v: "50+", l: "Edge functions" },
        { v: "20+", l: "Decision frameworks" },
        { v: "Zero", l: "Security vulnerabilities" },
      ];
      const boxW = 340;
      const startX = (W - (boxW * 4 + 60 * 3)) / 2;
      traction.forEach((t, i) => {
        statBox(doc, t.v, t.l, startX + i * (boxW + 60), 280, boxW, 160);
      });

      const highlights = [
        "Full platform live with demo environment (15 months seeded data)",
        "Enterprise-grade: RLS on 100% of tables, RBAC, SSO, GDPR-ready",
        "Multi-tenant architecture with workspace isolation",
      ];
      highlights.forEach((h, i) => {
        bullet(doc, h, PAD + 100, 540 + i * 50, W - PAD * 2 - 200, DARK);
      });
      drawSlideNumber(doc, 6);
    },
  },
  // 7 — Business Model
  {
    number: 7,
    title: "Business Model",
    render: (doc, logoImg) => {
      doc.setFillColor(...WHITE);
      doc.rect(0, 0, W, H, "F");
      drawLogo(doc, logoImg);
      sectionTitle(doc, "Business Model", 200);

      const tiers = [
        { name: "Starter", price: "€99/mo", features: "1 organization, 1 dataset, basic dashboards,\nCSV uploads, standard reporting, 2 seats" },
        { name: "Growth", price: "€249/mo", features: "Unlimited datasets, AI advisory & forecasting,\nMonte Carlo, executive copilot, calibration,\nboard-ready reports, 5 seats" },
        { name: "Enterprise", price: "Custom", features: "Unlimited everything, cognitive bias detection,\ncounterfactual explanations, SSO/RBAC,\naudit logs, multi-org, unlimited seats" },
      ];
      const colW = 500;
      const startX = (W - (colW * 3 + 50 * 2)) / 2;
      tiers.forEach((t, i) => {
        const x = startX + i * (colW + 50);
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(x, 280, colW, 300, 8, 8, "S");
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...DARK);
        doc.text(t.name, x + colW / 2, 330, { align: "center" });
        doc.setFontSize(28);
        doc.setTextColor(...PRIMARY);
        doc.text(t.price, x + colW / 2, 380, { align: "center" });
        bodyText(doc, t.features, x + 30, 430, colW - 60, 14);
      });

      doc.setFillColor(240, 253, 250);
      doc.roundedRect(PAD + 200, 650, W - PAD * 2 - 400, 70, 8, 8, "F");
      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PRIMARY);
      doc.text("Enterprise ACV: €18K – €72K annually  ·  Usage-based AI compute add-on  ·  PE portfolio pricing available", W / 2, 692, { align: "center", maxWidth: W - 500 });
      drawSlideNumber(doc, 7);
    },
  },
  // 8 — Competitive Edge
  {
    number: 8,
    title: "Competitive Edge",
    render: (doc, logoImg) => {
      doc.setFillColor(...WHITE);
      doc.rect(0, 0, W, H, "F");
      drawLogo(doc, logoImg);
      sectionTitle(doc, "Competitive Edge", 200);

      const rows = [
        { us: "Decision Ledger (Decision → Outcome → Learning)", them: "Static dashboards" },
        { us: "Epistemic governance caps AI confidence", them: "Unchecked AI hallucination" },
        { us: "Cost of Delay from real revenue data", them: "Fabricated currency values" },
        { us: "Output classified: Fact vs. Inference vs. AI", them: "Undifferentiated outputs" },
        { us: "236 automated integrity tests", them: "Manual QA" },
      ];

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PRIMARY);
      doc.text("Quantivis", PAD + 200, 290);
      doc.setTextColor(...MUTED);
      doc.text("Alternatives", W / 2 + 200, 290);

      rows.forEach((r, i) => {
        const y = 330 + i * 68;
        doc.setFillColor(240, 253, 250);
        doc.roundedRect(PAD + 100, y - 15, 700, 50, 4, 4, "F");
        doc.setFontSize(15);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...DARK);
        doc.text(`✓  ${r.us}`, PAD + 120, y + 12, { maxWidth: 660 });

        doc.setFillColor(248, 248, 248);
        doc.roundedRect(W / 2 + 100, y - 15, 600, 50, 4, 4, "F");
        doc.setTextColor(...MUTED);
        doc.text(`✕  ${r.them}`, W / 2 + 120, y + 12, { maxWidth: 560 });
      });
      drawSlideNumber(doc, 8);
    },
  },
  // 9 — The Ask
  {
    number: 9,
    title: "The Ask",
    render: (doc, logoImg) => {
      doc.setFillColor(...WHITE);
      doc.rect(0, 0, W, H, "F");
      drawLogo(doc, logoImg);
      sectionTitle(doc, "The Ask", 200);

      doc.setFillColor(240, 253, 250);
      doc.roundedRect(W / 2 - 350, 260, 700, 160, 12, 12, "F");
      doc.setFontSize(16);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      doc.text("We're looking for", W / 2, 305, { align: "center" });
      doc.setFontSize(48);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PRIMARY);
      doc.text("€500K Pre-Seed", W / 2, 365, { align: "center" });
      doc.setFontSize(15);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      doc.text("to acquire first 10 enterprise customers and reach €150K ARR in 12 months", W / 2, 400, { align: "center" });

      const alloc = [
        { pct: "40%", label: "Product &\nEngineering" },
        { pct: "35%", label: "Sales &\nGTM" },
        { pct: "25%", label: "Operations" },
      ];
      const boxW = 300;
      const startX = (W - (boxW * 3 + 80 * 2)) / 2;
      alloc.forEach((a, i) => {
        statBox(doc, a.pct, a.label, startX + i * (boxW + 80), 490, boxW, 150);
      });

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text("hello@quantivis.io  ·  quantivis.io  ·  Germany", W / 2, 740, { align: "center" });
      drawSlideNumber(doc, 9);
    },
  },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function generatePitchDeckPDF(): Promise<void> {
  const logoImg = await loadImage(logoUrl);
  const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [W, H], hotfixes: ["px_scaling"] });

  SLIDES.forEach((slide, i) => {
    if (i > 0) doc.addPage([W, H], "landscape");
    slide.render(doc, logoImg);
  });

  // Metadata
  doc.setProperties({
    title: "Quantivis Pitch Deck",
    author: "Quantivis Global GmbH",
    subject: "Decision Intelligence",
    keywords: "decision intelligence, governance, pitch deck",
    creator: "quantivis.io",
  });

  doc.save("Quantivis_Pitch_Deck.pdf");
}

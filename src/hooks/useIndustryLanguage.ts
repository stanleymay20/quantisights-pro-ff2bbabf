/**
 * useIndustryLanguage
 *
 * Returns terminology overrides based on the current organization's industry.
 * Used by the sidebar and page headers to rename labels without changing routes.
 *
 * Phase 3 — IA v1.1 Section 6: Industry Language Layer.
 *
 * Default labels are used when:
 *   - No industry is set on the organization
 *   - The industry does not match a known vertical
 *   - The label has no override for that industry
 */

export type Industry =
  | "supply_chain"
  | "manufacturing"
  | "finance"
  | "healthcare"
  | "general"
  | null
  | undefined;

export interface IndustryLabels {
  decisions: string;
  decisionLedger: string;
  outcomes: string;
  interventions: string;
  simulations: string;
  governance: string;
  dataConnectors: string;
  copilotPrompts: string[];
}

const DEFAULT: IndustryLabels = {
  decisions:       "Decisions",
  decisionLedger:  "Decision Ledger",
  outcomes:        "Outcomes",
  interventions:   "Interventions",
  simulations:     "Simulations",
  governance:      "Governance",
  dataConnectors:  "Connectors",
  copilotPrompts: [
    "Why are sales slowing?",
    "What should I prioritise this week?",
    "Where are we losing money?",
    "What decisions need my approval?",
    "What will happen if revenue drops 10%?",
    "Which risks need my attention?",
  ],
};

const INDUSTRY_OVERRIDES: Partial<Record<NonNullable<Industry>, Partial<IndustryLabels>>> = {
  supply_chain: {
    decisions:      "Decisions",
    decisionLedger: "Procurement Approvals",
    outcomes:       "Supplier Outcomes",
    interventions:  "Supply Disruptions",
    simulations:    "Supply Scenarios",
    governance:     "Procurement Governance",
    dataConnectors: "ERP Connectors",
    copilotPrompts: [
      "What are my supplier concentration risks?",
      "Which procurement approvals are pending?",
      "Simulate Q3 inventory shortage",
      "Show supply disruptions this week",
      "Run a supplier risk scenario",
      "Analyse my latest supply chain data",
    ],
  },
  manufacturing: {
    decisions:      "Decisions",
    decisionLedger: "Production Decisions",
    outcomes:       "Line Outcomes",
    interventions:  "Production Alerts",
    simulations:    "Production Scenarios",
    governance:     "Quality Governance",
    dataConnectors: "MES Connectors",
    copilotPrompts: [
      "Where are my production bottlenecks?",
      "What production decisions need approval?",
      "Simulate line shutdown impact",
      "Show quality governance KPIs",
      "Run a capacity scenario",
      "Analyse production data",
    ],
  },
  finance: {
    decisions:      "Decisions",
    decisionLedger: "Investment Decisions",
    outcomes:       "Portfolio Outcomes",
    interventions:  "Risk Interventions",
    simulations:    "Portfolio Scenarios",
    governance:     "Trade Compliance",
    dataConnectors: "Market Data Feeds",
    copilotPrompts: [
      "What is our portfolio risk exposure?",
      "Which investment decisions are pending?",
      "Run a margin scenario",
      "Show pending investment approvals",
      "Analyse portfolio performance",
      "Prepare a board report",
    ],
  },
  healthcare: {
    decisions:      "Decisions",
    decisionLedger: "Clinical Decisions",
    outcomes:       "Patient Outcomes",
    interventions:  "Clinical Alerts",
    simulations:    "Care Pathway Simulations",
    governance:     "Clinical Governance",
    dataConnectors: "EHR Connectors",
    copilotPrompts: [
      "What clinical decisions are pending approval?",
      "Show care pathway simulation",
      "Review clinical governance score",
      "What are the open patient risks?",
      "Analyse clinical outcomes data",
      "Run a capacity planning scenario",
    ],
  },
};

/**
 * Normalise raw industry string from DB to a known Industry key.
 * Handles case variations and partial matches.
 */
function normaliseIndustry(raw: string | null | undefined): Industry {
  if (!raw) return "general";
  const s = raw.toLowerCase().replace(/[\s-]+/g, "_");
  if (s.includes("supply") || s.includes("logistics") || s.includes("procurement")) return "supply_chain";
  if (s.includes("manufactur") || s.includes("production") || s.includes("industrial")) return "manufacturing";
  if (s.includes("financ") || s.includes("banking") || s.includes("invest") || s.includes("insurance")) return "finance";
  if (s.includes("health") || s.includes("medical") || s.includes("clinical") || s.includes("pharma")) return "healthcare";
  return "general";
}

/**
 * Returns merged labels for the given raw industry string.
 * Always returns a complete IndustryLabels object — never partial.
 */
export function getIndustryLabels(rawIndustry: string | null | undefined): IndustryLabels {
  const key = normaliseIndustry(rawIndustry);
  if (!key || key === "general") return DEFAULT;
  const overrides = INDUSTRY_OVERRIDES[key] ?? {};
  return { ...DEFAULT, ...overrides };
}

/**
 * Hook — returns labels for the current org's industry.
 * Pass currentOrg.industry from useOrganization().
 */
export function useIndustryLabels(industry: string | null | undefined): IndustryLabels {
  return getIndustryLabels(industry);
}

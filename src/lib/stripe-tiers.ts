export const TIERS = {
  starter: {
    name: "Starter",
    price: 99,
    currency: "€",
    interval: "month",
    price_id: "price_1T6Ji8JYFIBeCvef4RkHSCfw",
    product_id: "prod_U4SdCda1dcZAtu",
    tagline: "Decision intelligence for teams replacing spreadsheet-driven strategy",
    features: [
      "1 organization · 1 dataset",
      "Core KPI dashboard & analytics",
      "Basic scenario simulations (5/day)",
      "Manual data upload (CSV)",
      "Standard reporting",
      "2 team seats",
    ],
  },
  growth: {
    name: "Growth",
    price: 249,
    currency: "€",
    interval: "month",
    price_id: "price_1T6Ji9JYFIBeCvef3KiArWFx",
    product_id: "prod_U4SdjQfflN6R1d",
    tagline: "Full AI decision engine — replaces management consulting cycles",
    features: [
      "Unlimited datasets & integrations",
      "AI Prescriptive Advisory Engine",
      "Predictive Forecasting (AI-powered)",
      "Anomaly Detection & Root Cause Analysis",
      "Monte Carlo Simulations (50/day)",
      "Executive Copilot (100 queries/day)",
      "Decision Ledger with calibration tracking",
      "Board-ready PDF governance reports",
      "Causal Inference Engine (DAGs)",
      "OKR Alignment & Benchmarking",
      "Alert Playbooks & Escalation Chains",
      "5 team seats",
    ],
    popular: true,
  },
  enterprise: {
    name: "Enterprise",
    price: null,
    currency: "€",
    interval: "month",
    price_id: null,
    product_id: "prod_U1oN5CDeptb9uY",
    tagline: "Unlimited intelligence for institutional decision-making",
    contactSales: true,
    features: [
      "Everything in Growth, plus:",
      "Unlimited simulations & copilot queries",
      "Cognitive Bias Detection (AI)",
      "Counterfactual Explanations",
      "Executive Convergence Index",
      "Multi-role Command Center (CEO/CFO/CMO/COO)",
      "Scenario Branching & War Room",
      "Data Lineage & Provenance Tracking",
      "Market Intelligence Signals",
      "Multi-organization management",
      "SSO, RBAC & full audit trail",
      "Priority processing & dedicated support",
      "Unlimited team seats",
    ],
  },
} as const;

export type TierKey = keyof typeof TIERS;

export const getTierByProductId = (productId: string | null): TierKey | null => {
  if (!productId) return null;
  for (const [key, tier] of Object.entries(TIERS)) {
    if (tier.product_id === productId) return key as TierKey;
  }
  return null;
};

// Feature comparison matrix for pricing/billing pages
export const FEATURE_MATRIX = [
  { category: "Intelligence", features: [
    { label: "KPI Dashboard & Analytics", starter: true, growth: true, enterprise: true },
    { label: "AI-Powered Insights", starter: false, growth: true, enterprise: true },
    { label: "Anomaly Detection", starter: false, growth: true, enterprise: true },
    { label: "Root Cause Diagnostics", starter: false, growth: true, enterprise: true },
    { label: "Predictive Forecasting", starter: false, growth: true, enterprise: true },
    { label: "Causal Inference Engine", starter: false, growth: true, enterprise: true },
    { label: "Market Intelligence Signals", starter: false, growth: false, enterprise: true },
  ]},
  { category: "Decision Science", features: [
    { label: "Scenario Simulations", starter: "5/day", growth: "50/day", enterprise: "Unlimited" },
    { label: "Monte Carlo Analysis", starter: false, growth: true, enterprise: true },
    { label: "Decision Ledger & Tracking", starter: false, growth: true, enterprise: true },
    { label: "Cognitive Bias Detection", starter: false, growth: false, enterprise: true },
    { label: "Counterfactual Explanations", starter: false, growth: false, enterprise: true },
    { label: "Scenario Branching & War Room", starter: false, growth: false, enterprise: true },
  ]},
  { category: "Executive Layer", features: [
    { label: "Executive Copilot (AI)", starter: false, growth: "100/day", enterprise: "Unlimited" },
    { label: "Prescriptive Advisory", starter: false, growth: true, enterprise: true },
    { label: "Board Governance Reports", starter: false, growth: true, enterprise: "✓ + AI" },
    { label: "Executive Convergence Index", starter: false, growth: false, enterprise: true },
    { label: "Multi-role Command Center", starter: false, growth: false, enterprise: true },
    { label: "Alert Playbooks & Escalation", starter: false, growth: true, enterprise: true },
  ]},
  { category: "Platform & Governance", features: [
    { label: "Data Upload (CSV)", starter: true, growth: true, enterprise: true },
    { label: "API & Webhook Integrations", starter: false, growth: true, enterprise: true },
    { label: "Data Lineage & Provenance", starter: false, growth: false, enterprise: true },
    { label: "OKR Alignment Engine", starter: false, growth: true, enterprise: true },
    { label: "Industry Benchmarking", starter: false, growth: true, enterprise: true },
    { label: "Team Seats", starter: "2", growth: "5", enterprise: "Unlimited" },
    { label: "Multi-organization", starter: false, growth: false, enterprise: true },
    { label: "SSO & RBAC", starter: false, growth: false, enterprise: true },
    { label: "Full Audit Trail", starter: false, growth: false, enterprise: true },
    { label: "Priority Processing", starter: false, growth: false, enterprise: true },
  ]},
  { category: "Services & Implementation", features: [
    { label: "Paid Pilot Program (4–8 weeks)", starter: false, growth: "Add-on", enterprise: "Included" },
    { label: "Onboarding & Setup", starter: "Self-serve", growth: "Guided", enterprise: "Dedicated" },
    { label: "Custom KPI Design", starter: false, growth: "Add-on", enterprise: "Included" },
    { label: "Executive Reporting Config", starter: false, growth: "Add-on", enterprise: "Included" },
    { label: "Decision Governance Setup", starter: false, growth: false, enterprise: "Included" },
    { label: "Team Training & Workshops", starter: false, growth: "Add-on", enterprise: "Included" },
    { label: "Dedicated Account Manager", starter: false, growth: false, enterprise: true },
  ]},
] as const;

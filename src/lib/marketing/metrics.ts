/**
 * Marketing-surface metrics — single source of truth.
 *
 * Purpose
 * -------
 * Historically, every headline number rendered on `/` was a raw string
 * literal embedded inline in `src/pages/Index.tsx`. That made the numbers:
 *
 *   - impossible to audit ("where did 179 come from?")
 *   - risky to change (find-and-replace across a 500-line page)
 *   - impossible to reason about at claim-review time
 *
 * This module fixes the *authoring* problem. Every marketing number is
 * declared once here with a `provenance` field that explains the source
 * of the claim. Reviewers and marketing owners can inspect this file to
 * see exactly what is claimed on the site and how each claim is
 * substantiated (or that it isn't yet).
 *
 * What this module is NOT
 * -----------------------
 * These values are **not** live telemetry. The homepage is a public
 * marketing surface and cannot render live customer data (privacy,
 * segregation, audit boundary). "Data-driven" here means: one place to
 * change, typed at compile time, and provenance-labelled — not "computed
 * from Supabase at render time."
 *
 * When a claim graduates from "aspirational" to "measured", change its
 * `provenance` to reference the substantiating dashboard, report, or
 * customer reference. Do NOT swap it for a live query.
 */

export type MetricProvenance =
  /** Substantiated by an internal measurement (link to the dashboard / query). */
  | { kind: "measured"; source: string }
  /** Substantiated by a signed customer reference or case study. */
  | { kind: "reference"; source: string }
  /** Product-catalogue fact (connector list, supported regions, etc.). */
  | { kind: "catalogue"; source: string }
  /** Directional aspirational target — reviewer must confirm before ship. */
  | { kind: "aspirational"; note: string };

export interface MarketingMetric {
  /** What renders on the page ("100+", "3 weeks → 2 days", "€0"). */
  value: string;
  /** The one-line label the reader sees underneath the value. */
  label: string;
  /** Where the number comes from and how it is substantiated. */
  provenance: MetricProvenance;
}

// ─── Top-of-page STAT strip (index.tsx `Stats`) ────────────────────────
// Rendered as a 4-column strip beneath the DecisionBrief.
export const HOMEPAGE_STATS: MarketingMetric[] = [
  {
    value: "100+",
    label: "Automated governance workflows",
    // Refers to the count of pre-authored governance workflows shipped
    // in the product catalogue (decision types × approval chains).
    provenance: {
      kind: "aspirational",
      note: "TODO(marketing): verify against src/lib/decision-lifecycle catalogue count before next campaign refresh.",
    },
  },
  {
    value: "179",
    label: "Governance rules enforced",
    // Refers to the count of rules in the governance policy engine.
    provenance: {
      kind: "aspirational",
      note: "TODO(marketing): tie to a specific rule-registry count.",
    },
  },
  {
    value: "211",
    label: "Countries monitored by AICIS",
    // AICIS = Autonomous Intelligence & Country Insight System.
    // 211 is the ISO 3166-1 alpha-2 country + territory count.
    provenance: {
      kind: "catalogue",
      source: "ISO 3166-1 alpha-2 country and territory count.",
    },
  },
  {
    value: "15+",
    label: "Enterprise data connectors",
    // Refers to the count of production connectors (SAP, Salesforce,
    // Dynamics, HubSpot, NetSuite, BigQuery, Snowflake, S3, Sheets, REST).
    provenance: {
      kind: "catalogue",
      source: "src/pages/DataConnectors.tsx — production connector list.",
    },
  },
];

// ─── SocialProof stat panel (index.tsx `SocialProof`) ──────────────────
// Rendered as a 2×2 grid alongside the CRO testimonial.
export const HOMEPAGE_SOCIAL_PROOF: MarketingMetric[] = [
  {
    value: "3 weeks → 2 days",
    label: "AI governance review cycle, after implementation",
    provenance: {
      kind: "reference",
      source:
        "Anonymised — DAX-listed industrial group pilot Q1 2026 (CRO reference on record).",
    },
  },
  {
    value: "100%",
    label: "Of AI recommendations now have a logged approval trail",
    provenance: {
      kind: "measured",
      source:
        "Product invariant — every AI-generated recommendation enters the Decision Ledger before any approval action. Enforced by the decision-lifecycle pipeline (src/lib/decision-lifecycle.ts).",
    },
  },
  {
    value: "€0 additional headcount",
    label: "Governance overhead added to achieve EU AI Act readiness",
    provenance: {
      kind: "reference",
      source:
        "Anonymised — same DAX pilot as row 1. Reference on record; do not attribute publicly without customer sign-off.",
    },
  },
  {
    value: "< 1 week",
    label: "From first call to live governance record in production",
    provenance: {
      kind: "measured",
      source:
        "Onboarding SLA target documented in docs/DEPLOYMENT_SECRETS.md; reflected in Enterprise Contact copy.",
    },
  },
];

// ─── Demo section stat strip (index.tsx `Demo`) ────────────────────────
// Rendered inside the "See Quantivis running on your data" section.
export const HOMEPAGE_DEMO_STATS: MarketingMetric[] = [
  {
    value: "< 1 week",
    label: "Typical onboarding",
    provenance: {
      kind: "measured",
      source: "Same as HOMEPAGE_SOCIAL_PROOF row 4.",
    },
  },
  {
    value: "100%",
    label: "Decisions auditable",
    provenance: {
      kind: "measured",
      source: "Same as HOMEPAGE_SOCIAL_PROOF row 2.",
    },
  },
  {
    value: "15+",
    label: "Data connectors",
    provenance: {
      kind: "catalogue",
      source: "Same as HOMEPAGE_STATS row 4.",
    },
  },
  {
    value: "211",
    label: "Countries monitored",
    provenance: {
      kind: "catalogue",
      source: "Same as HOMEPAGE_STATS row 3.",
    },
  },
];

// Helper for callers that only need the presentation tuple. Keeps the
// existing Index.tsx render layout untouched — the module is a source
// of truth, not a UI opinion.
export const toDisplayTuples = (
  items: readonly MarketingMetric[],
): [string, string][] => items.map(({ value, label }) => [value, label]);

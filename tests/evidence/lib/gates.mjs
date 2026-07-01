// tests/evidence/lib/gates.mjs
// Single source of truth for gate composition and scoring weights.
// Mirrors docs/enterprise/RELEASE_GATE.md. If you change one, change both.

export const GATES = Object.freeze([
  {
    key: "authentication",
    label: "Authentication",
    weight: 10,
    pipelines: ["authentication", "mfa", "oauth", "session-recovery"],
  },
  {
    key: "authorization",
    label: "Authorization",
    weight: 10,
    pipelines: [
      "protected-routes",
      "user-management",
      "organization-management",
      "settings",
    ],
  },
  {
    key: "tenant_isolation",
    label: "Tenant Isolation",
    weight: 15,
    pipelines: ["tenant-isolation", "edge-functions", "realtime"],
  },
  {
    key: "decision_pipeline",
    label: "Decision Pipeline",
    weight: 10,
    pipelines: [
      "decision-creation",
      "decision-editing",
      "decision-approval",
      "decision-rejection",
      "decision-ledger",
    ],
  },
  {
    key: "evidence_pipeline",
    label: "Evidence Pipeline",
    weight: 10,
    pipelines: [
      "evidence-attachment",
      "evidence-retrieval",
      "evidence-export",
    ],
  },
  {
    key: "governance",
    label: "Governance",
    weight: 10,
    pipelines: ["governance-workflow", "confidence-scoring"],
  },
  {
    key: "ai",
    label: "AI Pipeline",
    weight: 10,
    pipelines: ["ai-recommendation", "ai-explanation"],
  },
  {
    key: "audit",
    label: "Audit",
    weight: 0, // non-scoring but hard-blocking
    pipelines: ["audit-trail"],
  },
  {
    key: "reports",
    label: "Reports",
    weight: 5,
    pipelines: ["reports", "executive-exports"],
  },
  {
    key: "notifications",
    label: "Notifications",
    weight: 0, // non-scoring but hard-blocking
    pipelines: ["notifications"],
  },
  {
    key: "billing",
    label: "Billing",
    weight: 0, // non-scoring but hard-blocking
    pipelines: ["billing", "credits"],
  },
  {
    key: "scalability",
    label: "Scalability",
    weight: 10,
    pipelines: ["dashboard-loading", "background-jobs"],
  },
  {
    key: "recovery",
    label: "Recovery",
    weight: 10,
    pipelines: ["recovery", "rollback"],
  },
  {
    key: "system_health",
    label: "System Health",
    weight: 10,
    pipelines: [
      "system-health",
      "search",
      "data-import",
      "dataset-versioning",
    ],
  },
]);

// Sanity: scoring weights normalized to 100
export const TOTAL_WEIGHT = GATES.reduce((s, g) => s + g.weight, 0); // 120

// Release-recommendation matrix
export const RECOMMENDATION = Object.freeze({
  PASS: { ship: "ship", label: "Ship" },
  PASS_WITH_WARNINGS: { ship: "ship", label: "Ship with acknowledgement" },
  CONDITIONAL_RELEASE: { ship: "hold", label: "Hold — conditional" },
  BLOCKED: { ship: "hold", label: "Hold — blocked" },
  CRITICAL_BLOCK: { ship: "rollback", label: "Rollback / do not deploy" },
});

/**
 * Governance Risk Rules — Single source of truth
 * 
 * Used by: GovernanceCommandView, GovernanceExport, tests
 */

export interface RiskContext {
  stewardCount: number;
  retentionCount: number;
  maturityScore: number | null;
  weakestScore: number | null;
  weakestName: string | null;
}

export interface GovernanceRisk {
  label: string;
  severity: "high" | "medium" | "low";
  rule: string;
}

interface RiskRule {
  check: (ctx: RiskContext) => boolean;
  getLabel: (ctx: RiskContext) => string;
  severity: "high" | "medium";
  rule: string;
}

export const GOVERNANCE_RISK_RULES: RiskRule[] = [
  {
    check: (c) => c.stewardCount === 0,
    getLabel: () => "No Data Stewards assigned",
    severity: "high",
    rule: "Triggered when steward count = 0. Without accountability, governance cannot be enforced.",
  },
  {
    check: (c) => c.retentionCount < 3,
    getLabel: () => "Retention policies incomplete",
    severity: "high",
    rule: "Triggered when fewer than 3 of 6 data categories have a retention policy defined.",
  },
  {
    check: (c) => c.maturityScore !== null && c.maturityScore < 40,
    getLabel: () => "Governance maturity below threshold",
    severity: "high",
    rule: "Triggered when maturity assessment score is below 40/100 (Initial or Developing level).",
  },
  {
    check: (c) => c.maturityScore !== null && c.maturityScore >= 40 && c.maturityScore < 60,
    getLabel: () => "Governance maturity developing — not yet managed",
    severity: "medium",
    rule: "Triggered when maturity score is 40–59 (Defined level, but not yet Managed).",
  },
  {
    check: (c) => c.weakestScore !== null && c.weakestScore < 30,
    getLabel: (c) => `Weak dimension: ${c.weakestName} (${c.weakestScore}%)`,
    severity: "medium",
    rule: "Triggered when any governance dimension scores below 30%.",
  },
];

export function evaluateGovernanceRisks(ctx: RiskContext): GovernanceRisk[] {
  const risks: GovernanceRisk[] = [];
  for (const r of GOVERNANCE_RISK_RULES) {
    if (r.check(ctx)) {
      risks.push({ label: r.getLabel(ctx), severity: r.severity, rule: r.rule });
    }
  }
  if (risks.length === 0) {
    risks.push({ label: "No critical governance risks detected", severity: "low", rule: "All governance checks passed." });
  }
  return risks;
}

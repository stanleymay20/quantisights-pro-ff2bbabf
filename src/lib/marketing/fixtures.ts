/**
 * Marketing-surface fixtures — illustrative decision data.
 *
 * These entries feed the animated Decision Ledger mock in the homepage
 * hero. They are **not** live customer data and cannot be. The homepage
 * is a public surface; rendering real customer decisions there would
 * breach tenant isolation, GDPR, and the EU AI Act audit boundary.
 *
 * The "Illustrative data — not a live customer record" banner rendered
 * next to this ticker (see Sprint 1 output) is the visible contract to
 * the visitor: everything below the banner is a designed example, not a
 * tenant record.
 *
 * These fixtures live here (rather than inline in src/pages/Index.tsx)
 * so that:
 *   1. The homepage is not commingled with fixture data.
 *   2. Anyone reading the file immediately sees the disclosure comment.
 *   3. A future case-study replacement can swap this file without
 *      touching page markup.
 *
 * If a customer reference agrees to be named, replace the entries here
 * with anonymised-with-permission data (initials only, redacted amounts)
 * and update the banner copy to match.
 */

export interface IllustrativeDecision {
  /** Synthetic decision ID — not a real ledger ID. */
  id: string;
  category:
    | "Risk Mitigation"
    | "Revenue Growth"
    | "Cost Optimisation"
    | "Supply Chain";
  /** 0-100 confidence, matches the visual convention in ConfidenceBadge. */
  confidence: number;
  /** Formatted currency string, e.g. "+€20K". Not computed. */
  impact: string;
  /** Matches TagBadge tone via tagNameToTone. */
  tag: "Pending" | "Approved" | "Review";
  /** Relative time string. Static — the ticker animates through the array. */
  time: string;
  /** Governance-column pill label. */
  governance: "Active" | "Logged";
}

export const HOMEPAGE_LEDGER_FIXTURES: readonly IllustrativeDecision[] = [
  {
    id: "DL-2847",
    category: "Risk Mitigation",
    confidence: 90,
    impact: "+€20K",
    tag: "Pending",
    time: "2m ago",
    governance: "Active",
  },
  {
    id: "DL-2846",
    category: "Revenue Growth",
    confidence: 88,
    impact: "+€15K",
    tag: "Approved",
    time: "14m ago",
    governance: "Logged",
  },
  {
    id: "DL-2845",
    category: "Cost Optimisation",
    confidence: 85,
    impact: "+€8K",
    tag: "Review",
    time: "31m ago",
    governance: "Active",
  },
  {
    id: "DL-2844",
    category: "Supply Chain",
    confidence: 92,
    impact: "+€42K",
    tag: "Approved",
    time: "1h ago",
    governance: "Logged",
  },
  {
    id: "DL-2843",
    category: "Risk Mitigation",
    confidence: 79,
    impact: "+€11K",
    tag: "Pending",
    time: "2h ago",
    governance: "Active",
  },
] as const;

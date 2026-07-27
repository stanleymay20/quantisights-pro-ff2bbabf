/**
 * Marketing-surface source of truth.
 *
 * Import from `@/lib/marketing`. See metrics.ts and fixtures.ts for the
 * substantive documentation on what these values are and are not.
 */
export {
  HOMEPAGE_STATS,
  HOMEPAGE_SOCIAL_PROOF,
  HOMEPAGE_DEMO_STATS,
  toDisplayTuples,
} from "./metrics";
export type { MarketingMetric, MetricProvenance } from "./metrics";

export { HOMEPAGE_LEDGER_FIXTURES } from "./fixtures";
export type { IllustrativeDecision } from "./fixtures";

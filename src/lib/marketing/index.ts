/**
 * Marketing-surface source of truth.
 *
 * Import from `@/lib/marketing`. See metrics.ts and fixtures.ts for the
 * substantive documentation on what these values are and are not.
 *
 * Runtime hook `useHomepageMetrics` pulls real snapshot data from the
 * `get_latest_trust_metrics` RPC (same source of truth as the Trust
 * Center). Static exports below are defensible fallbacks — catalogue
 * facts and copy — used when the snapshot is unavailable.
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

export {
  useHomepageMetrics,
  fmtPct,
  fmtCount,
  fmtRelativeFromNow,
} from "./use-homepage-metrics";
export type {
  TrustSnapshot,
  HomepageMetricsState,
} from "./use-homepage-metrics";

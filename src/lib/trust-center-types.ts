/**
 * TC-1 — Enterprise Trust Center types.
 *
 * The Trust Center is an observability/transparency layer only. Every value
 * it surfaces is either a literal constant already exported by an existing
 * module, or a manually-verified statement backed by cited file paths. It
 * never computes a score, never simulates a metric, and never infers
 * "implemented" from the mere existence of a file — a capability is only
 * "Implemented" if it is both coded AND reachable from a live user-facing
 * path (a page, hook, or edge function actually importing it).
 */

export const TRUST_CENTER_SCHEMA_VERSION = "quantivis.trust-center.v1";

/**
 * "Implemented"           — coded, tested, and reachable from a live path.
 * "Partially Implemented" — coded and tested, but missing a real backend,
 *                           not wired into a live path, or covering only
 *                           part of the described capability.
 * "Planned"                — named/referenced in prior task instructions or
 *                           docs, but no code exists yet.
 * "Not Implemented"       — no code and no forward reference exists.
 * "Unknown"                — could not be verified from the current
 *                           implementation; never assumed to exist.
 */
export type CapabilityStatus =
  | "Implemented"
  | "Partially Implemented"
  | "Planned"
  | "Not Implemented"
  | "Unknown";

export interface CapabilityEntry {
  key: string;
  label: string;
  status: CapabilityStatus;
  detail: string;
  /** File or doc paths that back this assessment. Empty only when status is "Not Implemented" or "Unknown". */
  evidence: string[];
}

/** Exact wording required by TC-1: never a green/healthy indicator unless a live, queryable signal actually exists. */
export type HealthLabel = "NOT AVAILABLE" | "NOT IMPLEMENTED";

export interface RuntimeHealthEntry {
  key: string;
  label: string;
  health: HealthLabel;
  detail: string;
  /** Key into the capability matrix this health entry describes. */
  relatedCapability: string;
  evidence: string[];
}

export interface EvidenceIntegrityEntry {
  key: string;
  label: string;
  status: CapabilityStatus;
  detail: string;
  evidence: string[];
}

export interface GovernanceStatusEntry {
  key: string;
  label: string;
  status: CapabilityStatus;
  detail: string;
  evidence: string[];
}

export interface VersionEntry {
  key: string;
  component: string;
  version: string;
  schemaVersion: string | null;
  source: string;
}

export interface LimitationEntry {
  key: string;
  label: string;
  status: CapabilityStatus;
  detail: string;
}

export interface EnterpriseReadinessRow {
  key: string;
  dimension: string;
  /** Plain-language, non-numeric assessment. Never a computed score. */
  assessment: string;
  citedSources: string[];
}

export interface PlatformOverview {
  version: string;
  versionSource: string;
  environment: string;
  environmentSource: string;
  buildTimestamp: string | null;
  buildTimestampNote: string;
  gitCommit: string | null;
  gitCommitNote: string;
  deploymentStatus: string;
  deploymentStatusNote: string;
}

export interface TrustCenterData {
  schemaVersion: typeof TRUST_CENTER_SCHEMA_VERSION;
  generatedAt: string;
  overview: PlatformOverview;
  capabilities: CapabilityEntry[];
  runtimeHealth: RuntimeHealthEntry[];
  evidenceIntegrity: EvidenceIntegrityEntry[];
  governance: GovernanceStatusEntry[];
  versions: VersionEntry[];
  limitations: LimitationEntry[];
  enterpriseReadiness: EnterpriseReadinessRow[];
}

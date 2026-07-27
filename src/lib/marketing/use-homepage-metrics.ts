/**
 * useHomepageMetrics — pulls real, cross-tenant, publicly-safe metrics
 * from the same production data path the Trust Center uses.
 *
 * Backing service
 * ---------------
 * `supabase.rpc("get_latest_trust_metrics")` — a SECURITY DEFINER RPC
 * granted to `anon` that returns the latest row from
 * `trust_metrics_snapshots`. The snapshot is refreshed daily by the
 * `compute-trust-metrics` edge cron; every metric carries provenance,
 * a sha256 evidence hash, and a generated-at timestamp visible on
 * /trust.
 *
 * Rendering contract
 * ------------------
 * The homepage should always be able to render *something*. If the
 * snapshot is unavailable (fresh install, cron not yet run, transient
 * failure), the hook returns `status: "pending"` and callers should
 * fall back to defensible catalogue facts (ISO country count,
 * shipped-connector count) or hide the tile — never fall back to a
 * fabricated number.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TrustSnapshot {
  snapshot_date: string | null;
  rls_coverage_pct: number | null;
  audit_coverage_pct: number | null;
  explainability_coverage_pct: number | null;
  intervention_traceability_pct: number | null;
  retention_compliance_pct: number | null;
  unresolved_critical_incidents: number | null;
  connector_health_pct: number | null;
  dq_confidence_avg: number | null;
  drift_monitor_coverage_pct: number | null;
  failed_auth_24h: number | null;
  evidence_generated_at: string | null;
  evidence_version: string | null;
  evidence_hash: string | null;
}

export type HomepageMetricsState =
  | { status: "loading"; snapshot: null }
  | { status: "ready"; snapshot: TrustSnapshot }
  | { status: "pending"; snapshot: null }
  | { status: "error"; snapshot: null; error: string };

/**
 * Fetches the latest trust-metrics snapshot for the public homepage.
 * Runs client-side (SPA), so there's a brief loading window on first
 * render — callers should render a skeleton until `status === "ready"`.
 */
export function useHomepageMetrics(): HomepageMetricsState {
  const [state, setState] = useState<HomepageMetricsState>({
    status: "loading",
    snapshot: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_latest_trust_metrics");
        if (cancelled) return;
        if (error) {
          setState({ status: "error", snapshot: null, error: error.message });
          return;
        }
        if (!data) {
          setState({ status: "pending", snapshot: null });
          return;
        }
        setState({ status: "ready", snapshot: data as unknown as TrustSnapshot });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          snapshot: null,
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** Format a percentage metric for headline display: `94.3%`, `100%`, or `—`. */
export function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

/** Format an integer count for headline display: `241`, `—`. */
export function fmtCount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return String(Math.round(value));
}

/**
 * Relative "Xm/h/d ago" formatting for the snapshot freshness badge.
 * Matches the tone used in the Trust Center (`LastVerifiedBadge`).
 */
export function fmtRelativeFromNow(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  if (diffMs < 0) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

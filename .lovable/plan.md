# Pilot-Readiness Fix Plan

Eight distinct problems from the Claude audit, sequenced so each phase is independently shippable and testable. Nothing gets touched outside its phase.

## Phase 1 — Visible data hygiene (highest signal, lowest risk)

Goal: stop the "product looks broken" first impression on every screen.

1. **Dedupe stub decisions in `decision_ledger`**
   Keep-oldest strategy, scoped to rows matching `title = 'EU AI Act enforcement guidance updated' AND (expected_impact_eur = 0 OR expected_impact_eur IS NULL)`. Soft-delete via a new `is_suppressed` filter rather than hard delete, so the audit trail survives.
2. **Add a global filter** in `useDecisionLedger`, Dashboard, Deliberation, AI Boardroom, Decision History queries to hide `is_suppressed = true`.
3. **Reconcile the "outcomes measured" number** across Outcome Tracking, System Health, Decision Ledger Completed tab — one shared RPC `count_measured_outcomes(org_id)` used by all three.

## Phase 2 — Front-end bugs

4. **Executive Intelligence `.join()` crash** — locate the undefined array (likely `insights[].tags` or `narrative.themes`), add nullish-coalescing, wrap the offending block in existing `SectionErrorBoundary` with a real fallback (not just swallow).
5. **Ask Quantivis markdown rendering** — `MessageBubble` currently renders assistant content as plain text; swap in `react-markdown` + `remark-gfm` (already sanitized via existing DOMPurify wrapper). No design changes; keep monospace for code fences.

## Phase 3 — Ingestion + breaker

6. **AICIS `/signals` 221-failure streak**
   - Root cause first via `supabase--edge_function_logs` for `sync-aicis-bridge`. Two likely culprits: expired `AICIS_API_KEY` (401 loop) or endpoint shape drift.
   - Make the breaker actually trip: current `_shared/circuit-breaker.ts` uses `Map<string, CircuitState>` in-memory per edge invocation — state is lost between cold starts, so 221 sequential failures each reset to `failures=0`. Fix: persist circuit state in `connector_circuit_state` table (already exists) and read/write on each call.
   - Reconcile AICIS Sync page vs Bridge Health: both should read from the same source (`connector_sync_runs` + `connector_circuit_state`), not independent counters.

## Phase 4 — Governance audit + cron

7. **Backfill `audit_log` for the 125 existing decisions** — one-shot SQL migration that inserts a `decision.created` row per existing `decision_ledger` entry missing an audit trail, using `created_at` as the event timestamp and `created_by` as actor. Idempotent via `NOT EXISTS` guard.
8. **Kick the 6 dormant pg_cron jobs at least once** so the learning loop shows a run. Manually invoke each of: `evaluate-outcomes`, `adaptive-calibration`, `retention-cleanup`, `morning-brief`, `convergence-reconcile`, `health-check` via `supabase.functions.invoke`. Then verify `cron_run_log` gets rows. If any job is genuinely disabled in `pg_cron.job`, re-enable it.

## Phase 5 — Content-relevance guardrails (deferred, needs separate scoping)

The "€30 critical decision" and "Amazon data → EU AI Act recommendation" issues are recommendation-engine semantic mismatches — fixing them properly means retraining the advisory prompt with column-type awareness. Out of scope for pilot readiness; will document as known limitation and gate low-impact recommendations behind a €1,000 threshold as a stopgap.

## Sequencing

Phases 1 → 2 → 3 → 4 run sequentially, each with a git-shippable stopping point. After each phase I'll verify against the specific audit finding (Playwright screenshot for UI, SQL query for data, log tail for cron).

## Technical details

- **Suppression flag**: add `is_suppressed boolean default false` to `decision_ledger` via migration + backfill. RLS unchanged.
- **Shared outcomes RPC**: `create function count_measured_outcomes(_org uuid) returns int language sql stable security definer` returning `count(*) from decision_ledger where organization_id=_org and outcome_measured_at is not null`.
- **Circuit breaker persistence**: read `connector_circuit_state` row on function entry, apply threshold check, write back on failure/success. Add `pg_advisory_xact_lock` to prevent race between concurrent invocations.
- **Markdown**: `react-markdown@9` is already in the dependency tree via other components (verify with `rg`).
- **Audit backfill**: single migration file `20260713_backfill_decision_audit.sql`.

## Non-goals

- Not fixing the seed-data content itself (Amazon columns feeding EU AI Act text) — that's a Phase 5 semantic issue.
- Not touching the 128-page German translation work in flight.
- Not changing pricing/thresholds beyond the €1,000 stopgap.

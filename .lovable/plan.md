# Quantivis Scalability & E2E Load-Testing Framework (v4)

**Status:** Framework only — no execution beyond manual 1-user smoke. v4 extends v3 coverage to all 12 product pipelines.

---

## 0. Prerequisite gate (HARD BLOCK) — unchanged from v3

- **F-1** PKCE double-exchange — **fixed** (`src/pages/AuthCallback.tsx`, removed racing explicit exchange).
- **F-2** Stale chunk reload — **fixed** (`src/lib/chunk-reload-guard.ts` installed in `src/main.tsx`).

Smoke + 10 VU stages may run **only after both fixes are live in the target environment** or `LOAD_PREREQ_WAIVED=yes`.

---

## 1. What v4 adds over v3

| Area | v3 | v4 |
|---|---|---|
| Pipelines covered | auth + dashboard + decisions + audit + tenant isolation | **12 pipelines** (auth, onboarding, data, decision, AI, governance, reports, team, billing, notifications, admin, perf) |
| Coverage matrix | implicit | explicit `tests/COVERAGE_MATRIX.md` |
| k6 workflows | dashboard, decisions, audit, tenant-isolation, business-outcome | **+ data-pipeline, governance, reports, notifications, billing** |
| Playwright specs | smoke, auth-session, long-session | **+ full-journey, auth-guard** (more in §3) |
| Audit immutability assertion in load | — | governance workflow probes `audit_log` UPDATE → expects 4xx |
| Run-scoped cleanup | org id only | org id **+ `test_run_id` stamp** on every write |
| Billing safety | — | k6 path is **read-only**; PW asserts checkout URL host without completing |
| Connector pulls | name-blocked | reaffirmed name-blocked + listed under "Remaining gaps" with rationale |

Full per-feature matrix lives in [`tests/COVERAGE_MATRIX.md`](../tests/COVERAGE_MATRIX.md).

---

## 2. Tool selection

| Layer | Tool |
|---|---|
| Browser smoke (1 + 10 VU), full-journey, long-session, OAuth probe | **Playwright** |
| API load (50, 100, 1000 VU), AI chaos, tenant isolation | **k6** |
| Edge function inventory + coverage matrix CI | Node script (`inventory/edge-function-matrix.mjs`) |
| Integrity (orphans, audit-chain) | Node + Postgres service role |
| Release gate aggregator | Node script |

---

## 3. Playwright spec inventory

| Spec | Purpose | Auth needed |
|---|---|---|
| `e2e/smoke.spec.ts` (existing) | minimal happy path | yes |
| `e2e/auth-guard.spec.ts` **(new)** | protected-route redirect probes | no |
| `e2e/auth-session.spec.ts` (existing) | login persistence + expired-session recovery + logout | yes |
| `e2e/auth-callback.spec.ts` *(scaffold pending)* | PKCE single-exchange regression for F-1 | mocked |
| `e2e/onboarding.spec.ts` *(scaffold pending)* | profile/org/workspace/role bootstrap | yes (fresh user) |
| `e2e/data-pipeline.spec.ts` *(scaffold pending)* | CSV upload, listing, validation, empty state | yes |
| `e2e/decisions.spec.ts` *(scaffold pending)* | create/approve/reject lifecycle | yes |
| `e2e/ai-fallback.spec.ts` *(scaffold pending)* | mocked AI failure → graceful UI + audit | yes |
| `e2e/governance.spec.ts` *(scaffold pending)* | trust badges, timeline, compliance mapping | yes |
| `e2e/reports.spec.ts` *(scaffold pending)* | PDF/PPTX download capture, error path | yes |
| `e2e/permissions.spec.ts` *(scaffold pending)* | invite, role change, 403 surface | yes |
| `e2e/billing.spec.ts` *(scaffold pending)* | pricing + checkout intent only | yes |
| `e2e/notifications.spec.ts` *(scaffold pending)* | bell read/unread + system-status | yes |
| `e2e/security.spec.ts` *(scaffold pending)* | MFA gate, step-up, access denial | yes |
| `e2e/full-journey.spec.ts` **(new)** | 1-user walk across §1–§11 | yes |
| `e2e/long-session.spec.ts` (existing) | 30–60 min memory leak watch | yes |

Specs marked *(scaffold pending)* are reserved file names in `COVERAGE_MATRIX.md`; they will be authored against the seeded staging fixture in a follow-up turn so that they have a real database to assert against. None are required for the 1-user smoke.

---

## 4. k6 scenario + workflow inventory

| Scenario | Workflows mixed | Cap |
|---|---|---|
| `01-smoke.js` | auth + dashboard | 1 VU, 1 iter |
| `02-small.js` | auth + dashboard + decisions | 10 VU, 1 min |
| `03-load-50.js` | data-pipeline 30 / decisions 30 / governance 20 / reports 10 / notifications 10 + tenant-isolation tail | 50 VU, 5 min |
| `04-load-100.js` | same mix, higher RPS | 100 VU, 5 min |
| `05-stress-1000.js` | 80 read / 20 write across data + decisions + governance + notifications | 1000 VU, **10 min, 150k iter, no unbounded ramping** |
| `06-ai-chaos.js` | mock-ai timeout / 429 / 503 / malformed JSON rotation | 20 VU, 5 min |

Workflow modules (`tests/load/workflows/`):
- `dashboard.js`, `decisions.js`, `audit.js`, `tenant-isolation.js`, `business-outcome.js` (existing)
- **`data-pipeline.js`, `governance.js`, `reports.js`, `notifications.js`, `billing.js`** (new in v4)

---

## 5. Mock + safety policy (unchanged from v3, restated)

- `LOAD_AI=mock` (default) → `x-test-mock: 1` routes to `supabase/functions/mock-ai/`.
- Live AI requires `LOAD_AI=live` + `LOAD_AI_BUDGET_USD`.
- Email senders, connector pulls, demo seeders, `data-export`, `auto-create-decisions` — name-blocked in `lib/mock-headers.js`.
- Fake-TLD users (`*.quantivis.test`) with `email_confirm: true` so no real mail leaves.
- Production locked behind `LOAD_TARGET=production && LOAD_CONFIRM_PROD=I_UNDERSTAND`.

---

## 6. Pass/fail thresholds — see `tests/COVERAGE_MATRIX.md` §Pass/Fail.

Adds these v4 hard-fail criteria across **every** stage:
- `audit_log` UPDATE/DELETE returns 2xx → **Critical**.
- Billing workflow returns Stripe redirect with non-`checkout.stripe.com` host → **High**.
- `mock-ai` returns non-deterministic payload (hash mismatch vs fixture) → **High**.

---

## 7. Data cleanup (extended)

- Every write tags `metadata.test_run_id = $LOAD_RUN_ID` (uuid generated by `guard()`).
- `npm run load:teardown` deletes by `(organization_id IN loadtest, metadata->>test_run_id = $LOAD_RUN_ID)` from the table list in `COVERAGE_MATRIX.md` §Data cleanup.
- `npm run load:verify-teardown` asserts zero rows remaining; non-zero blocks release gate.
- Storage uploads use prefix `loadtest/<run_id>/` and are purged in teardown.

---

## 8. Coverage matrix CI gate (unchanged from v3)

`tests/load/inventory/edge-function-matrix.mjs` enumerates every function under `supabase/functions/` and fails the CI job when any function is neither allow-listed, mocked, nor explicitly excluded.

---

## 9. Release gate (unchanged from v3)

`tests/load/release-gate/run-gate.mjs` aggregates the latest reports and emits **GO** or **NO GO** with per-criterion justification. v4 adds three criteria to `gate-criteria.json`:
- `audit_immutability`
- `billing_safety`
- `tenant_isolation_extended` (now covers data + governance + reports tables, not only decisions)

---

## 10. What I will NOT do this turn

- Execute any stage above the 1-user smoke.
- Author the per-pipeline Playwright specs marked *(scaffold pending)* until staging seed exists (they need a real DB to assert against).
- Touch production.
- Trigger real AI, email, payments, or connector pulls.
- Seed users automatically — `SUPABASE_SERVICE_ROLE_KEY` isn't available on Lovable Cloud; seeding must run from external CI.

---

## 11. Files added / changed in v4

- `tests/COVERAGE_MATRIX.md` *(new)* — full 12-pipeline coverage table.
- `tests/load/workflows/data-pipeline.js` *(new)*
- `tests/load/workflows/governance.js` *(new — includes audit-immutability probe)*
- `tests/load/workflows/reports.js` *(new — read-only)*
- `tests/load/workflows/notifications.js` *(new)*
- `tests/load/workflows/billing.js` *(new — read-only)*
- `tests/e2e/full-journey.spec.ts` *(new)*
- `tests/e2e/auth-guard.spec.ts` *(new — no auth required, runs against preview)*
- `.lovable/plan.md` *(this file — v4)*

Existing `package.json` scripts already invoke the k6 scenarios by file path; no script changes needed for the new workflow modules since they are imported by the scenarios.

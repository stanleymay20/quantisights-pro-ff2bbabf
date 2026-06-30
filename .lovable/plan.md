# Quantivis Scalability & E2E Load-Testing Framework (v3)

**Status:** Approved with modifications — implementing **framework only**. No scenario will execute automatically. Smoke + 10 VU deferred until F-1/F-2 are resolved or waived.

---

## 0. Prerequisite gate (HARD BLOCK)

Before any E2E or load stage runs, the following must be resolved **or explicitly waived in writing**:

- **F-1** — `/auth/callback` double-exchange race (PKCE code consumed twice on remount).
- **F-2** — Stale dynamic chunk reload / cache issue after deploys.

Scripts print this banner on every invocation and refuse to run unless `LOAD_PREREQ_WAIVED=yes` or both fixes are merged.

---

## 1. Tool selection

| Layer | Tool |
|---|---|
| Browser smoke (1 + 10 VU) + long-session | **Playwright** |
| API load (50, 100, 1000 VU) | **k6** |

Browser-based 1,000 VU is off the table. 1,000 = API only.

---

## 2. Target environment policy

| Stage | Target | Default |
|---|---|---|
| Smoke 1 VU | preview | safe |
| 10 VU | preview | safe |
| 50 / 100 VU | staging | requires approval |
| 1000 VU | staging only | requires explicit confirmation |

Scripts refuse production unless `LOAD_TARGET=production` **and** `LOAD_CONFIRM_PROD=I_UNDERSTAND`.

---

## 3. Architecture

```text
tests/
├── e2e/
│   ├── smoke.spec.ts
│   ├── auth-session.spec.ts
│   ├── long-session.spec.ts
│   └── fixtures/
├── load/
│   ├── lib/{auth.js,thresholds.js,mock-headers.js,guard.js,observability.js,workflow-assert.js}
│   ├── scenarios/{01-smoke,02-small,03-load-50,04-load-100,05-stress-1000,06-ai-chaos}.js
│   ├── workflows/{dashboard,decisions,audit,tenant-isolation,business-outcome}.js
│   ├── inventory/{edge-function-matrix.mjs,coverage-report.mjs}
│   ├── integrity/{verify-integrity.mjs}
│   ├── release-gate/{run-gate.mjs,gate-criteria.json}
│   ├── seed-users.mjs
│   ├── teardown.mjs
│   └── verify-teardown.mjs
└── README.md
```

Edge-function allow-list in `lib/mock-headers.js`. Destructive functions (`seed-demo-data`, `data-export`, connector pulls, `auto-create-decisions`, email senders) name-blocked.

---

## 4. Test data & seed users

- **Two** staging orgs: `org_loadtest_a`, `org_loadtest_b` (`is_demo=true`).
- Seed via `tests/load/seed-users.mjs` with staging service-role key.
  - Emails: `loadtest-a+{i}@quantivis.test`, `loadtest-b+{i}@quantivis.test` (reserved-style fake TLD, `email_confirm: true` → no real emails).
  - Random 32-char passwords → `tests/load/.users.json` (gitignored).
- 1,000 users seeded once, reused.

### Avoiding real emails / OAuth / AI cost
- Fake TLD + admin `email_confirm: true`; email-sending functions blocked.
- k6 uses password grant only — no Google round-trip.
- Default `LOAD_AI=mock` → `x-test-mock: 1` hits `mock-ai` stub. Live mode requires `LOAD_AI_BUDGET_USD`.

---

## 5. Workflows

| Stage | Steps |
|---|---|
| Smoke (1) | home → login → dashboard → /decisions → create decision → /auditability → logout |
| Small (10) | same, Playwright workers |
| 50 / 100 (k6) | login → dashboard reads → create decision → mock evidence → mock AI → mock report |
| 1000 (k6) | 80% read / 20% write, hard-capped (§9) |

### 5a. Tenant isolation
`workflows/tenant-isolation.js` at end of every load stage:
1. Sign in as org A user.
2. Try `GET /rest/v1/decision_ledger?organization_id=eq.{org_b_id}` → expect empty.
3. Try `POST` to org B → expect deny.
4. Repeat for `metrics`, `insights`, `audit_log`, `evidence_sources`.
5. Any cross-tenant access = Critical, suite aborts.

### 5b. Business outcome validation
Per completed workflow verify:
- decision row created (`decision_ledger.id` returned)
- evidence linked (`evidence_sources.decision_id` matches)
- recommendation generated/mocked (`ai_explanations` row or mock receipt)
- confidence recorded (non-null `calibration` / `confidence`)
- ledger entry persisted
- audit appended (`audit_log` row referencing decision)
- report completion ack (mock or real)

Counter: `workflow_success_rate`. Partial workflow = failed transaction.

### 5c. AI provider failure simulation (`06-ai-chaos.js`)
Mock-AI returns, on rotation:
- timeout (no response in 30s)
- HTTP 429
- malformed JSON
- 503 unavailable

Assert: retry attempted, fallback path taken (or graceful error), audit entry written, user-facing notification surfaced (verified via Playwright probe).

### 5d. Long browser session (`long-session.spec.ts`)
Single Playwright session 30–60 min:
- dashboard refresh loop
- decision create
- navigation across 8 routes
- mocked report generation

Assertions: no console errors, `performance.memory.usedJSHeapSize` growth <2× baseline, no React hydration warnings, WS reconnects ≤3.

---

## 6. Metrics, observability & thresholds

`lib/observability.js` captures on **every** failed request:
- `x-request-id`, `traceparent`, user id, org id, edge function name, error correlation id, status, latency, scenario, VU.
- Aggregated into `tests/load/reports/observability-{stage}.json` with one trace ID lookup per failure.

Standard metrics: p50/p95/p99, error rate, tagged sub-metrics (`auth`/`rest_read`/`rest_write`/`edge_fn`), custom counters (`auth_failures`, `db_429`, `db_5xx`, `edge_fn_failures`, `ai_failures`, `cross_tenant_leaks`, `workflow_failures`), `x-ratelimit-remaining` Trend, `/system-health` polling.

### Pass/fail gates

| Metric | 50 VU | 100 VU | 1000 VU |
|---|---|---|---|
| p95 read | <800ms | <1.2s | <2.5s |
| p95 write | <1.5s | <2s | <4s |
| error rate | <0.5% | <1% | <3% |
| 5xx | 0 | 0 | <0.5% |
| `cross_tenant_leaks` | **0** | **0** | **0** |
| `workflow_success_rate` | ≥99% | ≥98% | ≥95% |

### Rate-limit policy
- 429s at 50/100 VU → **High** (unless pre-declared).
- 429s at 1,000 VU → **capacity boundary**, not necessarily a bug.

---

## 7. Edge Function coverage matrix

`inventory/edge-function-matrix.mjs` enumerates every function in `supabase/functions/` and produces `reports/edge-function-matrix.csv`:

| function | authenticated | public | mocked | load-tested | excluded | reason |
|---|---|---|---|---|---|---|

CI fails if any function has all of `mocked=false`, `load-tested=false`, `excluded=false`. No silent omissions.

---

## 8. Data integrity verification

`integrity/verify-integrity.mjs` (read-only SQL via service role) after each stage:
- no orphan `decision_ledger.organization_id`
- no orphan `evidence_sources.decision_id`
- audit chain contiguous (no missing parent refs)
- `organization_id` references valid
- no duplicate `decision_ledger` (composite uniqueness check)
- no duplicate `audit_log` (idempotency key check)

Non-zero finding → exit 1, blocks release gate.

---

## 9. Safety, caps & rollback

- `guard()` opens every script: prints target/VU/AI mode + F-1/F-2 reminder; exits unless `--yes` or matching env set.
- **1,000 VU caps:** max duration **10 minutes**, max iterations **150,000**, `constant-arrival-rate` only — **no unbounded ramping**.
- Writes scoped to `LOAD_ORG_A_ID`/`LOAD_ORG_B_ID` only.
- Kill switch: `pkill -f k6`.

### Teardown verification
`load:verify-teardown` asserts **zero rows** for: load-test `auth.users`, `organizations`, `decision_ledger`, `evidence_sources`, `audit_log`, `reports`, `intelligence_audit_trail`, `profiles`, `organization_members`, `workspace_members`. Non-zero → exit 1.

---

## 10. Enterprise Release Gate

`release-gate/run-gate.mjs` aggregates the latest reports and emits **GO** or **NO GO** with justification. All must pass:

- ✓ Authentication
- ✓ Authorization
- ✓ Tenant isolation
- ✓ Decision workflow
- ✓ Audit trail
- ✓ Evidence chain
- ✓ AI orchestration
- ✓ Report generation
- ✓ Zero critical issues
- ✓ No data corruption
- ✓ Load thresholds met

Output: `reports/release-gate-{timestamp}.md` with per-criterion status and trace links.

---

## 11. package.json commands

```json
"scripts": {
  "test:e2e:smoke": "playwright test tests/e2e/smoke.spec.ts",
  "test:e2e:small": "playwright test tests/e2e/auth-session.spec.ts --workers=10",
  "test:e2e:long": "playwright test tests/e2e/long-session.spec.ts",
  "load:seed": "node tests/load/seed-users.mjs",
  "load:teardown": "node tests/load/teardown.mjs",
  "load:verify-teardown": "node tests/load/verify-teardown.mjs",
  "load:integrity": "node tests/load/integrity/verify-integrity.mjs",
  "load:matrix": "node tests/load/inventory/edge-function-matrix.mjs",
  "load:gate": "node tests/load/release-gate/run-gate.mjs",
  "load:smoke": "k6 run tests/load/scenarios/01-smoke.js",
  "load:small": "k6 run tests/load/scenarios/02-small.js",
  "load:50": "k6 run tests/load/scenarios/03-load-50.js",
  "load:100": "k6 run tests/load/scenarios/04-load-100.js",
  "load:1000": "k6 run --no-connection-reuse tests/load/scenarios/05-stress-1000.js",
  "load:ai-chaos": "k6 run tests/load/scenarios/06-ai-chaos.js"
}
```

## 12. Environment variables

```
LOAD_TARGET=staging|preview|production
LOAD_BASE_URL=
LOAD_SUPABASE_URL=
LOAD_SUPABASE_ANON_KEY=
LOAD_ORG_A_ID=
LOAD_ORG_B_ID=
LOAD_USERS_FILE=tests/load/.users.json
LOAD_AI=mock|live
LOAD_AI_BUDGET_USD=5
LOAD_CONFIRM_PROD=
LOAD_PREREQ_WAIVED=             # yes only if F-1/F-2 waived
SUPABASE_SERVICE_ROLE_KEY=      # staging only
```

## 13. What I will NOT do

- Execute any scenario this turn.
- Run smoke/10 VU until F-1/F-2 fixed or waived.
- Touch production.
- Call live AI.
- Send real emails.

---

## Next step (this turn)

**Implement the testing framework only.** No execution.

Deliverables produced alongside scripts:
1. `tests/README.md` — execution guide.
2. `tests/load/inventory/edge-function-matrix.mjs` → produces test inventory + coverage matrix.
3. `tests/PREREQUISITES.md` — checklist (F-1, F-2, staging service-role key, two orgs, env vars).

Await explicit approval before running any test, including smoke.

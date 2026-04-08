# FORTUNE 10 GAP-CLOSURE ROADMAP

**Current Status:** Fortune 500 Strong · Not yet Fortune 10 Ready  
**Goal:** Close remaining proof, resilience, compliance, and scale gaps  
**Last Updated:** 2026-04-08

---

## Track 1: E2E Enterprise Workflow Tests _(P0)_
> Biggest technical credibility gap for procurement. Prove real workflows across auth → DB → edge functions → UI.

| Task | Artifact | Evidence | Exit Criteria |
|------|----------|----------|---------------|
| Auth E2E — login → session → MFA → step-up → logout | Deno integration test suite | Passing test logs with real auth tokens | All auth states verified against live infra |
| Onboarding E2E — signup → org → workspace → first dataset | Deno integration test suite | DB row verification post-signup | handle_new_user trigger creates org, profile, workspace atomically |
| Decision Lifecycle E2E — create → approve → execute → intervene → measure | Deno integration test suite | Ledger + execution_plans + interventions verified | Full lifecycle completes with audit trail |
| Data Pipeline E2E — upload → ingest → transform → metrics → insights | Deno integration test suite | Metrics table populated from uploaded CSV | End-to-end data flow verified |
| Governance E2E — RBAC → override → audit → export | Deno integration test suite | Audit log entries + role denial proof | Role enforcement + override + immutable trail |
| Billing E2E — checkout → webhook → gate → portal | Deno integration test suite | Subscription status change verified | Stripe webhook → DB → UI gate working |

**Execution order:** Auth → Onboarding → Decision → Data → Governance → Billing

---

## Track 2: Load, Stress & Chaos Validation _(P1)_ ✅ COMPLETED

> Prove correctness under enterprise-scale volume, concurrency, and failure conditions.

| Task | Artifact | Evidence | Exit Criteria | Status |
|------|----------|----------|---------------|--------|
| Load: rate limiter fires on mutation burst (35 req) | `load_test.ts` | 0 server errors, rate limiter triggers | No 5xx under burst | ✅ |
| Load: rate limiter fires on query burst (65 req) | `load_test.ts` | 0 server errors under query burst | No 5xx, 429 triggers | ✅ |
| Concurrency: `compute_scores` 50 parallel | `load_test.ts` | 0 server errors, idempotency holds | Zero 5xx under contention | ✅ |
| Concurrency: `predict_risks` 50 parallel | `load_test.ts` | 0 server errors | Graceful degradation, no crashes | ✅ |
| Chaos: interleaved mutations + queries (40 mixed) | `load_test.ts` | 0 server errors across 10 action types | No corruption under chaos | ✅ |
| Chaos: unknown action burst (20 req) | `load_test.ts` | All return <500, stable error handling | Error isolation holds | ✅ |
| Chaos: rapid sequential — cold-start resilience | `load_test.ts` | P95 <5s, max <10s across 10 sequential | Stable response times | ✅ |
| Chaos: large invalid JSON (100KB) | `load_test.ts` | Graceful 400, no crash | No 5xx on malformed input | ✅ |
| Chaos: empty body | `load_test.ts` | Graceful error, no crash | No 5xx on empty input | ✅ |
| Load: telemetry_stats 20 concurrent reads | `load_test.ts` | All return <500 | Observability stable under load | ✅ |
| Query cost: `EXPLAIN ANALYZE` all RPCs | SQL query plans | **Zero seq scans** — all use index scans | No seq scans on execution tables | ✅ |

### EXPLAIN ANALYZE Results (all execution RPCs)

| RPC / Query | Scan Type | Index Used | Execution Time |
|-------------|-----------|------------|----------------|
| `exec_infer_blockers` | Index Scan | `idx_exec_plans_decision_status` | 7.8ms |
| `exec_compute_scores_idempotent` (dedup check) | Index Scan | `idx_exec_scores_scope` | 0.1ms |
| `scan_interventions` (plans query) | Index Scan | `idx_execution_plans_org` | 2.1ms |
| `get_predictions` (active) | Index Scan | `idx_exec_predictions_active` | 0.1ms |
| `scan_interventions` (dedup check) | Index Scan | `idx_exec_interventions_open` | 0.1ms |
| `engine_health` (run_log) | Bitmap Index Scan | `idx_exec_run_log_org_type_time` | 0.2ms |


---

## Track 3: Disaster Recovery & Operational Resilience _(P1)_
> Produce evidence that the platform can recover from failures and maintain data integrity.

| Task | Artifact | Evidence | Exit Criteria |
|------|----------|----------|---------------|
| Backup & restore runbook | Documented procedure (Markdown) | Restore logs, timestamps, integrity checksums | PITR tested, data integrity verified |
| DR failover test | Test report with timeline | Failover logs, service recovery timestamps | RTO <4h, RPO <1h achieved |
| Data archival strategy | Partitioning/archival design doc | Implementation plan for execution tables | Strategy defined for events, scores, predictions, run_log |
| Incident response playbook | Runbook (Markdown) | Severity matrix, escalation paths, templates | Complete playbook with contact matrix |
| Monitoring & alerting | Alert configuration + dashboard spec | Health-check alerts, error rate thresholds | SLO violations trigger alerts within 5min |

---

## Track 4: Security & Compliance Artifacts _(P2)_
> Documentation and evidence required for Fortune 10 procurement and security review.

| Task | Artifact | Evidence | Exit Criteria |
|------|----------|----------|---------------|
| Security questionnaire (SIG/CAIQ) | Completed questionnaire document | Evidence references for each control | All controls answered with linked proof |
| Pen test scope & remediation | Scope definition + tracking sheet | Findings log with remediation status | Scope defined, tracking system ready |
| SOC 2 Type II evidence pack | Control-to-criteria mapping doc | Gap analysis + evidence documentation | >80% coverage mapped |
| Data residency & processing docs | Data flow documentation | Storage/processing/transit location map | Regulatory mapping complete |
| Architecture & control evidence | Visual architecture diagram | Security controls, data flows, trust boundaries | Diagram with annotated controls |

---

## Track 5: Architectural De-risking _(P0)_
> Reduce concentration risk and improve fault isolation in critical infrastructure.

| Task | Artifact | Evidence | Exit Criteria |
|------|----------|----------|---------------|
| Split execution-intelligence | 3+ bounded action modules | Architecture diff, import graph | Each module independently deployable/testable |
| Dead-letter / retry queue | Failed-action recovery implementation | Recovery logs, retry success metrics | No silent mutation drops |
| Per-action observability | Structured telemetry per action type | Latency/error/throughput dashboards | SLO dashboards operational |
| Circuit breaker for AI/ML calls | Breaker implementation + fallback cache | Breaker trip logs, fallback activation proof | Cascade failures prevented |

---

## Priority Matrix

| Priority | Track | Rationale |
|----------|-------|-----------|
| 🔴 P0 | Track 1 — E2E Tests | Biggest technical credibility gap for procurement |
| 🔴 P0 | Track 5 — Architectural De-risking | Reduces single-function concentration risk |
| 🟠 P1 | Track 2 — Load & Chaos | Proves system behaves at scale |
| 🟠 P1 | Track 3 — DR & Resilience | Required evidence for enterprise trust |
| 🟡 P2 | Track 4 — Compliance Artifacts | Formal procurement gate; can parallel with P0/P1 |

## Recommended Execution Order

1. **Track 1** — E2E tests → gives confidence for all later work
2. **Track 5** — Architectural split → safer refactoring with E2E safety net
3. **Track 2** — Load/chaos → measurable proof with clean architecture
4. **Track 3** — DR/resilience → operational evidence
5. **Track 4** — Compliance artifacts → procurement readiness (can parallel with 3)

---

## Success Criteria for Fortune 10 Ready

- [ ] All E2E workflows pass against real infrastructure
- [ ] Load tests demonstrate <200ms P95 for critical RPCs at 10x current volume
- [ ] Chaos tests show zero data corruption under failure conditions
- [ ] DR test completed with documented RTO <4h, RPO <1h
- [ ] SOC 2 control mapping at >80% coverage
- [ ] Execution-intelligence split into ≥3 bounded action modules
- [ ] Per-action SLO dashboards operational
- [ ] Security questionnaire completed with evidence links

---

## Previous Audit Items (Completed)

- ✅ SectionErrorBoundary on all 34 strategic pages
- ✅ Zero `: any` annotations in production code
- ✅ Double-submit guards on destructive mutations
- ✅ Silent catch blocks eliminated
- ✅ Rate limiting on execution engine
- ✅ Per-action error isolation in execution-intelligence
- ✅ Score idempotency via `exec_compute_scores_idempotent`
- ✅ Server-side step-up auth enforcement
- ✅ Retention cleanup RPC (`exec_cleanup_old_data`)
- ✅ Integration tests for execution-intelligence
- ✅ Hardcoded index strategy replaced with unbounded composite indexes
- ✅ `infer_blockers` capped at 500 with `_limit` parameter

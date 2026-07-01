# Quantivis Enterprise Evidence Matrix (EE-1)

Every production pipeline listed below MUST produce a signed evidence artifact
(`tests/evidence/pipelines/<pipeline>.mjs`) before a release is promoted.
This matrix is the single source of truth — it is consumed by
`tests/evidence/run-all.mjs` and enforced by `docs/enterprise/RELEASE_GATE.md`.

Legend
- **Entry**: first observable action a user or system agent performs.
- **Exit**: terminal observable state that proves the pipeline succeeded.
- **Positive control**: a case that MUST succeed.
- **Negative control**: a case that MUST fail with the expected denial.
- **Evidence**: files written under `audit-artifacts/YYYY-MM-DD/<pipeline>/`.
- **Gate**: release-gate section that consumes this evidence.

---

## 1. Authentication

| Field | Value |
|---|---|
| Implementation status | **IMPLEMENTED (EE-1)** — see `tests/evidence/pipelines/authentication.mjs` |
| Controls | 15 (AUTH-001 … AUTH-015) declared in `tests/evidence/pipelines/lib/auth-controls.mjs` |
| Adapter | `tests/evidence/adapters/README-auth-adapter.md` — reads `$EVIDENCE_AUTH_RESULTS` JSON produced by the existing Playwright suite (`e2e/auth.spec.ts`) |
| Purpose | Prove human + machine identity before any tenant data is touched |
| Entry | `POST /auth/v1/token` (email+password) or `signInWithOAuth` |
| Exit | Supabase session with `aal1`, `access_token`, and profile row present |
| Dependencies | Supabase Auth, `profiles` table, `handle_new_user` trigger |
| Positive controls | Valid email/password issues session; new user auto-provisions profile; PKCE callback hydrates session; MFA challenge enforced when org requires it |
| Negative controls | Bad password → 400; unknown email → 400; disabled user → 401; bad_jwt purge recovers session; unauth `/dashboard` → `/login` |
| Expected outputs | JWT, refresh token, `profiles.user_id = auth.uid()`; adapter evidence per control (route, response_status, redirect_chain, session_state, auth_state, console_errors, network_failures, screenshots) |
| Failure conditions | Missing profile row, session without `aud=authenticated`, HIBP bypass, MFA bypass, logout leaves `sb-*` keys |
| Failure codes | `AUTH_FAILURE`, `SESSION_LEAK`, `OAUTH_FAILURE`, `PKCE_FAILURE`, `SESSION_LOSS`, `REFRESH_FAILURE`, `EXPIRED_SESSION_UNHANDLED`, `BAD_JWT_LOOP`, `AUTHZ_BYPASS`, `MFA_BYPASS`, `RESET_REQUEST_FAILURE`, `RESET_COMPLETE_FAILURE`, `RECOVERY_FLOW_FAILURE`, `HYDRATION_RACE`, `LOGOUT_CLEANUP_FAILURE` |
| Evidence artifacts | `audit-artifacts/YYYY-MM-DD/authentication/evidence.json` (standard schema) + adapter-referenced screenshots |
| Release gate | Authentication (hard-blocking on `SECURITY_FAILURE` or `FRAMEWORK_INVALID`) |

## 2. OAuth (Google)

| Field | Value |
|---|---|
| Purpose | Prove third-party identity federation and PKCE flow |
| Entry | `supabase.auth.signInWithOAuth({ provider: 'google' })` |
| Exit | Callback lands on `/auth/callback`, session hydrated via `onAuthStateChange` |
| Dependencies | Google OAuth client, `AuthCallback.tsx`, session storage state |
| Positive controls | Consent → session hydrated within 5s |
| Negative controls | Missing PKCE verifier → error surfaced; replayed code → 400 |
| Evidence artifacts | `oauth-round-trip.json`, `callback-console.log` |
| Release gate | Authentication |

## 3. Session recovery

| Field | Value |
|---|---|
| Purpose | Prove refresh + reload survives without user re-auth |
| Entry | Reload of `/decisions` with expired access token |
| Exit | Silent refresh, protected content rendered |
| Positive controls | Session restored, no redirect to `/login` |
| Negative controls | Revoked refresh token → redirect to `/login` (no hang) |
| Evidence artifacts | `recovery-trace.json` |
| Release gate | Authentication |

## 4. MFA

| Field | Value |
|---|---|
| Purpose | Enforce step-up when org policy requires it |
| Entry | Login of a user whose org has `require_mfa=true` |
| Exit | `aal2` session after TOTP verification |
| Positive controls | Verified factor → access granted |
| Negative controls | Bad TOTP → 401; unenrolled user → forced to `MFAEnroll` |
| Evidence artifacts | `mfa-challenge.json`, `mfa-enroll.json` |
| Release gate | Authentication |

## 5. Protected routes

| Field | Value |
|---|---|
| Purpose | Every private route rejects anonymous access |
| Entry | Anonymous `GET` on each route registered in `src/routes/index.tsx` |
| Exit | 302 to `/login` (SPA) or 401 (API) |
| Positive controls | Authenticated user reaches route |
| Negative controls | Anonymous user redirected; role-gated route rejects wrong role |
| Evidence artifacts | `route-audit.json` (one row per route) |
| Release gate | Authorization |

## 6. Tenant isolation

| Field | Value |
|---|---|
| Purpose | Prove no cross-org read or write is possible |
| Entry | Seeded users in Org A + Org B (`tests/tenant-isolation/seed.mjs`) |
| Exit | All cross-tenant probes return empty arrays or RLS denials |
| Positive controls | Same-tenant read returns seeded canary row |
| Negative controls | Cross-tenant read returns `200 + []`; cross-tenant write returns 401/403/`42501` |
| Evidence artifacts | `probes.json`, `verdicts.json` (from `tests/tenant-isolation/run.mjs`) |
| Release gate | Tenant isolation |

## 7. Decision creation

| Field | Value |
|---|---|
| Purpose | Prove a decision row is committed with governance metadata |
| Entry | Authenticated `POST /rest/v1/decision_ledger` |
| Exit | Row present with `status='pending'`, `organization_id`, `created_by` |
| Positive controls | Insert returns 201, RLS accepts owner org |
| Negative controls | Missing `organization_id` → 400; wrong org → 403 |
| Evidence artifacts | `create.json`, `ledger-diff.json` |
| Release gate | Decision pipeline |

## 8. Decision editing

| Field | Value |
|---|---|
| Purpose | Prove edits preserve audit lineage |
| Entry | `PATCH /rest/v1/decision_ledger?id=eq.<id>` |
| Exit | Row updated, `audit_log` row appended |
| Negative controls | Non-author without role → 403 |
| Evidence artifacts | `edit.json`, `audit-appended.json` |
| Release gate | Decision pipeline |

## 9. Decision approval

| Field | Value |
|---|---|
| Purpose | Approvals move status `pending → approved` atomically |
| Entry | Approver invokes approval RPC |
| Exit | `status='approved'`, approval stage recorded |
| Negative controls | Non-approver → 403; skipped stage → trigger raises |
| Evidence artifacts | `approval.json` |
| Release gate | Governance pipeline |

## 10. Decision rejection

| Field | Value |
|---|---|
| Purpose | Rejections halt lifecycle and require rationale |
| Entry | Approver rejects with reason |
| Exit | `status='rejected'`, reason persisted, notification emitted |
| Evidence artifacts | `rejection.json` |
| Release gate | Governance pipeline |

## 11. Evidence attachment

| Field | Value |
|---|---|
| Purpose | Attachments bind to a decision + org |
| Entry | Insert into `evidence_sources` linked to decision |
| Exit | `blend_evidence()` returns the new row |
| Negative controls | Cross-tenant attach → 403 |
| Evidence artifacts | `attach.json` |
| Release gate | Evidence pipeline |

## 12. Evidence retrieval

| Field | Value |
|---|---|
| Purpose | Retrieval honors org scope and dataset scope |
| Entry | Read via `useDecisionEvidencePanel` hook |
| Negative controls | Cross-tenant read → empty |
| Evidence artifacts | `retrieve.json` |
| Release gate | Evidence pipeline |

## 13. Evidence export

| Field | Value |
|---|---|
| Purpose | GDPR Art. 15/20 — data portability |
| Entry | `POST /functions/v1/data-export` |
| Exit | JSON bundle, `audit_log` action_type=`data_export` |
| Negative controls | Non-admin → 403; rate limit >5/h → 429 |
| Evidence artifacts | `export.json`, `audit-export.json` |
| Release gate | Evidence pipeline |

## 14. AI recommendation

| Field | Value |
|---|---|
| Purpose | Recommendations are deterministic & carry evidence contract |
| Entry | `prescriptive-advisory` edge fn (mock mode) |
| Exit | Advisory row with `evidence_sources` populated |
| Negative controls | No dataset → returns "insufficient_data" (not fabrication) |
| Evidence artifacts | `advisory.json` |
| Release gate | AI pipeline |

## 15. AI explanation

| Field | Value |
|---|---|
| Purpose | Every recommendation has 7-layer explanation |
| Entry | Read `intelligence_audit_trail` for the advisory |
| Exit | All 7 layers present, no free-form prose |
| Evidence artifacts | `explanation.json` |
| Release gate | AI pipeline |

## 16. Confidence scoring

| Field | Value |
|---|---|
| Purpose | Capped ≤0.85, calibrated on volume |
| Entry | `scoreDecisionQuality()` on advisory |
| Exit | Score persisted, dimension breakdown recorded |
| Evidence artifacts | `iq-score.json` |
| Release gate | AI pipeline |

## 17. Decision ledger

| Field | Value |
|---|---|
| Purpose | Ledger is the source of truth for decisions |
| Entry | Read `/decisions` with authenticated org |
| Exit | Rows scoped to org, no other org visible |
| Evidence artifacts | `ledger.json` |
| Release gate | Decision pipeline |

## 18. Audit trail

| Field | Value |
|---|---|
| Purpose | Every mutating action produces an `audit_log` row |
| Entry | Any CUD via UI or edge fn |
| Exit | Row present with actor_id, action_type, payload |
| Negative controls | UPDATE/DELETE on `audit_log` → 403 |
| Evidence artifacts | `audit-append.json`, `audit-immutability.json` |
| Release gate | Audit pipeline |

## 19. Governance workflow

| Field | Value |
|---|---|
| Purpose | Approval chain stages execute in order |
| Entry | Decision with governance profile |
| Exit | Ordered stage transitions in `context_governance_audit` |
| Evidence artifacts | `governance-run.json` |
| Release gate | Governance pipeline |

## 20. Reports

| Field | Value |
|---|---|
| Purpose | Deterministic PDF/CSV output |
| Entry | `/reports` generation trigger |
| Exit | Artifact stored, checksum recorded |
| Evidence artifacts | `report.pdf.sha256`, `report-metadata.json` |
| Release gate | Reporting pipeline |

## 21. Executive exports

| Field | Value |
|---|---|
| Purpose | Board-mode exports include disclaimer + provenance |
| Entry | `/board-report` export button |
| Exit | PPTX with slides matching template |
| Evidence artifacts | `pptx.sha256`, `slides.json` |
| Release gate | Reporting pipeline |

## 22. Dashboard loading

| Field | Value |
|---|---|
| Purpose | Dashboard renders under budget with no console errors |
| Entry | Navigate to `/dashboard` |
| Exit | LCP < budget, all widgets scoped to org |
| Evidence artifacts | `dashboard-timings.json`, `console.log` |
| Release gate | System health |

## 23. Notifications

| Field | Value |
|---|---|
| Purpose | Notifications are org-scoped and rate-limited |
| Entry | Trigger event that emits `notification_log` |
| Exit | Recipient scoped, cooldown respected |
| Evidence artifacts | `notify.json` |
| Release gate | Notifications |

## 24. Billing

| Field | Value |
|---|---|
| Purpose | Stripe entitlements match `subscriptions` table |
| Entry | Read subscription for org |
| Exit | Plan matches Stripe webhook state |
| Negative controls | Downgrade past limit → feature gated |
| Evidence artifacts | `billing.json` |
| Release gate | Billing |

## 25. Credits

| Field | Value |
|---|---|
| Purpose | Credit counters decrement per usage; refund on failure |
| Entry | AI call in mock mode |
| Exit | `credit_ledger` row appended |
| Evidence artifacts | `credits.json` |
| Release gate | Billing |

## 26. Data import

| Field | Value |
|---|---|
| Purpose | CSV ingestion produces `datasets` + `dataset_versions` |
| Entry | Upload via `useChunkedIngestion` |
| Exit | Rows in `datasets`, PII flagged, industry classified |
| Negative controls | Malformed CSV → error, no partial write |
| Evidence artifacts | `import.json`, `pii-report.json` |
| Release gate | Decision pipeline |

## 27. Dataset versioning

| Field | Value |
|---|---|
| Purpose | Every ingest creates a version; drift captured |
| Entry | Second ingest of same dataset with new column |
| Exit | `schema_evolution_log` row present |
| Evidence artifacts | `versions.json`, `drift.json` |
| Release gate | Decision pipeline |

## 28. Rollback

| Field | Value |
|---|---|
| Purpose | Prior dataset version restorable |
| Entry | Rollback RPC |
| Exit | Active version pointer moved, audit row written |
| Evidence artifacts | `rollback.json` |
| Release gate | Recovery |

## 29. Edge functions

| Field | Value |
|---|---|
| Purpose | Every edge fn returns CORS, auth guard, request id |
| Entry | `curl` (or `supabase--curl_edge_functions`) each fn |
| Exit | 200/expected 4xx with headers |
| Evidence artifacts | `edge-function-matrix.csv` |
| Release gate | System health |

## 30. Realtime

| Field | Value |
|---|---|
| Purpose | Realtime channels respect RLS |
| Entry | Subscribe to `decision_ledger` for Org A |
| Exit | Org B insert does NOT deliver |
| Evidence artifacts | `realtime.json` |
| Release gate | Tenant isolation |

## 31. Background jobs

| Field | Value |
|---|---|
| Purpose | pg_cron jobs run under advisory lock |
| Entry | Read `cron_run_log` |
| Exit | Recent success + no overlap |
| Evidence artifacts | `cron.json` |
| Release gate | System health |

## 32. Organization management

| Field | Value |
|---|---|
| Purpose | Owner-only ops enforced |
| Entry | Owner + member call each admin RPC |
| Negative controls | Member call → 403 |
| Evidence artifacts | `org-admin.json` |
| Release gate | Authorization |

## 33. User management

| Field | Value |
|---|---|
| Purpose | Invite, role change, deactivation flow |
| Evidence artifacts | `users.json` |
| Release gate | Authorization |

## 34. Settings

| Field | Value |
|---|---|
| Purpose | Settings persist per org, redact secrets |
| Evidence artifacts | `settings.json` |
| Release gate | Authorization |

## 35. Search

| Field | Value |
|---|---|
| Purpose | Search scoped to org; no cross-tenant hits |
| Evidence artifacts | `search.json` |
| Release gate | Tenant isolation |

## 36. System health

| Field | Value |
|---|---|
| Purpose | `/system-health` SLO probes all green |
| Evidence artifacts | `slo.json` |
| Release gate | System health |

## 37. Recovery

| Field | Value |
|---|---|
| Purpose | DR runbook executable in staging |
| Entry | Restore snapshot to staging |
| Exit | Row counts match; audit intact |
| Evidence artifacts | `recovery.json` |
| Release gate | Recovery |

<!-- AUTO-GENERATED:GATES:START (do not edit — run npm run evidence:docs:write) -->

## Gate mapping (generated from `tests/evidence/lib/gates.mjs`)

This section is auto-generated. Do not hand-edit.

| Gate key | Label | Weight | Pipelines |
|---|---|---:|---|
| `authentication` | Authentication | 10 | `authentication`, `mfa`, `oauth`, `session-recovery` |
| `authorization` | Authorization | 10 | `protected-routes`, `user-management`, `organization-management`, `settings` |
| `tenant_isolation` | Tenant Isolation | 15 | `tenant-isolation`, `edge-functions`, `realtime` |
| `decision_pipeline` | Decision Pipeline | 10 | `decision-creation`, `decision-editing`, `decision-approval`, `decision-rejection`, `decision-ledger` |
| `evidence_pipeline` | Evidence Pipeline | 10 | `evidence-attachment`, `evidence-retrieval`, `evidence-export` |
| `governance` | Governance | 10 | `governance-workflow`, `confidence-scoring` |
| `ai` | AI Pipeline | 10 | `ai-recommendation`, `ai-explanation` |
| `audit` | Audit | 0 | `audit-trail` |
| `reports` | Reports | 5 | `reports`, `executive-exports` |
| `notifications` | Notifications | 0 | `notifications` |
| `billing` | Billing | 0 | `billing`, `credits` |
| `scalability` | Scalability | 10 | `dashboard-loading`, `background-jobs` |
| `recovery` | Recovery | 10 | `recovery`, `rollback` |
| `system_health` | System Health | 10 | `system-health`, `search`, `data-import`, `dataset-versioning` |

<!-- AUTO-GENERATED:GATES:END -->

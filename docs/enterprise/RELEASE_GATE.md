# Quantivis Release Gate (EE-1)

The release gate is the **single point of enforcement** between a green build
and a production deployment. No release is enterprise-ready unless **every
gate below is PASS** for the current commit.

The gate is computed by `tests/evidence/run-all.mjs` from the evidence
artifacts written under `audit-artifacts/YYYY-MM-DD/<pipeline>/`.

## Gate definition

| Gate | Pipelines (see EVIDENCE_MATRIX.md) | Pass condition |
|---|---|---|
| Authentication | 1, 2, 3, 4 | All PASS. No `SECURITY_FAILURE`. |
| Authorization | 5, 32, 33, 34 | All PASS. All negative controls = `EXPECTED_DENIAL`. |
| Tenant isolation | 6, 30, 35 | Zero `CRITICAL_LEAK`. Every probe accounted for. |
| Decision pipeline | 7, 8, 17, 26, 27 | All PASS. Ledger diff matches inputs. |
| Evidence pipeline | 11, 12, 13 | All PASS. Export bundle checksum recorded. |
| Governance pipeline | 9, 10, 19 | All PASS. Stage order matches profile. |
| AI pipeline | 14, 15, 16 | All PASS. Confidence ≤ 0.85. Mock mode used. |
| Audit pipeline | 18 | Append succeeds. UPDATE/DELETE denied. |
| Reporting pipeline | 20, 21 | Deterministic checksum stable across two runs. |
| Notifications | 23 | Cooldown enforced. Org scoped. |
| Billing | 24, 25 | Entitlements = Stripe state. Credits balance ≥ 0. |
| Scalability | 22, 29 | Timings within `PERFORMANCE_BUDGETS.md`. |
| System health | 22, 29, 31, 36 | SLO probes green. Cron jobs recent success. |
| Recovery | 28, 37 | Restore + rollback replay clean. |

## Enforcement

Any of the following blocks the release:

1. Any pipeline status ∈ { `API_FAILURE`, `SECURITY_FAILURE`, `PERFORMANCE_FAILURE`, `CRITICAL_LEAK`, `CRITICAL_FAILURE`, `FRAMEWORK_INVALID` }.
2. Any expected negative control returning success (leak).
3. Any missing evidence artifact listed in the matrix.
4. `commit_sha` in artifacts does not match the release candidate SHA.
5. `environment` in artifacts is not in the guard allow-list (staging / preview).

## Sign-off

The gate report (`audit-artifacts/YYYY-MM-DD/RELEASE_GATE.md`) must be
attached to the release ticket. Sign-off requires:

- Engineering lead — technical PASS
- Security — no `SECURITY_FAILURE`, no `CRITICAL_LEAK`
- Compliance — audit + evidence pipelines PASS
- Product — reporting pipeline PASS

## Non-goals

- The release gate does not test production.
- The release gate does not exercise live AI providers.
- The release gate does not send real emails or charge real cards.

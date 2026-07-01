# Tenant Isolation Test

Self-contained, checked-in test that verifies a user in **org A** cannot read or
write data belonging to **org B** (and vice versa) for every tenant-scoped
surface: `decision_ledger`, `audit_log`, `evidence_sources`.

Any cross-tenant read or write that succeeds is a **CRITICAL** failure.

## Safety guarantees (enforced by `lib/guard.mjs`)

- **Allow-list environment check**: `LOAD_TARGET` must be exactly `staging` or
  `preview`. Anything else — `production`, `prod`, `live`, `main`, `release`,
  empty, or a typo — is rejected before any network call.
- **Shared guard**: `seed.mjs`, `run.mjs`, and `teardown.mjs` all import the
  same `guardOrExit()` helper. No script-local drift.
- **Hard-fail teardown**: any cleanup error causes exit code 1 and the state
  file is preserved so operators can retry. Nothing is silently left behind.
- Does not call live AI, does not send email, does not depend on k6.
- Only two users are created (one per org). No 50/100/1000-VU load.

## Files

| File | Purpose |
| --- | --- |
| `lib/guard.mjs` | Shared allow-list guard used by all three scripts. |
| `seed.mjs`      | Creates two orgs + one user each + canary rows on `decision_ledger`, `audit_log`, `evidence_sources`. Writes `.state.json`. |
| `run.mjs`       | Signs in each user, probes cross-tenant reads and writes. Exits non-zero on any leak. |
| `teardown.mjs`  | Deletes seeded rows, users, and orgs. Exits 1 on any failure. |

`.state.json` (created by `seed.mjs`, consumed by `run.mjs` and `teardown.mjs`)
contains the run tag, org IDs, and seeded user credentials for the run. It is
git-ignored and cleared on successful teardown.

## Required credentials

All three scripts require these environment variables:

```
LOAD_TARGET=staging                 # or "preview" — anything else is refused
LOAD_SUPABASE_URL=https://<ref>.supabase.co
LOAD_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service-role key, staging only>
```

`SUPABASE_SERVICE_ROLE_KEY` is **not** available on Lovable Cloud managed
projects. If you host on Lovable Cloud you must run this against a staging
Supabase project that you own directly.

## Usage

```bash
node tests/tenant-isolation/seed.mjs
node tests/tenant-isolation/run.mjs
node tests/tenant-isolation/teardown.mjs   # always run, even on failure
```

Exit codes from `run.mjs`:

- `0` — every probe was `isolation_pass` (0 leaks, 0 framework or app errors).
- `1` — configuration error, missing seed file, missing canary, blocked target,
        **or** the run completed without leaks but at least one probe returned
        `framework_failure` / `app_error`. The run is not a valid PASS.
- `2` — **CRITICAL**: at least one `isolation_leak` (cross-tenant read
        returned rows or cross-tenant write was accepted).

Exit codes from `teardown.mjs`:

- `0` — every seeded row, user, and org deleted; `.state.json` removed.
- `1` — at least one delete failed; `.state.json` preserved for retry.

## Canary requirement (tests are invalid without it)

`seed.mjs` inserts one canary row per org for **every** table `run.mjs` probes
(`decision_ledger`, `audit_log`, `evidence_sources`). If any canary insert
fails, seed exits non-zero and no `.state.json` is written.

`run.mjs` refuses to start if `.state.json` is missing a canary for any
required table. This prevents vacuous "pass" results caused by probing an empty
table (0 rows returned looks identical to RLS blocking 0 rows).

## What the run script checks

For each direction (A→B and B→A) and each table
(`decision_ledger`, `audit_log`, `evidence_sources`):

1. **Read probe** — `GET /rest/v1/<table>?organization_id=eq.<other_org>&limit=5`
   using the caller's JWT. The probe is only a valid `isolation_pass` when
   **all three** hold:
   - HTTP status is exactly `200`
   - the response body parses as a JSON array
   - the array length is exactly `0`

   Any non-200 status is reported as `app_error`. A 200 with a non-array body
   is reported as `framework_failure`. A 200 with a non-empty array is
   `isolation_leak` (CRITICAL).

2. **Write probe** (`decision_ledger`) — `POST` a row with
   `organization_id = <other_org>` using the caller's JWT. The probe is only a
   valid `isolation_pass` when the response is one of the expected rejection
   classes:
   - HTTP `401` (unauthenticated) or `403` (forbidden)
   - PostgREST RLS rejection: PostgreSQL code `42501`
     (`insufficient_privilege`) or an error message matching
     `row-level security` / `permission denied`

   `2xx` is `isolation_leak` (CRITICAL). Any other status — `400`, `404`,
   `409`, `422`, `5xx`, schema errors, malformed JSON, network errors — is
   reported as `app_error` or `framework_failure` and fails the run with
   exit 1 (the write may still be blocked, but the response is not proof of
   isolation).

## Reporting

Every probe prints: `kind`, `caller`, `actor_org`, `target_org`, `table`,
`status`, truncated `body`, `verdict`, and `severity`. The final summary
counts by verdict: `isolation_pass`, `isolation_leak`, `framework_failure`,
`app_error`.


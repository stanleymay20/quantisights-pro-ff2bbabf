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

- `0` — all cross-tenant probes correctly returned empty / were rejected.
- `1` — configuration error (missing env vars, missing seed file, blocked target).
- `2` — **CRITICAL**: at least one cross-tenant read or write succeeded.

Exit codes from `teardown.mjs`:

- `0` — every seeded row, user, and org deleted; `.state.json` removed.
- `1` — at least one delete failed; `.state.json` preserved for retry.

## What the run script checks

For each direction (A→B and B→A) and each table
(`decision_ledger`, `audit_log`, `evidence_sources`):

1. **Read probe** — `GET /rest/v1/<table>?organization_id=eq.<other_org>&limit=5`
   using the caller's JWT. Pass = 0 rows returned.
2. **Write probe** (`decision_ledger` only) — `POST` a row with
   `organization_id = <other_org>`. Pass = HTTP 4xx (RLS rejection).

A single successful cross-tenant row read or write is treated as CRITICAL and
the process exits with code 2.

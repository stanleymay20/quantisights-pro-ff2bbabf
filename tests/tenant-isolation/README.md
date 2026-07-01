# Tenant Isolation Test

Self-contained, checked-in test that verifies a user in **org A** cannot read or
write data belonging to **org B** (and vice versa) for every tenant-scoped
surface: `decision_ledger`, `audit_log`, `evidence_sources`.

Any cross-tenant read or write that succeeds is a **CRITICAL** failure.

## Guarantees enforced by the scripts

- Refuses to run against production (`LOAD_TARGET=production` blocked; requires
  `staging` or `preview`).
- Does not call live AI, does not send email, does not depend on k6.
- Only two users are created (one per org). No 50/100/1000-VU load.
- Seed / test / teardown are separate scripts. Teardown wipes only rows tagged
  with `is_loadtest` in user metadata and the two dedicated orgs.

## Files

| File | Purpose |
| --- | --- |
| `seed.mjs`     | Creates `org_loadtest_a` + `org_loadtest_b`, one seeded user per org, one decision + audit + evidence row per org. Writes `.users.json`. |
| `run.mjs`      | Signs in each user via password grant, probes cross-tenant reads and writes on `decision_ledger`, `audit_log`, `evidence_sources`. Exits non-zero on any leak. |
| `teardown.mjs` | Deletes seeded rows, users, and the two orgs. |

## Required credentials

All three scripts require these environment variables:

```
LOAD_TARGET=staging                 # or "preview" — never "production"
LOAD_SUPABASE_URL=https://<ref>.supabase.co
LOAD_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service-role key, staging only>
```

`SUPABASE_SERVICE_ROLE_KEY` is **not** available on Lovable Cloud managed
projects. If you host on Lovable Cloud you must run this against a staging
Supabase project that you own directly.

## Usage

```bash
# 1. Seed
node tests/tenant-isolation/seed.mjs

# 2. Run
node tests/tenant-isolation/run.mjs

# 3. Teardown (always run, even on failure)
node tests/tenant-isolation/teardown.mjs
```

Exit codes from `run.mjs`:

- `0` — all cross-tenant probes correctly returned empty / were rejected.
- `1` — configuration error (missing env vars, missing seed file).
- `2` — **CRITICAL**: at least one cross-tenant read or write succeeded.

## What the run script checks

For each direction (A→B and B→A) and each table
(`decision_ledger`, `audit_log`, `evidence_sources`):

1. **Read probe** — `GET /rest/v1/<table>?organization_id=eq.<other_org>&limit=5`
   using the caller's JWT. Pass = 0 rows returned.
2. **Write probe** (`decision_ledger` only) — `POST` a row with
   `organization_id = <other_org>`. Pass = HTTP 4xx (RLS rejection).

A single successful cross-tenant row read or write is treated as CRITICAL and
the process exits with code 2.

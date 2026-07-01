# EE-2 Authorization adapter

Translates the outputs of the existing authorization harnesses into the
EE-2 Authorization evidence contract consumed by
`tests/evidence/pipelines/authorization.mjs`.

## Inputs

All inputs are optional; any missing input degrades its controls to `SKIP`
(never a fake `PASS`). A `SKIP` degrades the pipeline to `WARNING`.

| Flag | Source harness | Controls covered |
|---|---|---|
| `--tenant-isolation <path>` | `node tests/tenant-isolation/run.mjs` (stdout summary) | `AUTHZ-008` … `AUTHZ-016` |
| `--browser <path>` | `python3 tests/e2e/concurrent-browser-sessions.py` (stdout summary) | `AUTHZ-001` … `AUTHZ-004`, `AUTHZ-006`, `AUTHZ-007` |
| `--route-probes <path>` | Any script producing `{ probes: [{ control_id, ... , pass }] }` | `AUTHZ-005`, `AUTHZ-017` … `AUTHZ-020` |
| `--output <path>` | (required) destination for the AUTHZ evidence JSON | — |
| `--strict` | Exit non-zero if any required AUTHZ control is left `SKIP` | — |

The adapter is a **pure translator** — it does not launch Playwright, does
not run tenant-isolation probes, and does not hit HTTP endpoints. It only
converts what the upstream harnesses already reported.

## Usage

```bash
# 1. Produce upstream artefacts (do NOT run these in this task).
node tests/tenant-isolation/run.mjs   > /tmp/ti.json
python3 tests/e2e/concurrent-browser-sessions.py > /tmp/br.json
node scripts/route-probes.mjs          > /tmp/rp.json      # example

# 2. Translate.
node tests/evidence/adapters/authz-adapter.mjs \
  --tenant-isolation /tmp/ti.json \
  --browser          /tmp/br.json \
  --route-probes     /tmp/rp.json \
  --output           /tmp/authz-evidence.json

# 3. Feed the pipeline.
EVIDENCE_AUTHZ_RESULTS=/tmp/authz-evidence.json \
  npm run evidence:run -- authorization
```

## Status mapping

Frozen taxonomy only (`tests/evidence/lib/taxonomy.mjs`). The pipeline maps
adapter status to gate status:

| Adapter status | Control severity | Pipeline projection |
|---|---|---|
| `PASS` | — | `STATUS.PASS` (positive control) |
| `SKIP` | — | `STATUS.WARNING` (never `PASS`; also degrades overall to WARNING) |
| `FAIL` | `critical_leak` | `STATUS.CRITICAL_LEAK` (blocking) |
| `FAIL` | `security_failure` | `STATUS.SECURITY_FAILURE` (blocking) |
| `FAIL` | `blocking=warning` | `STATUS.WARNING` (non-blocking) |
| missing control / bad shape | — | `STATUS.FRAMEWORK_INVALID` (blocking) |

Overall pipeline status = the most severe of the above.

## Evidence schema

For every control the adapter emits:

```json
{
  "status": "PASS|FAIL|SKIP",
  "execution_time_ms": 1234,
  "evidence": {
    "route": "/dashboard",
    "role": "member",
    "organization_id": "org_a",
    "user_id": "user_a",
    "table": "decision_ledger",
    "policy": "is_org_member(organization_id)",
    "request":  { "method": "GET", "url": "/dashboard" },
    "response": { "status": 200, "body_snippet": null },
    "status_code": 200,
    "redirect_chain": ["/dashboard"],
    "console_errors": [],
    "network_failures": [],
    "screenshots": [],
    "recommendation": null
  },
  "error": null
}
```

## Artifact path

`audit-artifacts/YYYY-MM-DD/authorization/evidence.json` (standard artifact
schema, see `tests/evidence/lib/artifact.mjs`).

## Blocking semantics

* `CRITICAL_LEAK` and `SECURITY_FAILURE` are **hard-blocking** for release
  (see `tests/evidence/lib/taxonomy.mjs → BLOCKING`).
* `WARNING` is **non-blocking** — surfaced in the certification report but
  does not gate the release.
* `FRAMEWORK_INVALID` is **hard-blocking** — the harness did not produce
  usable evidence and the release cannot be certified.

## Remaining blockers before first staging execution

* Provision Org A + Org B seed users (`tests/tenant-isolation/seed.mjs`) in
  staging (`LOAD_SUPABASE_URL`, `LOAD_SUPABASE_ANON_KEY`, seed passwords).
* Provide a route-probe script that emits `{ probes: [...] }` for
  `AUTHZ-005`, `AUTHZ-017`, `AUTHZ-018`, `AUTHZ-019`, `AUTHZ-020`. Until
  that lands, those five controls remain `SKIP` and the pipeline is `WARNING`.
* Realtime authz probe (`AUTHZ-020`) requires a Realtime subscriber wired
  as a cross-tenant JWT.

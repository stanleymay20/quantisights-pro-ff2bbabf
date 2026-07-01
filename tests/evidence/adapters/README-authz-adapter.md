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

## Route-probe adapter (EE-2B)

`authz-route-probes.mjs` is a companion **pure translator** that produces the
`{ probes: [...] }` payload consumed by `authz-adapter.mjs --route-probes`.
Without it, the following controls stay `SKIP` and the pipeline degrades to
`WARNING`:

| Control | Coverage |
|---|---|
| `AUTHZ-004` | Protected governance access (`GET /auditability`) |
| `AUTHZ-007` | Authenticated route access under a valid session |
| `AUTHZ-012` | Own-tenant write allowed (2xx insert into `decision_ledger`) |
| `AUTHZ-015` | Cross-tenant write denied (401 / 403 / Postgres 42501) |
| `AUTHZ-019` | Edge Function authorization (401 for missing / invalid JWT) |

### Inputs (choose one; both may be combined)

* `--input <route-probes.json>` — a hand-authored or scripted probe file:

  ```json
  {
    "source": "route-probes",
    "probes": [
      {
        "control_id": "AUTHZ-015",
        "route": "/rest/v1/decision_ledger",
        "role": "member",
        "organization_id": "org_a",
        "user_id": "user_a",
        "table": "decision_ledger",
        "method": "POST",
        "expected": "leak_check",
        "status_code": 403,
        "redirect_chain": [],
        "console_errors": [],
        "network_failures": [],
        "screenshots": []
      }
    ]
  }
  ```

* `--playwright <reporter.json>` — Playwright JSON reporter output. Tests
  opt in with:

  ```ts
  test.info().annotations.push({ type: "authz-control", description: "AUTHZ-004" });
  test.info().attachments.push({
    name: "authz-probe",
    contentType: "application/json",
    body: Buffer.from(JSON.stringify({
      route: "/auditability",
      role: "member",
      expected: "allow",
      status_code: 200,
    })),
  });
  ```

  Playwright pass/fail is used as the ground truth when no explicit
  `status_code` / `expected` sidecar is attached.

### `expected` semantics

| Value | PASS condition |
|---|---|
| `allow` | `status_code ∈ [200, 299]` |
| `deny` | `status_code ∈ {401, 403}` **or** `redirect_chain` ends at `/login` |
| `leak_check` | `status_code ∈ {401, 403, 42501}` (cross-tenant write must be rejected) |
| `api` | `status_code ∈ {401, 403}` (Edge Function without / with wrong JWT) |
| `explicit` | trust `probe.pass` verbatim |

### Output → authz-adapter

The output file is a valid `--route-probes` payload:

```json
{
  "source": "authz-route-probes",
  "collected_at": "2026-07-01T00:00:00.000Z",
  "probes": [ { "control_id": "AUTHZ-004", "route": "/auditability", "pass": true, ... } ]
}
```

Feed it directly into `authz-adapter.mjs`:

```bash
node tests/evidence/adapters/authz-route-probes.mjs \
  --input /tmp/route-probes-raw.json \
  --output /tmp/route-probes.json \
  --strict

node tests/evidence/adapters/authz-adapter.mjs \
  --tenant-isolation /tmp/ti.json \
  --browser          /tmp/br.json \
  --route-probes     /tmp/route-probes.json \
  --output           /tmp/authz-evidence.json
```

### Failure modes

`authz-route-probes.mjs` exits **non-zero** on:

* Malformed input JSON (unparseable file, missing `probes` array).
* A probe missing `control_id` or `route`.
* A probe referencing an unknown AUTHZ control id.
* A probe with an unknown `expected` keyword.
* `--strict` **and** any of `AUTHZ-004`, `AUTHZ-007`, `AUTHZ-012`,
  `AUTHZ-015`, `AUTHZ-019` is unmapped in the final output.

Structural errors (malformed JSON, unknown control id, missing required
fields) always fail — even without `--strict` — because they indicate the
adapter cannot trust the input at all.

## Remaining blockers before first staging execution

* Provision Org A + Org B seed users (`tests/tenant-isolation/seed.mjs`) in
  staging (`LOAD_SUPABASE_URL`, `LOAD_SUPABASE_ANON_KEY`, seed passwords).
* Author a staging-safe probe script or Playwright suite that produces the
  route-probe input covering `AUTHZ-004`, `AUTHZ-007`, `AUTHZ-012`,
  `AUTHZ-015`, `AUTHZ-019`. The translator is ready; the observation source
  is not.
* Route-probe coverage for `AUTHZ-005`, `AUTHZ-017`, `AUTHZ-018`, `AUTHZ-020`
  is still outstanding (admin role gate, role hierarchy, role mutation,
  Realtime authz leak). Add these to the same route-probe file once the
  fixtures exist.
* Realtime authz probe (`AUTHZ-020`) requires a Realtime subscriber wired
  with a cross-tenant JWT.


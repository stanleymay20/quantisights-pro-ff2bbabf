# Authentication Evidence Adapter (EE-1B)

The `authentication` pipeline (see `tests/evidence/pipelines/authentication.mjs`)
is an **evidence consumer**. It does not launch Playwright or a browser; it
reads a JSON file produced by an execution adapter and folds each control
result into the standard evidence artifact schema.

This directory ships the reference adapter,
`tests/evidence/adapters/auth-adapter.mjs`, which is a **pure translator**
from Playwright's JSON reporter output into the AUTH evidence contract.

## End-to-end flow

```text
e2e/auth.spec.ts
   │  (Playwright — JSON reporter)
   ▼
/tmp/auth-play.json
   │  (auth-adapter.mjs — pure translator, no browser)
   ▼
/tmp/auth-evidence.json  ← EVIDENCE_AUTH_RESULTS
   │  (tests/evidence/pipelines/authentication.mjs)
   ▼
audit-artifacts/<date>/authentication/evidence.json
```

## 1. Run Playwright with the JSON reporter

```sh
npx playwright test e2e/auth.spec.ts --reporter=json > /tmp/auth-play.json
```

Playwright writes the report to stdout when `--reporter=json` is used without
an output file; redirect it to a stable path.

## 2. Translate to AUTH evidence

```sh
node tests/evidence/adapters/auth-adapter.mjs \
  --input  /tmp/auth-play.json \
  --output /tmp/auth-evidence.json \
  --strict
```

Flags:

| Flag           | Purpose                                                                |
| -------------- | ---------------------------------------------------------------------- |
| `--input, -i`  | Path to Playwright JSON reporter output (required).                    |
| `--output, -o` | Path to write the AUTH evidence JSON (required).                       |
| `--strict`     | Exit non-zero if a required AUTH-\* control is missing or a Playwright test cannot be mapped. |

Exit codes:

- `0` — translation succeeded (in `--strict`, every required control is mapped).
- `1` — malformed Playwright JSON, unmapped test (strict), missing required
  control (strict), or IO error.

## 3. Feed the pipeline

```sh
EVIDENCE_ENV=preview \
EVIDENCE_AUTH_RESULTS=/tmp/auth-evidence.json \
  npm run evidence:run -- authentication
```

Or run the full release gate (all pipelines + certification):

```sh
EVIDENCE_ENV=staging \
EVIDENCE_AUTH_RESULTS=/tmp/auth-evidence.json \
  npm run evidence:release
```

## Mapping strategy

The adapter maps each Playwright test to zero or more AUTH controls using, in
priority order:

1. **Explicit annotations** — the preferred, drift-resistant path. Add an
   annotation to the test:

   ```ts
   test("logout clears session", {
     annotation: [{ type: "auth-control", description: "AUTH-002" }],
   }, async ({ page }) => { /* … */ });
   ```

   Any annotation whose `description` contains an `AUTH-\d{3}` code is
   picked up; a single test may cover multiple controls.

2. **Title substring match** — for the tests currently in
   `e2e/auth.spec.ts` (see `TITLE_MAP` in the adapter). Renames break this
   fallback on purpose; prefer annotations for new tests.

3. **Unmatched** — the test is recorded as unmapped. In `--strict` this is a
   hard error; otherwise it becomes a warning and the corresponding AUTH-\*
   control is reported as missing.

If two tests map to the same control, the worst status wins
(`FAIL > SKIP > PASS`), so a broken variant of the same control still blocks
certification.

## Adapter contract (output schema)

```jsonc
{
  "adapter": "playwright",
  "collected_at": "2026-07-01T00:00:00.000Z",
  "environment": "preview",
  "source": {
    "playwright_version": "1.59.1",
    "spec": "e2e/auth.spec.ts"
  },
  "controls": {
    "AUTH-001": {
      "status": "PASS",              // PASS | FAIL | SKIP
      "execution_time_ms": 1240,
      "evidence": {
        "route": null,
        "response_status": null,
        "redirect_chain": [],
        "session_state": null,
        "auth_state": null,
        "console_errors": [],
        "network_failures": [],
        "screenshots": ["artifacts/auth-001-login.png"],
        "playwright": {
          "test_title": "e2e/auth.spec.ts > Authentication Flow > login with invalid credentials shows error",
          "project": "chromium",
          "retries": 0
        }
      },
      "error": null                   // populated when status = FAIL
    }
    // … AUTH-002 … AUTH-015
  }
}
```

The adapter emits `null`/`[]` for evidence fields Playwright cannot supply
natively (session state, redirect chain, console/network capture). Future
Playwright specs should populate those fields via annotations or attached
fixtures; the adapter passes any additional fields through untouched when
present.

## Control catalogue

The 15 controls are declared in
`tests/evidence/pipelines/lib/auth-controls.mjs`. Each control defines its
expected outcome, failure condition, blocking severity, semantic failure
code, and remediation recommendation. The pipeline refuses to certify if any
required control is missing (STATUS = `FRAMEWORK_INVALID`) or any critical
control fails (STATUS = `SECURITY_FAILURE`, hard-blocking).

## Remaining blockers before staging execution

1. **Test coverage gaps** — `e2e/auth.spec.ts` today exercises only
   AUTH-001, AUTH-003, AUTH-009, AUTH-011, and AUTH-014 (via title
   fallback). AUTH-002, 004-008, 010, 012-013, 015 need new annotated
   Playwright specs before the pipeline can emit `PASS` in strict mode.
2. **Rich evidence fields** — `redirect_chain`, `response_status`,
   `session_state`, `console_errors`, and `network_failures` require either
   Playwright fixtures that write JSON side-cars or a small in-test
   collector that emits annotations for the adapter to fold in.
3. **Staging credentials** — MFA (AUTH-010) and recovery (AUTH-013) need
   seeded users with MFA enrolled and a mail-catcher endpoint for recovery
   links.
4. **CI wiring** — the adapter is invoked manually today; wire it into the
   release workflow so `evidence:release` can consume its output without a
   human step.

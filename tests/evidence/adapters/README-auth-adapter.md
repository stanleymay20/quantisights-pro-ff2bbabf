# Authentication Evidence Adapter

The `authentication` pipeline (see `tests/evidence/pipelines/authentication.mjs`)
is an **evidence consumer**. It does not launch Playwright or a browser; it
reads a JSON file produced by an execution adapter and folds each control
result into the standard evidence artifact schema.

## Wiring the existing Playwright suite

`e2e/auth.spec.ts` already exercises most of the required controls. The
recommended adapter path is:

1. Run the existing suite with a JSON reporter:

   ```sh
   npx playwright test e2e/auth.spec.ts \
     --reporter=json \
     --output=/tmp/auth-play.json
   ```

2. Translate the reporter output into the adapter contract below (script to be
   added in EE-2). Do NOT duplicate Playwright logic — the adapter is a pure
   translator.

3. Point the evidence runner at the translated file:

   ```sh
   EVIDENCE_ENV=preview \
   EVIDENCE_AUTH_RESULTS=/tmp/auth-evidence.json \
     node tests/evidence/run-all.mjs authentication
   ```

## Adapter contract

```jsonc
{
  "adapter": "playwright",
  "collected_at": "2026-07-01T00:00:00.000Z",
  "environment": "preview",
  "controls": {
    "AUTH-001": {
      "status": "PASS",          // PASS | FAIL | SKIP
      "execution_time_ms": 1240,
      "evidence": {
        "route": "/login",
        "response_status": 200,
        "redirect_chain": ["/login", "/dashboard"],
        "session_state": { "user_id": "…", "aal": "aal1" },
        "auth_state": "signed_in",
        "console_errors": [],
        "network_failures": [],
        "screenshots": ["artifacts/auth-001-login.png"]
      },
      "error": null               // required when status = FAIL
    }
    // …AUTH-002 … AUTH-015
  }
}
```

## Control catalogue

The 15 controls are declared in
`tests/evidence/pipelines/lib/auth-controls.mjs`. Each control defines its
expected outcome, failure condition, blocking severity, semantic failure
code, and remediation recommendation. The pipeline refuses to certify if any
required control is missing (STATUS = `FRAMEWORK_INVALID`) or any critical
control fails (STATUS = `SECURITY_FAILURE`, hard-blocking).

# Cloudflare enterprise security automation

This repository includes a manual GitHub Actions workflow that creates or updates the Cloudflare response header transform rule for `www.quantivis.io`.

The automation does not hardcode secrets. It reads Cloudflare credentials only from environment variables or GitHub Actions secrets.

## Required GitHub Actions secrets

Add these in GitHub:

`Settings` → `Secrets and variables` → `Actions` → `New repository secret`

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token allowed to edit zone rulesets. |
| `CLOUDFLARE_ZONE_ID` | Cloudflare Zone ID for `quantivis.io`. |

## Least-privilege Cloudflare API token

Create a dedicated token in Cloudflare:

1. Open Cloudflare → `My Profile` → `API Tokens`.
2. Select `Create Token`.
3. Use `Custom token`.
4. Scope the token to the `quantivis.io` zone only.
5. Grant:
   - `Zone` → `Rulesets` → `Edit`
   - `Zone` → `Zone` → `Read`
6. Do not grant account-wide access.
7. Save the generated token as `CLOUDFLARE_API_TOKEN` in GitHub Actions secrets.

Do not commit the token to the repository or paste it into workflow logs.

## Zone ID

Find the Zone ID in Cloudflare:

1. Open the Cloudflare dashboard.
2. Select the `quantivis.io` zone.
3. Open the zone overview page.
4. Copy `Zone ID` from the API section.
5. Save it as `CLOUDFLARE_ZONE_ID` in GitHub Actions secrets.

## Workflow

Manual workflow:

`Actions` → `Apply Cloudflare Enterprise Security` → `Run workflow` → branch `main`

The workflow:

1. Runs `npm ci`.
2. Runs `npm run cloudflare:apply`.
3. Runs `npm run cloudflare:diagnose` to print safe zone, DNS proxy, and response-header ruleset evidence.
4. Waits 30 seconds for edge propagation.
5. Runs `npm run cloudflare:verify` against `https://www.quantivis.io/`.

## Managed headers

The automation creates or updates a Cloudflare Rulesets API response header transform rule for:

```text
http.host eq "www.quantivis.io"
```

Implementation notes:

- Cloudflare expects `action_parameters.headers` to be an object keyed by header name, where each value contains `operation` and `value`. Do not send `headers` as an array; Cloudflare rejects that payload with `invalid JSON: 'headers' cannot be an array`.
- The apply script lists zone rulesets, creates the `http_response_headers_transform` zone ruleset if missing, or updates the existing ruleset by ID. It does not update the phase `entrypoint` URL directly because Cloudflare rejects read-only fields such as `kind` and `phase` on that update payload.

Required headers:

```text
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.posthog.com https://*.sentry.io https://browser.sentry-cdn.com; connect-src 'self' https://*.supabase.co https://*.sentry.io https://*.posthog.com https://*.ingest.sentry.io wss://*.supabase.co; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data: https:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

## Expected curl output

After the workflow succeeds:

```bash
curl -I https://www.quantivis.io/
```

Expected header evidence:

```text
HTTP/2 200
content-security-policy: default-src 'self'; ...
x-frame-options: DENY
strict-transport-security: max-age=31536000; includeSubDomains; preload
x-content-type-options: nosniff
referrer-policy: strict-origin-when-cross-origin
permissions-policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()
cross-origin-opener-policy: same-origin
cross-origin-resource-policy: same-origin
```

## Local commands

Only run apply locally when the environment variables are present:

```bash
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ZONE_ID=... npm run cloudflare:apply
```

Verify live headers:

```bash
npm run cloudflare:verify
```

If apply succeeds but live verification still fails, run:

```bash
npm run cloudflare:diagnose
```

The diagnostic output shows the zone name/status, DNS records for `www.quantivis.io` and `quantivis.io`, whether the `www` record is proxied, and the response-header transform ruleset/rule/header names read back from Cloudflare. It does not print API tokens.

Override the verification URL if needed:

```bash
CLOUDFLARE_VERIFY_URL=https://www.quantivis.io/security npm run cloudflare:verify
```

## Rollback plan

1. Open Cloudflare dashboard → `Rules` → `Transform Rules` → `Modify Response Header`.
2. Find the rule named `Quantivis enterprise security headers for www.quantivis.io`.
3. Disable the rule.
4. Verify rollback:

```bash
curl -I https://www.quantivis.io/
```

5. If rollback is caused by a bad CSP, adjust `scripts/apply-cloudflare-security.mjs`, commit, push, rerun `Apply Cloudflare Enterprise Security`, and verify with `npm run cloudflare:verify`.

Rollback should prefer disabling the transform rule over deleting it, so audit history and recovery context remain visible.

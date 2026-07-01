# Quantivis Enterprise Certification Engine (EC-1)

The Certification Engine is the **single authority** that decides whether a
Quantivis release candidate is enterprise-ready. It does not generate
evidence — it governs it.

- **Sprint before this**: EE-1 (Enterprise Evidence Framework) — produces
  evidence artifacts.
- **This sprint**: EC-1 — reads those artifacts and issues one
  certification per release.

## 1. Inputs

The engine reads exactly one directory:

```
audit-artifacts/<YYYY-MM-DD>/<pipeline>/evidence.json
```

Each `evidence.json` is produced by a pipeline module registered in
`tests/evidence/pipelines/` and validated against the schema in
`tests/evidence/lib/artifact.mjs`.

Nothing else is consulted. The engine will not contact Supabase, hit an
edge function, or call an AI model. If evidence is missing, the missing
pipelines are treated as blocking (`FRAMEWORK_INVALID`).

## 2. Outputs

Written into the same day directory:

| File | Purpose |
|---|---|
| `CERTIFICATION.json` | Machine-readable release certification |
| `CERTIFICATION.md`   | CTO / CISO / Compliance / Procurement report |
| `EXECUTIVE_SUMMARY.md` | 1-page release summary |
| `../history.json`    | Appended trend record (date, commit, score, gates, duration) |

## 3. Certification model

The engine emits one of five decisions:

| Decision | Meaning | Recommendation |
|---|---|---|
| `PASS` | Every gate PASS, no warnings | Ship |
| `PASS_WITH_WARNINGS` | Every gate PASS but ≥1 warning | Ship with acknowledgement |
| `CONDITIONAL_RELEASE` | Exactly one blocked non-critical gate | Hold — conditional |
| `BLOCKED` | Multiple blocked gates | Hold |
| `CRITICAL_BLOCK` | Any `SECURITY_FAILURE` / `CRITICAL_LEAK` / `CRITICAL_FAILURE` | Rollback / do not deploy |

The decision matrix lives in `tests/evidence/lib/certification.mjs`
(`overallDecision`).

## 4. Gates

Gates are defined in `tests/evidence/lib/gates.mjs` and mirror
`docs/enterprise/RELEASE_GATE.md`. Each gate:

- has a stable `key` and `label`;
- carries a scoring `weight`;
- maps to one or more pipeline modules under `tests/evidence/pipelines/`.

Each gate produces:

```json
{
  "gate": "tenant_isolation",
  "label": "Tenant Isolation",
  "weight": 15,
  "status": "PASS | PASS_WITH_WARNINGS | BLOCKED",
  "blocking": true,
  "reason": "…",
  "evidence": [ { "pipeline": "...", "status": "...", ... } ]
}
```

Non-scoring gates (`audit`, `notifications`, `billing`) have `weight: 0`
but can still block. This models the “necessary but not credited” gates:
they must pass, but they don't move the readiness score.

## 5. Scoring

Enterprise Readiness Score is a weighted average, normalized to 0–100:

```
score = round( Σ (weight_i × factor_i) / Σ weight_i × 100 )
```

Factor per gate:

- `PASS` → 1.0
- `PASS_WITH_WARNINGS` → 0.5
- `BLOCKED` → 0.0

Weights (scoring gates only):

| Gate | Weight |
|---|---:|
| Tenant Isolation | 15 |
| Authentication | 10 |
| Authorization | 10 |
| Decision Pipeline | 10 |
| Evidence Pipeline | 10 |
| Governance | 10 |
| AI | 10 |
| Scalability | 10 |
| Recovery | 10 |
| System Health | 10 |
| Reports | 5 |
| Audit / Notifications / Billing | 0 (block-only) |

The `CERTIFICATION.json` includes the full per-gate `score_breakdown`.

## 6. Blocking logic

Any of the following blocks a release:

1. A pipeline reports a blocking taxonomy status
   (`FRAMEWORK_INVALID`, `API_FAILURE`, `PERFORMANCE_FAILURE`,
   `SECURITY_FAILURE`, `CRITICAL_LEAK`, `CRITICAL_FAILURE`).
2. A pipeline reports `PASS` with zero controls (vacuous pass).
3. A required pipeline has no evidence artifact on disk.
4. `environment` is not in the allow-list (`staging`, `preview`) —
   production evaluation is refused.
5. Any negative control that should have been denied is reported as
   allowed.

## 7. Evidence flow

```text
        ┌────────────────────────┐
        │ Pipelines produce      │
        │ evidence.json files    │  ← EE-1
        └───────────┬────────────┘
                    │
                    ▼
        ┌────────────────────────┐
        │ eval-gate.mjs reads    │
        │ the day directory      │  ← EC-1
        └───────────┬────────────┘
                    │
                    ▼
        ┌────────────────────────┐
        │ certification.mjs      │
        │ classifies each gate   │
        │ and computes score     │
        └───────────┬────────────┘
                    │
        ┌───────────┴───────────────┐
        ▼                           ▼
  CERTIFICATION.json         CERTIFICATION.md
  EXECUTIVE_SUMMARY.md       history.json
```

## 8. API

```js
import { getCertification } from "./tests/evidence/eval-gate.mjs";

const cert = getCertification({
  day: "2026-07-01",
  release: "v1.42.0",
  commit: process.env.GITHUB_SHA,
  environment: "staging",
});

if (cert.overall_status !== "PASS" && cert.overall_status !== "PASS_WITH_WARNINGS") {
  process.exit(1);
}
```

Suitable for:

- CI (GitHub Actions release gate)
- Internal dashboards inside Quantivis itself
- Ad-hoc audits from a shell

## 9. Release governance

- The Certification Engine is the only supported way to decide a release.
- Overriding a `BLOCKED` or `CRITICAL_BLOCK` requires an explicit
  documented waiver from Engineering + Security + Compliance leads, per
  `RELEASE_GATE.md § Sign-off`.
- Certification artifacts must be attached to the release ticket and
  retained per the retention policy in `security-controls-evidence.md`.

## 10. What this engine deliberately does not do

- It does not call production.
- It does not execute tests — it only reads their output.
- It does not send emails, charge cards, or invoke live AI.
- It does not modify product features.
- It does not accept an environment outside the allow-list.

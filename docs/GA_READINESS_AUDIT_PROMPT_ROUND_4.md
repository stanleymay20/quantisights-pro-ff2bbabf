# GA & Pilot-Readiness Audit — Prompt (Round 4)

Use this as the standing instruction for the next audit pass. It continues the
series that produced the fixes below — same method, next slice of surface
area. Do not re-open anything already closed by rounds 1-3 without new
evidence that the fix regressed.

## Mission

Quantivis is being sold into two states at once: **prospects running a
pilot** (time-boxed, real data, being evaluated against a decision) and
**buyers doing GA/procurement diligence** (reading trust, security, and
pricing surfaces before a contract). Both audiences are unforgiving of the
same failure mode this series keeps finding: **a screen asserts something
the underlying data does not support.** A pilot champion who catches one
fabricated number stops trusting every other number in the product. A
procurement reviewer who catches one inflated compliance claim escalates it
to legal instead of asking a follow-up question.

Round 4's job is to find the next batch of these trust breaks, prioritizing
the parts of the product a pilot prospect or GA evaluator actually touches
in their first two weeks — onboarding, the readiness/maturity surfaces that
tell them "you're ready," and the public procurement surface — since prior
rounds concentrated on steady-state dashboards, governance, and back-office
cron/billing paths.

## What prior rounds already closed (do not re-litigate without new evidence)

| Round | Findings fixed |
|---|---|
| Live-audit batch 1 & 3 | Duplicate-decision flooding, fake dashboard widget, nav dead-end, AI Boardroom nav duplicate, data-quality index 100x scale bug |
| GA audit batch 1 | `enforce_decision_approval_gate()` finality regression, Portfolio Overview showing `$` while the rest of the app uses `€`, dataset count / confidence rounding mismatches |
| GA audit batch 2 | Ambiguous "Active" stat label, AICIS credential-failure state not surfaced |
| GA audit batch 3 | AICIS 3-way status contradiction, retention-policy false-"configured" state |
| Audit round 2 misc batch | Nav duplicates, privacy dashboard link, threshold clamp, marketing copy accuracy, billing renewal date |
| Various (#16–#26) | Data Lineage funnel (Clean > Raw), Governance vs. Security Posture conflation, Trust Center `connector_health_pct` always 100%, cron org fan-out unbounded, retention-cleanup summary bleeding across orgs, transform-metrics parity, orphaned CommandCenter chain, `datasets.status` active/completed mismatch hiding data, Pipeline Observability blind to AICIS Bridge outages |
| Audit round 3 batch | Connector-health blind spot (per-surface circuit breaker), Board Report degenerate-simulation caveat, Intelligence Inbox trust-strip removal, billing reconciliation, OKR quarter |
| #28–#29 | Dashboard's fabricated Critical Risk signal, Strategy Pack risk-score freshness context, CSV validation `invalidPoints` undercount |

These establish the standard: every claim on screen must trace to a real
query result, every status badge must reconcile with the other places the
same fact is shown, and every empty/degenerate state must say so instead of
rendering a plausible-looking zero.

## Round 4 scope

Work through these areas in the order given. Stop and open a fix batch (4-6
independent findings, same PR-batch style as prior rounds) once you have
enough to justify a commit rather than trickling out one-line fixes.

### 1. First-run / pilot onboarding truthfulness

- `src/components/dashboard/WelcomeFlow.tsx` — the 3-step "Guided First
  Decision" flow promises specific behavior ("Quantivis activates within
  seconds," "demo loads 15 months of sample B2B data," "every Decision
  Brief shows confidence, source data, and risk"). Verify each claim against
  what actually happens for a brand-new org with zero data, and for the
  `/demo` route. If a promised element (confidence, source data, risk) can
  be absent on a real brief, the copy is a diligence risk, not just UX.
- Demo-mode / sample data leakage: confirm `quantivis_demo_mode` and
  `DEMO_MODE_KEY`-gated state can never bleed into a real pilot org's
  numbers (dashboards, Copilot answers, exports) after a user connects real
  data — check the transition, not just the two steady states.
- New-org empty states across the modules a pilot evaluator opens first
  (Dashboard, Copilot, Decisions, Trust Center, Governance). A "0" or blank
  chart must read as "no data yet," not as a real zero-value result.

### 2. Readiness/maturity self-assessments must match reality

These screens exist specifically to tell a pilot sponsor or internal
champion "you are ready" — any looseness here is the highest-leverage bug
class for this audit:

- `src/components/copilot/Phase6Readiness.tsx` ("Deployment Readiness" /
  gates 1-4) — confirm each gate's live measurement (WAU, Copilot routing
  accuracy, brief universality, procurement accessibility) is computed from
  the same org/dataset scope shown elsewhere, and that `gate4Passed` isn't a
  prop that silently defaults to a misleading state when no caller passes
  it.
- `src/components/decision-intelligence/DecisionMaturityAssessment.tsx` and
  `src/components/scenarios/ScenarioReadiness.tsx` — same check: do the
  displayed scores move when the underlying data does, or can they get
  stuck showing a stale/default readiness level?
- `src/pages/PilotAudit.tsx` — this is the in-app tenant-isolation
  self-check ("Pilot Safe: YES/NO"). Confirm the edge-function `dry_run`
  checks actually exercise rejection paths rather than just asserting
  dry-run success (note the existing `edge_reject` section already
  self-reports as "skipped... validated via backend tests" — verify that
  backend coverage still exists and hasn't drifted from the function list
  in `EDGE_FUNCTIONS`).

### 3. Public GA/procurement surface (build on `LIVE_COO_READINESS_AUDIT_2026-06-24.md`)

That audit found CSP/observability blockers, a live `/trust` 404, duplicated
procurement metadata, and inconsistent SOC 2 wording. Re-run the same
inspection method (live HTTP responses, rendered metadata, logged-out route
behavior) against the current deployed build to check whether those fixes
shipped and whether the same classes of bug exist on routes not covered
last time — `/pricing`, `/compare`, `/security`, `/enterprise/contact`,
`/handbook`. Specifically re-check:
- Does every certification/compliance claim in-app (`SecurityPosture.tsx`,
  `TrustCard.tsx`, `TOMs.tsx`) match the Trust Center's own "in progress vs.
  complete" wording, with no route saying something stronger than the
  source of truth?
- Do `Billing.tsx`, `UpgradeModal.tsx`, and `EnterpriseContact.tsx` describe
  the same pilot→paid conversion terms (trial length, seat limits, pricing
  tiers) without contradicting each other or the public `/pricing` page?

### 4. Release-gate / certification claims vs. product surface

`docs/release-gate.md` defines hard pass criteria (industry classification
≥95%, PII detection, schema-evolution drift, governance scoping). Spot-check
whether any in-app surface (Governance, Data Lineage, Trust Center) *asserts*
a number derived from these gates (e.g., "classification accuracy," "PII
coverage") that isn't actually wired to a real certification run — a
hardcoded or aspirational figure here is the same failure class as the
already-fixed data-quality-index bug, just in a higher-stakes spot since
procurement reviewers weight compliance numbers heavily.

## Method (unchanged from prior rounds)

1. Prefer inspecting real behavior — live queries, actual edge-function
   responses, rendered routes — over trusting comments or prior
   documentation.
2. When a screen shows a status, badge, or score, find every other place in
   the app that reports the same underlying fact and check they agree.
3. Trace suspicious numbers back to their source query/table and confirm
   the scoping (`organization_id` + `dataset_id` where required) matches
   what's actually rendered.
4. Prefer a real fix (correct the data path, add the missing scope, replace
   a hardcoded value with a live one) over hiding the symptom. Where a
   genuine data-availability gap exists (e.g., a degenerate simulation with
   no dependent KPI), add an honest caveat rather than fabricating a
   plausible number — that is the precedent set by the Board Report fix in
   round 3.
5. Add or update a regression test for each fix, named consistently with
   the existing `src/test/ga-audit-*` / `src/test/audit-round*` suites.
6. Batch independent findings into one commit/PR the way rounds 1-3 did;
   don't open a PR per one-line fix.

## Out of scope for this round

Anything already itemized in the "closed" table above without new evidence
of regression, and any change that would require weakening
`npm run release-gate` criteria to pass (per `docs/release-gate.md` — never
weaken the harness to make the gate pass).

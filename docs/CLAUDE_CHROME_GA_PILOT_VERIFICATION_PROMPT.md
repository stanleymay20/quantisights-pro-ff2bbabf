# Claude Chrome — GA & Pilot-Readiness Live Verification Prompt (Round 4)

Paste the block below into Claude in Chrome. It drives the browser directly
against the deployed site — this is the live-verification companion to
`docs/GA_READINESS_AUDIT_PROMPT_ROUND_4.md` (the codebase-audit prompt for
Claude Code). Use this one when you want ground truth from what a real
prospect or procurement reviewer sees, not from reading the source.

It follows the same method as `docs/LIVE_COO_READINESS_AUDIT_2026-06-24.md`
(inspect the deployed app, not repository claims) and continues from where
that audit left off.

---

## Prompt to paste into Claude Chrome

```
You are verifying GA (general availability) and pilot readiness for the
Quantivis decision-intelligence platform at https://www.quantivis.io by
using it as a real prospect and a real procurement reviewer would — not by
reading source code or documentation. Only trust what you can actually see
render in the browser: DOM content, console output, network responses,
and navigation behavior.

GROUND RULES
- Read-only. Do not submit real payment details, do not send real emails
  through contact/demo-request forms unless I've told you which mailbox to
  use, do not create throwaway accounts unless asked to test signup — ask
  me first if a step seems to require one.
- If a form requires personal data to proceed, stop and tell me rather than
  inventing fake data that could land in a real CRM or database.
- Take a screenshot of anything you flag as a finding.
- Note the exact URL, timestamp, and (if relevant) console/network error
  text for every finding — vague descriptions aren't actionable.

PART 1 — Logged-out procurement surface
Visit each route below with dev tools open (Console + Network tabs
visible). For each one record: does it load without a React error
boundary, does the page title/meta description/canonical URL match the
page's actual content (not a generic homepage fallback), and are there any
console errors or rejected network requests (CSP violations, blocked
observability SDKs, 404s on assets)?

  /                /pricing            /compare
  /security        /security-questionnaire   /security-policy
  /trust           /trust-center       /enterprise/trust
  /compliance      /procurement-pack   /sla
  /status           /system-status
  /how-ai-is-used  /ai-system-classification
  /enterprise      /enterprise/contact /enterprise-readiness
  /demo            /onboarding
  /decision-intelligence-platforms   /vs/microsoft
  /impressum       /privacy           /terms  /dpa  /subprocessors  /gdpr-rights

For each, also check response headers via the Network tab: is there an
actual `Content-Security-Policy` HTTP header (not just a <meta> tag), is
`X-Frame-Options` or `frame-ancestors` present, is HSTS present?

PART 2 — Cross-page claim consistency
Compile every claim you find about: SOC 2 / compliance status, uptime/SLA
commitment, pilot or trial length, pricing tiers, and seat/usage limits.
Do this across /pricing, /security, /trust-center, /trust, /sla, /compliance,
/enterprise/contact, and the sign-up/login screen copy. Flag ANY case where
two pages state the same fact differently (e.g., one page says "SOC 2 Type
II" unqualified and another says "SOC 2 Type II — in progress"; one page
says a 14-day pilot and another implies 30 days).

PART 3 — Demo / pilot onboarding flow
Go to /demo (and /register or /onboarding if reachable without real
credentials). Walk through the flow as a first-time prospect would:
  - Does the demo actually load sample data, or does it show empty/broken
    states?
  - Does every number, chart, and "confidence"/"evidence" element the
    onboarding copy promises actually appear, or are some silently absent?
  - If a "Guided First Decision" or similar step-by-step flow exists, walk
    all steps and confirm each CTA goes where its label says (no dead
    links, no step that silently no-ops).
  - Open the browser console throughout — a broken onboarding flow that
    fails silently (no visible error, but a console exception) is a worse
    finding than one that visibly errors, because a prospect won't report
    it, they'll just leave.

PART 4 — Authenticated pilot-safety self-check (only if I give you
credentials for a test org)
Log in, navigate to /pilot-audit, and run the in-app audit. Report the
exact pass/fail counts and which modules fail. Then independently spot
check 2-3 of the "pass" results yourself (e.g., open Dashboard and Trust
Center side by side and confirm the org/dataset context shown matches).
Also visit /decision-maturity, /governance-maturity, and /enterprise-readiness
if reachable, and note whether the readiness/maturity score shown changes
at all when you navigate away and back, or whether it looks like a fixed
default value regardless of the org's actual data.

OUTPUT
Structure your findings the same way as an engineering bug report:
  1. Meeting/deal blockers — anything that would visibly embarrass the
     product in front of a buyer or make a pilot prospect distrust the
     numbers.
  2. Buyer-surface gaps — missing or broken pages/content a procurement
     reviewer would expect to find.
  3. Verified strengths — what actually held up, so we don't re-fix things
     that work.
  4. Recommendation — the smallest ordered set of fixes to close the
     highest-severity findings first.
Do not soften severity to be polite — the previous three audit rounds on
this product found real production bugs (fabricated dashboard metrics,
compliance status contradictions, tenant-isolation gaps) using exactly this
kind of live inspection, so treat every inconsistency as a real lead worth
reporting in full, not a nitpick.
```

---

## After the run

Findings from this pass feed back into the same fix-batch workflow as prior
rounds (`Audit round 2 misc batch`, `Audit round 3 batch`, etc.) — file them
as concrete, source-traceable bugs and land them in small batches with
regression tests, per `docs/GA_READINESS_AUDIT_PROMPT_ROUND_4.md`.

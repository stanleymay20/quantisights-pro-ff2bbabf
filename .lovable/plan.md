# Plan: Close the gap to #1 vs Domo's "Decision Intelligence Platforms" article

Sequenced in 3 phases. Phase 1 ships in this turn; Phase 2 happens in the same turn (read-only research that shapes Phase 1 copy); Phase 3 is a follow-up turn after you approve Phase 1.

---

## Phase 1 — Positioning page (ship now)

**Route:** `/decision-intelligence-platforms` (public, indexed). Linked from footer + nav under Resources.

**Frame:** A category-defining comparison page, not a marketing brochure. The thesis: *"BI shows what happened. DI platforms automate the next action. Quantivis governs the reasoning itself."*

**Sections:**
1. **H1 + subhead** keyword-aligned ("Decision Intelligence Platforms in 2026 — Compared").
2. **The category gap** — 3 stats from Domo's piece (58% bad-data, $53B by 2033, 19.1% CAGR) reframed against governance and epistemic integrity.
3. **The 6-stage lifecycle, scored** — show Domo's own lifecycle (Ingest → Model → Simulate → Execute → Capture → Retrain). Map to Quantivis SUDAL with append-only audit at every stage. Visual: lifecycle ring with green checkmarks for Quantivis, partial for others.
4. **Comparison matrix** — Quantivis vs Domo, Quantexa, ThoughtSpot, Qlik, IBM Cognos, SAS, Power BI, SAP AC, TIBCO, Sisense across 10 rows:
   - Closed-loop SUDAL · Append-only decision ledger · Contextual governance profiles · Approval chain enforcement · Epistemic confidence capping · Information Quality scoring · Causal vs correlation semantics · DSGVO posture · Evidence-hashed procurement packs · NL Copilot.
   - Honest "Limited / Partial / Strong" cells (no all-green Quantivis row). Cite Domo's own DI-depth ratings for their rows.
5. **What no one else ships** — 4 cards: Append-only governance audit, Contextual Governance Engine, Epistemic Integrity (0.85 cap, ConfidenceBadge), Operational Intelligence Graph + Narrative Fusion.
6. **Where we're honest about gaps** — short paragraph: connector count, NL-search-as-front-door, embedded analytics. Builds trust and pre-empts buyer objections.
7. **CTA** — "See the Decision Ledger live" → /demo + "Read the methodology" → /how-ai-is-used.
8. **FAQ** (matches Domo's structure for SERP parity): What is a DI platform · DI vs BI · How is Quantivis different · GenAI + governance · German market / DSGVO.
9. **JSON-LD** — Article + FAQPage schema. Canonical, OG, Twitter, single H1.

**Tone:** Anchored, evidence-cited, no superlatives. Matches the project's "Label: value" doctrine.

**Brand:** Reuse `index.css` tokens + existing chart-config palette. No new design system.

## Phase 2 — SEO research (this turn, read-only)

Before writing copy, run Semrush against quantivis.io to ground page targeting:
- `serp_analysis` "decision intelligence platforms" (us + de databases) — see who ranks, KDI.
- `keyword_research` same term + variations ("decision intelligence software", "best decision intelligence platforms 2026", "decision intelligence vs business intelligence").
- `domain_analysis` quantivis.io — current authority, baseline.
- `compare_domains` quantivis.io vs domo.com — gap size.

I fold the winning long-tails directly into the page's H2s and FAQ before shipping. No separate page; one page, optimized once.

## Phase 3 — Product gap closure (next turn, after Phase 1 ships)

The 3 things Domo's piece exposes as table-stakes. I'll spec + build in sequence:

1. **Connector breadth surface** — `/integrations` page listing AICIS + every Supabase-backed source category, plus a "Request connector" lead form. Pairs with a small connector_catalog table seeded from `data_connectors`. Honest count, not inflated.
2. **NL search as front door** — make Copilot the homepage hero search bar (single input → /copilot with prefilled query). The pipeline already streams; this is presentation.
3. **Embedded / white-label angle** — reuse existing `embed_tokens` table to ship `/embed/decision-ledger` and `/embed/governance-status` iframe-safe routes + a one-page "Embed Quantivis" doc.

Each item is a separate small PR after you approve Phase 1.

---

## Technical details

- New file: `src/pages/DecisionIntelligencePlatforms.tsx` + register in `src/routes/index.tsx` via `RouteEntry` with `wrapLayout`.
- Add nav entry + footer link.
- Head tags via existing `Helmet` pattern; JSON-LD inline.
- Components reused: existing `Card`, `Table`, `Badge`, `Accordion` from shadcn. No new design tokens.
- Sitemap: append `/decision-intelligence-platforms` to `public/sitemap.xml`.
- After ship: `seo--trigger_scan` so the SEO panel verifies title/desc/canonical/H1.

## Out of scope (call out so we don't drift)

- No new ontology, no new edge functions, no schema migrations in Phase 1 — respects the Phase 5E.5 demonstrability freeze.
- No claims that need legal review (no SOC2/ISO/HIPAA "certified" wording — only "controls aligned to").
- No connector additions in Phase 1.

---
name: Dual-Layer Data Doctrine
description: Client truth vs internal reference data — separation rules, blending policy, confidence adjustment, provenance
type: feature
---

# Quantivis Data Blending Doctrine

## Three Layers (never collapsed)

- **Layer A — Client Truth**: tenant-private datasets (revenue, churn, inventory, ops). Drives the decision context. Tagged `datasets.layer_type = 'client'`.
- **Layer B — Internal Intelligence**: cross-client benchmarks, macro signals, supply chain indices, competitor data. Stored in `internal_reference_data` table. Read-only to all authenticated users; writes via service role only.
- **Layer C — Decision Synthesis**: blending happens at advisory/decision time via the `enrich-decision-context` edge function. Produces a `decision_enrichment` row tying client_evidence + internal_context + combined_interpretation.

## Rules

1. Client data is never overwritten or merged into raw form with internal data.
2. Every advisory/decision must show provenance: client evidence vs external context.
3. Confidence adjustment is bounded: ±10pp max from internal context alone.
4. Blending rules: `headwind_dampening` (-5pp), `tailwind_reinforcement` (+5pp), `context_enriched` (+2pp), `no_context` (0).
5. Reference data has a `confidence_grade` (A/B/C/D) and `source` — surfaced in UI for trust.

## Schema

- `datasets.layer_type` — 'client' | 'internal' | 'enrichment'
- `datasets.provenance` jsonb — origin, source labels
- `internal_reference_data` — category, metric_name, value, region, industry, period, source, confidence_grade
- `decision_enrichment` — links advisory/decision to client_evidence + internal_context + blending_rule + confidence_delta

## Edge function

`enrich-decision-context` — accepts `{organization_id, advisory_id?, decision_id?, region?, industry?, metric_focus?, client_confidence?}`, returns enriched confidence + interpretation, persists to `decision_enrichment`.

## UI surfaces (todo)

- DecisionEvidencePanel should split Client Evidence | External Context | Combined Interpretation
- Dataset list should show layer_type badge
- Approval dialog should display "X external context points applied (+/-Npp confidence)"

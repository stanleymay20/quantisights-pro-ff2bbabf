# Quantivis Excellence Program — Approved Plan (Revised)

Reuse-first rollout that turns Quantivis into a Decision Intelligence Operating System by composing existing modules. No parallel engines, no synthetic data, ontology freeze respected, confidence cap 0.85.

End-state flow:

```text
Data → Intelligence → Recommendation → Decision → Outcome → Learning
```

---

## Reuse Map (no rebuilds)

| Stage | Existing owner |
|---|---|
| Data | `useActiveDataContext`, `DatasetContext`, `data_connectors`, `raw_records` |
| Intelligence | `useInsights`, `useExecutiveIntelligence`, `useNarrativeFusion`, `intelligence_briefs` |
| Recommendation | `advisory_instances`, `aicis_recommendations`, `prescriptive-advisory` |
| Decision | `decision_ledger`, `auto-create-decisions`, `useDecisionContexts` |
| Outcome | `decision_outcomes`, `outcome_predictions`, `OutcomeFeedbackWidget` |
| Learning | `calibration_assessments`, `calibration_models`, `intelligence_memory`, MAB |
| Trust | `trust_metrics_snapshots`, `ProofBar`, `ConfidenceBadge`, `IQScoreBadge` |
| Boardroom | `AIBoardroom.tsx`, `Deliberation.tsx`, `lib/deliberation/perspectives.ts` |
| Governance | `governance_profiles`, `approval_chain_stages`, `GovernanceContextBadge` |

---

## Revised Execution Order (approved)

1. **Phase 6 — Explainability.** Consolidate `DecisionEvidencePanel` + `DualLayerEvidencePanel` + `WhyThisMattersPanel` into one `<ExplainabilityPanel>` with fixed 6 sections: Why / Evidence / Confidence / Alternatives / Risks / Expected Impact.
2. **Phase 8 — Trust Strip.** One `<TrustStrip>` reading `trust_metrics_snapshots` + IQ scores; mounted on advisories, briefs, board reports, AI Boardroom.
3. **Phase 1 — Command Center (strengthened).** Reframe `Dashboard.tsx` opener around four questions, not widgets:
   - What changed?
   - Why does it matter?
   - What decision is needed?
   - What happens if we wait?

   Composed from `WhatChangedWidget`, `ExecutivePriorityStack`, `DecisionQueue`, `BoardroomBrief`, Cost-of-Delay engine.
4. **Phase 2 — Onboarding wizard.** 6-step linear flow: Connect/Upload → First Brief → Risks → Opportunities → Board Report → First Decision.
5. **Phase 2.5 — Activation Intelligence (new).** Measure the funnel: Account Created → Org Created → Workspace Created → Dataset Uploaded → First Insight → First Decision Logged → First Outcome Recorded. Reuses `audit_log` + `intelligence_observability`. No new tables.
6. **Phase 3 — Universal Decision Logging.** Single "Log Decision" action on every recommendation surface (advisory, AICIS, narrative, insight), all writing to `decision_ledger` with `recommendation_source`.
7. **Phase 5 — Deterministic Boardroom Lenses.** Extend `lib/deliberation/perspectives.ts` to 5 evidence-driven lenses (no persona simulation):
   - Financial Lens
   - Risk Lens
   - Execution Lens
   - Outcome Lens
   - Contrarian Lens
   Same evidence, deterministic reasoning, agreement/disagreement synthesis.
8. **Phase 4 — Outcome Intelligence Center.** Expanded from "dashboard" to a center with three sub-views:
   - **Decision Accuracy** — Predicted / Actual / Variance
   - **Calibration** — Confidence / Observed Accuracy / Bias Direction
   - **Learning** — What improved / worsened / changed
   Reads `decision_outcomes`, `calibration_assessments`, `intelligence_memory`. Exposed in Executive + Governance views.
9. **Phase 9 — Role Workspaces.** `lib/role-workspace.ts` re-orders existing routes per role (Executive / Manager / Analyst / Operator / Admin) via `usePermissions`. Same data, no logic duplication.
10. **Phase 7 — Terminology Layer.** `lib/ui-terminology.ts` mapping (Counterfactual → What-If, Diagnostics → Business Health Check, Lineage → Data Sources). Technical names kept internally.
11. **Phase 10 — Usability Instrumentation.** Funnel writer on `audit_log` + `/admin/usability` page reading from it. Measures the *final* flows.

---

## Migrations (only two, both small)

- **M1 (Phase 3):** add `recommendation_source TEXT`, `source_id UUID` to `decision_ledger` if not present; backfill from `advisory_instances` / `aicis_recommendations`.
- **M2 (Phase 10):** add `event_type` (text + CHECK in trigger) on `audit_log` for usability events. No new table, RLS unchanged.

No schema changes for phases 1, 2, 2.5, 4, 5, 6, 7, 8, 9.

---

## Guardrails (non-negotiable)

- No new ontology, pressure dimensions, or reasoning layers (Core freeze).
- No persona simulation in Phase 5 — lenses are computed from deterministic evidence.
- All confidence capped at 0.85.
- `organization_id` + `dataset_id` required everywhere via `useActiveDataContext`.
- Edge function calls go through `invokeWithRetry`.
- All recommendations remain governed by the existing approval chain.

---

## Starting Now

Beginning with **Phase 6 — Explainability consolidation**.

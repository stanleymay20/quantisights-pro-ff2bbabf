
# QUANTIVIS FORENSIC AUDIT — FIX EXECUTION PLAN

Based on verified codebase state (TSC: 0 errors, 71 `: any`, 22 pages without SectionErrorBoundary, 11 direct invoke calls, 11 silent catches).

---

## TIER 1: IMMEDIATE BLOCKERS (Enterprise-risk debt)

### 1.1 — Add SectionErrorBoundary to 22 unprotected strategic pages

**Risk removed:** One component crash → full page white-screen on 22 enterprise surfaces  
**Files:**
- `src/pages/AlertPlaybooks.tsx`
- `src/pages/Billing.tsx`
- `src/pages/Team.tsx`
- `src/pages/PrivacyDashboard.tsx`
- `src/pages/DataConnectors.tsx`
- `src/pages/CalibrationAssessment.tsx`
- `src/pages/Diagnostics.tsx`
- `src/pages/Scenarios.tsx`
- `src/pages/Simulations.tsx`
- `src/pages/KPIs.tsx`
- `src/pages/Reports.tsx`
- `src/pages/Misses.tsx`
- `src/pages/DecisionIntelligence.tsx`
- `src/pages/SecurityQuestionnaire.tsx`
- `src/pages/PipelineObservability.tsx`
- `src/pages/NaturalLanguageQuery.tsx`
- `src/pages/CognitiveBiasDetection.tsx`
- `src/pages/CausalInference.tsx`
- `src/pages/CounterfactualExplanation.tsx`
- `src/pages/DecisionAccuracy.tsx`
- `src/pages/DecisionFitness.tsx`
- `src/pages/MarketIntelligence.tsx`

**Fix:** Wrap major content sections in `<SectionErrorBoundary sectionName="...">`.  
**Verify:** Throw test error in each page's child → confirm inline fallback, not white screen.

### 1.2 — Add double-submit guards to destructive mutations in Settings

**Risk removed:** Account deletion or demo-seed can fire multiple times  
**Files:** `src/pages/Settings.tsx` (lines ~326, ~447)  
**Fix:** Add `isDeleting` / `isSeeding` state; disable button during execution.  
**Verify:** Click delete/seed rapidly → only one invocation fires.

### 1.3 — Wrap Settings direct invokes with error feedback

**Risk removed:** `delete-account` and `seed-demo-data` fail silently on network error  
**Files:** `src/pages/Settings.tsx`  
**Fix:** Add try/catch with toast on error for both invoke calls.  
**Verify:** Block network → trigger action → confirm error toast appears.

---

## TIER 2: NEXT SPRINT (Type safety + trust surface integrity)

### 2.1 — Eliminate 71 `: any` annotations

**Risk removed:** Runtime shape mismatches on enterprise-critical surfaces  
**Priority files (highest `: any` concentration):**

| File | Count | Fix approach |
|------|-------|-------------|
| `src/pages/BoardReport.tsx` | 8 | Define `BoardReportData` interface |
| `src/pages/DecisionIntelligence.tsx` | 5 | Type `decisions` / `simulations` props |
| `src/pages/DataConnectors.tsx` | 3 | Use Supabase generated types |
| `src/components/dashboard/GovernanceKPIs.tsx` | 5 | Type query results inline |
| `src/components/decision-intelligence/*.tsx` | 4 | Define `DecisionRecord` interface |
| `src/components/dashboard/SankeyChart.tsx` | 1 | Type recharts `CustomNode` props |
| `src/components/dashboard/TreemapChart.tsx` | 1 | Type recharts `CustomContent` props |
| `src/components/dashboard/EBITDABridgeChart.tsx` | 1 | Type recharts label render props |
| `src/components/dashboard/WaterfallChart.tsx` | 1 | Type recharts label render props |
| `src/components/settings/EmbedManager.tsx` | 1 | Type `tokens` query result |
| `src/components/settings/OrganizationalIdentitySettings.tsx` | 3 | Type icon prop + Select onChange |
| `src/components/settings/RetentionPolicySettings.tsx` | 2 | Type `value` param + query result |
| `src/components/governance/StewardDrillDown.tsx` | 3 | Type member/dataset query results |
| `src/components/auth/AuthEventLog.tsx` | 1 | Type `events` array items |
| `src/hooks/useBuildDecisionQueue.ts` | 1 | Type `advisories` properly |
| `src/hooks/usePermissions.ts` | 1 | Type permission check result |
| `src/lib/executive-export.ts` | 1 | Define `ExportableDecision` type |
| `src/pages/AlertPlaybooks.tsx` | 3 | Type `escalation_steps` as `Json[]` |
| `src/pages/DataLineage.tsx` | 2 | Type icon map + column_mapping |
| `src/pages/DataSources.tsx` | 1 | Type `config` field |
| `src/pages/DatasetExplorer.tsx` | 1 | Type `column_mapping` |
| `src/pages/EmbedDashboard.tsx` | 1 | Type metrics array |
| `src/pages/FounderHandbook.tsx` | 1 | Type icon prop as `LucideIcon` |
| `src/pages/GovernanceCommandView.tsx` | 3 | Type retention policy filter |
| `src/pages/GovernanceMaturity.tsx` | 1 | Type assessment history items |
| `src/pages/OKRs.tsx` | 2 | Type objective/KR query results |
| `src/pages/Onboarding.tsx` | 1 | Type `kpis` array |
| `src/pages/PipelineObservability.tsx` | 1 | Type reduce accumulator |
| `src/pages/Simulations.tsx` | 1 | Type `sim` prop |
| `src/pages/StrategyPack.tsx` | 2 | Type `source_evidence` |
| `src/pages/CounterfactualExplanation.tsx` | 1 | Type entity map callback |

**Verify:** `npx tsc --noEmit` passes; grep confirms 0 `: any` in src/.

### 2.2 — Label hardcoded compliance values as architectural invariants

**Risk removed:** Procurement reviewer sees `rlsEnabled: true` and asks for proof  
**File:** `src/pages/Compliance.tsx` (lines 61, 66)  
**Fix:** Add visible "(Architectural invariant)" label in UI next to RLS and MFA items, or query real DB state.  
**Verify:** Visual inspection of Compliance page shows honest labeling.

### 2.3 — Wrap fire-and-forget decision-lifecycle invokes with error logging

**Risk removed:** `embed-decisions` and `predict-outcome` fail silently after decision mutations  
**File:** `src/lib/decision-lifecycle.ts` (lines 131, 141, 164, 183)  
**Fix:** Add `.catch(err => console.error("[decision-lifecycle]", err))` to each fire-and-forget.  
**Verify:** Grep confirms no unhandled promise from invoke calls.

---

## TIER 3: BEFORE SCALE (Long-tail hardening)

### 3.1 — Add retry wrapper to PilotAudit dynamic invocations

**Risk removed:** Transient failure during pilot audit edge function calls  
**File:** `src/pages/PilotAudit.tsx` (line 139)  
**Fix:** Replace `supabase.functions.invoke` with `invokeWithRetry`.  
**Verify:** Network throttle → confirm retry behavior.

### 3.2 — Remaining silent catches — add observability

**Risk removed:** Hidden failures in workspace switching, analysis engine, free analysis  
**Files:**
- `src/components/dashboard/WorkspaceSwitcher.tsx:41`
- `src/lib/analysis-engine.ts:612`
- `src/pages/FreeAnalysis.tsx:111`

**Fix:** Add `console.error` with context to each catch block.  
**Verify:** Grep confirms no bare `catch {` without logging in non-infra code.

### 3.3 — Add loading/empty states to PrivacyDashboard reports count

**Risk removed:** Hardcoded `0` reports misleads users  
**File:** `src/pages/PrivacyDashboard.tsx`  
**Fix:** Query actual export count or label as "No exports requested yet".  
**Verify:** Visual check shows honest state.

---

## RUNTIME RE-TEST CHECKLIST

After all fixes, verify each surface:

| # | Surface | Test action | Expected result |
|---|---------|------------|-----------------|
| 1 | `/login` | Login with valid creds | Redirect to dashboard |
| 2 | `/login` | Login with invalid creds | Error toast, no crash |
| 3 | `/register` | Create account | Success flow |
| 4 | `/dashboard` | Load with no data | Empty states render |
| 5 | `/settings` | Click "Delete Account" | Confirmation dialog, single-fire |
| 6 | `/settings` | Click "Seed Demo Data" | Loading state, single-fire |
| 7 | `/compliance` | Load page | All items labeled honestly |
| 8 | `/sso-config` | Save SSO config | Success toast |
| 9 | `/execution-dashboard` | Approve/dismiss action | Toast feedback, no double-submit |
| 10 | `/data-connectors` | Test connection | Loading + result feedback |
| 11 | `/privacy-dashboard` | Load page | Reports count honest |
| 12 | `/decision-ledger` | Create decision | Ledger updates, no silent fail |
| 13 | `/alert-playbooks` | Create playbook | Success feedback |
| 14 | `/team` | Invite member | Toast + table update |
| 15 | `/billing` | Load page | No crash on missing Stripe data |
| 16 | `/diagnostics` | Run diagnostic | Results render in boundary |
| 17 | `/simulations` | Run simulation | Chart renders in boundary |
| 18 | `/decision-intelligence` | Load all tabs | No white-screen on any tab |
| 19 | `/calibration-assessment` | Submit assessment | Feedback on success/failure |
| 20 | `/governance-maturity` | Load assessment | Boundary-protected sections |

---

## SUMMARY METRICS

| Metric | Current | After Tier 1 | After Tier 2 | After Tier 3 |
|--------|---------|-------------|-------------|-------------|
| Pages with SectionErrorBoundary | 12 | 34 | 34 | 34 |
| `: any` annotations | 71 | 71 | 0 | 0 |
| Silent catches (non-infra) | 3 | 3 | 3 | 0 |
| Unguarded direct invokes | 8 | 6 | 2 | 1 |
| Double-submit risk surfaces | 2 | 0 | 0 | 0 |
| TSC errors | 0 | 0 | 0 | 0 |

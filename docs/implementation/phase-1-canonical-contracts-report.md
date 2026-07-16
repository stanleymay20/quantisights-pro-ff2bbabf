# Phase 1: Canonical Contracts — Final Report

Companion to `docs/implementation/phase-1-canonical-contracts-plan.md` and `docs/audits/enterprise-data-platform-code-audit.md`.

## Files changed

**New — canonical contracts (`src/lib/ingestion-contracts/`, 1214 LOC across 17 files):**

| File | Purpose |
|---|---|
| `ids.ts` | Branded ID types (OrganizationId, WorkspaceId, ProjectId, DatasetId, SourceId, IngestionRunId) |
| `checksum.ts` | Deterministic, dependency-free content checksum (drives sampling reproducibility) |
| `errors.ts` | `ProcessingError` contract, `ContractResult<T>` (`{ok:true,value}` / `{ok:false,error}`) |
| `evidence.ts` | `EvidenceRecord` contract |
| `sampling.ts` | `SamplingStrategy` contract + `computeRepresentativeSample`/`sampleRows` (beginning/middle/end/deterministic-random, reproducible, full-scan under 500 rows) |
| `source-identity.ts` | `SourceIdentity` contract (org/workspace/project/dataset/source/run IDs, parser name+version, checksum, processing status) |
| `parsed-tabular.ts` | `ParsedTabularData`/`ParsedRow`/`ParsedCell`/`ParsingEvidence` contracts |
| `field-profile.ts` | `FieldProfile` contract (uses `SamplingStrategy`) |
| `inference.ts` | `PhysicalType` (14 values), `StructuralRole` (14 values), `SemanticMapping` — three separate schemas, `evidenceScore` named explicitly to avoid implying calibration |
| `compute-field-profile.ts` | Builds a real `FieldProfile` from sampled values, composed from the real `messy-data-guards.ts` primitives |
| `infer-structural-roles.ts` | **New, additive** inference: proposes a structural role per field independently, preserving multiple date-family fields instead of demoting all but one |
| `index.ts` | Barrel export |
| `compat/from-parsed-csv.ts` | Wraps real `parseCSVText`/`parseWorkbookFile` output |
| `compat/from-legacy-schema.ts` | Wraps real `inferSchema` output; recovers the date-family role of columns the legacy single-date rule demoted to `segment`, via the `single_date_rule:demoted_to_segment` tag it already leaves in `rulesApplied` |
| `compat/from-semantic-classification.ts` | Wraps real `classifySemanticSchema`/`classifySemanticColumn` output |
| `compat/from-diagnostics.ts` | Wraps real `computeDiagnostics` output as `EvidenceRecord[]` |
| `compat/index.ts` | Compat barrel export |

**New — Deno-side canonical parser:**
- `supabase/functions/_shared/messy-data-guards.ts` — synced port of `parseMessyNumber`/`parseMessyDate` and their direct dependencies, kept in parity by an automated test (below), not by convention alone.

**Modified — server number/date parser unification:**
- `supabase/functions/transform-metrics/index.ts` — replaced the locally-duplicated, broken `cleanNumeric` (same comma-stripping bug as the one fixed in `DataUpload.tsx` last session) and minimal `normalizeDate` with calls to the canonical shared module. **This is a live, reachable function** (re-transforms already-ingested `raw_records`), so this closes a real, currently-exploitable data-corruption path, not just a dormant one.
- `supabase/functions/_shared/ingest-pipeline.ts` — replaced `pickNumber`/`pickDate` (used only by the confirmed-dormant `ingest-csv-pipeline`, zero frontend callers) with calls to the same canonical module, for consistency.

**New — tests (9 files, 82 tests):**
- `src/test/number-date-parser-parity.test.ts` (29 cases) — imports both the client and Deno-side parser files directly into the same Vitest run and asserts identical output; this is the enforcement mechanism for the "one canonical implementation" requirement, not just a naming convention.
- `src/test/number-parser-fixtures.test.ts` (11) — the exact fixture set from the phase brief (EU/US formats, space-thousands, currency symbols, accounting negatives, percentages, empty/invalid input, safety-limit values).
- `src/test/date-parser-fixtures.test.ts` (12) — ISO, German, US, year-only, year-month, Excel serial, Unix timestamps, invalid text, ambiguous dates, and one intentionally-documented known gap (month-13 dates are not rejected — see "What Phase 1 does not solve").
- `src/test/server-number-date-parser-migration.test.ts` (3) — confirms the migrated Edge Functions no longer contain the broken inline implementations.
- `src/test/ingestion-contracts-schemas.test.ts` (8) — Zod validation: branded ID rejection, required-field rejection, evidence-array-required-on-proposals, evidenceScore bounds, error-message shape.
- `src/test/ingestion-contracts-sampling.test.ts` (7) — full-scan threshold, segment coverage on large datasets, reproducibility given the same checksum, divergence given a different checksum, zero-row edge case.
- `src/test/ingestion-contracts-structural-roles.test.ts` (4) — the multi-date preservation guarantee, using real computed field profiles.
- `src/test/ingestion-contracts-compat-adapters.test.ts` (8) — **imports and calls the real `parseCSVText`, `inferSchema`, `classifySemanticSchema`, `computeDiagnostics`** (not reimplemented logic) and proves the date-demotion recovery against actual `inferSchema` output on a 6-row, 2-date-column fixture.

## Files deprecated

None. Per the plan, `inferSchema`, `classifySemanticColumn`, `computeDiagnostics`, `parseCSVText`, `parseWorkbookFile`, and `DataUpload.tsx` itself are all unmodified and continue to run exactly as before. `parseEuropeanNumber` (dead code, flagged in the audit) was left in place — deletion is a cleanup decision, not a contracts decision, and was explicitly out of scope.

## Duplicated implementations remaining

| Concern | Status after Phase 1 |
|---|---|
| Number parsing | **Unified.** Every production call site (client: all of `data-upload-utils.ts`, `semantic-column-classifier.ts`, `mixed-type-analyzer.ts`, `ingestion-auto-fix.ts`, `DataUpload.tsx`; server: `transform-metrics`, `ingest-pipeline.ts`) now calls `parseMessyNumber` or its parity-tested Deno twin. |
| Date parsing | **Unified**, same scope as above, via `parseMessyDate`. |
| `parseEuropeanNumber` | Still dead code (`messy-data-guards.ts:66-76`), called only from `certification.test.ts`. Not migrated or deleted — out of scope. |
| Web Worker CSV path (`ingestion.worker.ts`, ≥1MB files) | **Not touched.** Still skips header dedup/cell normalization that the sync path applies — a real divergence the audit flagged, explicitly out of scope for "canonical contracts" per the plan (it's a parsing-completeness bug, not a number/date-parser duplication). |
| Server CSV parser (`_shared/csv-parser.ts`) | **Not touched.** Feeds the dormant `ingest-csv-pipeline`; not migrated to the canonical contracts in this phase. |
| Schema/semantic inference (`inferSchema`, `classifySemanticColumn`) | Still the production system; the canonical contracts wrap their output via compat adapters rather than replacing them. The new `infer-structural-roles.ts` is additive and not yet wired into any production path. |

## Tests: before / after

| | Before | After |
|---|---|---|
| Test files | 95 | 103 |
| Tests | 832 | 914 |
| All passing | Yes | Yes |

## Build result

`npm run build` — succeeds, same pre-existing bundle-size warning as baseline (unrelated to this work). The new `src/lib/ingestion-contracts/` modules are not imported by any production UI path, so they don't appear in the shipped bundle at all — confirmed by inspecting the build output chunk list.

## Lint result

`npm run lint` — 771 problems (720 errors, 51 warnings), **identical to the pre-Phase-1 baseline**. All new files (`src/lib/ingestion-contracts/**`, all new test files) have **zero** lint errors or warnings. The one pre-existing error inside a file this phase touched (`_shared/ingest-pipeline.ts:26`, `type SvcClient = any`) predates this phase and simply shifted one line down because of the new import statement — not a new violation.

## Compatibility risk

**None to the live production flow.** `DataUpload.tsx` was not modified in this phase (beyond the already-shipped, already-tested P0 numeric fix from the prior session) and continues calling `parseCSVText`, `inferSchema`, `classifyDataset`, `computeDiagnostics`, and `buildIngestionIntelligence` directly, exactly as before. The canonical contracts and compatibility adapters are net-new, additive code with no import edges from any live UI component.

The two Edge Function migrations (`transform-metrics`, `ingest-pipeline.ts`) are behavior changes, but narrowly scoped and low-risk:
- `ingest-pipeline.ts` is confirmed dormant (zero frontend callers per the audit) — this change cannot affect any live traffic today.
- `transform-metrics` is live, but the change is strictly a correctness fix that makes its number/date parsing match the already-shipped, already-tested client behavior — closing a bug, not introducing a new one. The parity test guarantees the migrated behavior is byte-for-byte identical to the client's.

## Database impact

**None.** No new tables, no RLS changes, no migrations were created or applied. No database migration was found to be necessary at any point in this phase — the stop-and-explain trigger in the plan was never reached.

## Security impact

**None identified.** No new attack surface: the new contracts are pure in-memory TypeScript/Zod with no network, storage, or database calls. The Edge Function changes replace one pure parsing function with another; no change to auth guards, RLS-dependent queries, or credential handling in either modified file.

## What Phase 1 does not solve

Explicitly out of scope, carried forward as recommended Phase 2+ work:

1. **DataUpload.tsx is not wired to the canonical contracts.** The live upload flow still produces and persists the old, lossy `dataset_versions.metadata` snapshot (audit §5.2) — none of the richer canonical contracts (full evidence, multi-date structural roles, calibrated evidence-score labelling) reach the database yet. This was intentionally deferred per the plan's "no large UI/behavioral rework" scope control.
2. **The ≥1MB Web Worker CSV path still diverges from the sync path** (header dedup/normalization gap) — a real bug, not touched in this phase.
3. **The dormant `ingest-csv-pipeline`/`_shared/csv-parser.ts` pipeline is not unified with the canonical contracts** — still a third, separate implementation.
4. **Ambiguous D/M/Y date resolution is still not locale-aware.** `parseMessyDate` always resolves the same way regardless of a file's actual source locale, because no per-file locale signal exists anywhere in the system. A `SourceIdentity`-level locale hint (populated at upload time, e.g. from user selection or org default) would let a future date parser disambiguate correctly instead of guessing — this phase's contracts have room for it (`SourceIdentity` doesn't yet carry it) but it was not added, to avoid scope creep into UI changes.
5. **`parseMessyDate` does not validate the resulting calendar date is real** — `"13/13/2024"` parses to the syntactically ISO-shaped but calendrically invalid `"2024-13-13"` rather than `null`. Documented and locked in by a test (`date-parser-fixtures.test.ts`), not fixed — changing validation behavior was judged out of scope for a parser-*unification* phase and risks behavior change beyond "make existing implementations agree with each other."
6. **Evidence scores are still rule-strength heuristics, not calibrated probabilities**, in both the legacy system and everything the compat adapters wrap from it. Phase 1 fixed the *labelling* (nothing in the new contracts calls this "confidence" or a "probability") but did not build the labelled-fixture calibration infrastructure the mission's Part 3 describes — that requires an evaluation harness and labelled ground truth this phase did not create.
7. **`infer-structural-roles.ts` is new and unused by any production path.** It's tested and correct against hand-verified real-data cases, but nothing calls it outside the test suite yet — wiring it in (even in "review required" mode alongside the existing UI, not replacing it) is Phase 2+ territory.
8. **No document/PDF/DOCX/OCR/RAG/ontology work was done**, per explicit instruction.

## Recommended Phase 2 scope

In priority order, given what this phase surfaced:

1. **Wire `infer-structural-roles.ts` and the compat adapters into `DataUpload.tsx` in an additive, non-replacing way** — e.g. persist the full canonical evidence/proposal set alongside (not instead of) the existing `dataset_versions.metadata` snapshot, so the richer data starts accumulating without any UI or behavior change yet. This directly closes audit §5.2 without the risk of a full pipeline cutover.
2. **Add locale hint to `SourceIdentity`** and thread it through to `parseMessyDate` so ambiguous dates stop being a structural guess.
3. **Fix the Web Worker CSV path** to apply the same header dedup/normalization as the sync path — a real, currently-shipping inconsistency independent of this phase's scope.
4. **Unify the dormant `ingest-csv-pipeline` onto the canonical contracts** (or formally retire it if the server-side large-file path is being redesigned anyway) rather than leaving a third parallel implementation.
5. **Build the labelled-fixture evaluation harness** described in the mission's Part 3, so evidence scores can eventually earn the word "calibrated" instead of remaining an honestly-labelled heuristic.

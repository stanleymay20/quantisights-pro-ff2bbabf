# Phase 1: Canonical Contracts — Implementation Plan

Follows from `docs/audits/enterprise-data-platform-code-audit.md`. This plan covers contracts only — no PDF/DOCX/OCR/RAG/ontology/new UI, per the phase brief.

## 0. Baseline (recorded before implementation)

- Branch: `claude/ga-readiness-prompt-8ps4ro`
- Commit: `09bea31c89ac3addda770783fa38304b6ed202c5` ("Enterprise data platform code audit + P0 fix: EU numbers silently corrupted on import")
- Tests: 95 files / 832 tests, all passing (`npm run test`)
- Build: succeeds (`npm run build`), one pre-existing bundle-size warning, unrelated
- Lint: 720 pre-existing errors / 51 warnings (`npm run lint`), overwhelmingly `@typescript-eslint/no-explicit-any` in Edge Functions predating this work — not in scope, not re-litigated
- `zod` is already a dependency (`^3.25.76`) — no new dependency needed for runtime validation

### Files currently involved in CSV/workbook ingestion (from the audit, re-confirmed)

Client:
- `src/pages/DataUpload.tsx` — the only user-facing upload entry point; orchestrates the whole flow and performs the actual `metrics`/`raw_records`/`datasets` writes
- `src/lib/data-upload-utils.ts` — `parseCSVText`, `inferSchema` (→ `DetectedSchema`/`ColumnTarget`), `classifyDataset`, `computeDiagnostics` (→ `DatasetDiagnostics`), `validateData`, `generateIntelligence`
- `src/lib/workbook-parser.ts` — `parseWorkbookFile` (→ `ParsedWorkbook`/`WorkbookSheet`), header-row detection, merged cells
- `src/lib/messy-data-guards.ts` — `parseMessyNumber`, `parseMessyDate`, `normalizeCell`, identifier/boolean/PII/email/phone guards — **the canonical parsing primitives**, confirmed as the single source every other client module already calls through
- `src/lib/semantic-column-classifier.ts` — `classifySemanticColumn`/`classifySemanticSchema` (→ `SemanticColumnProfile`/`BusinessRole`/`SemanticColumnType`)
- `src/lib/ingestion-intelligence.ts` — `buildIngestionIntelligence` orchestrator
- `src/lib/ingestion-metadata.ts` — `toIngestionMetadataSnapshot`, the lossy reduction that's the only thing persisted
- `src/lib/cross-sheet-discovery.ts` — relationship suggestion
- `src/lib/mixed-type-analyzer.ts`, `src/lib/header-recovery.ts`, `src/lib/locale-detector.ts`, `src/lib/data-dictionary.ts`, `src/lib/column-similarity.ts`, `src/lib/import-repair-report.ts` — supporting analysis modules, all already routed through `messy-data-guards.ts`
- `src/workers/ingestion.worker.ts` + `src/hooks/useChunkedIngestion.ts` — the ≥1MB path (confirmed by the audit to skip header dedup/normalization — **not fixed in this phase**, out of scope per "no large UI/behavioral rework"; flagged here only for completeness)

Server (Deno Edge Functions):
- `supabase/functions/_shared/csv-parser.ts` — hand-rolled CSV parser, used only by `ingest-csv-pipeline` (confirmed unreachable from the frontend)
- `supabase/functions/_shared/ingest-pipeline.ts` — `pickNumber`/`pickDate`, minimal, used by `ingest-csv-pipeline`
- `supabase/functions/ingest-csv-pipeline/index.ts` — dormant, zero frontend callers
- `supabase/functions/transform-metrics/index.ts` — **live**, re-transforms already-ingested `raw_records`; has its own `cleanNumeric`/`normalizeDate`, confirmed to have the *same* comma-stripping bug just fixed in `DataUpload.tsx`
- `supabase/functions/api-ingest/index.ts` — authenticated JSON push API, separate persistence path (skips `raw_records`)

### Duplicate implementations inventory (number/date/schema-inference)

| Concern | Canonical (already unified) | Still divergent |
|---|---|---|
| Number parsing (client) | `parseMessyNumber` (`messy-data-guards.ts:78`) — every client call site (`data-upload-utils.ts`, `semantic-column-classifier.ts`, `mixed-type-analyzer.ts`, `ingestion-auto-fix.ts`, `DataUpload.tsx` as of the P0 fix) already routes through it, confirmed by grep | `supabase/functions/transform-metrics/index.ts:9-15` (`cleanNumeric`, same bug pattern as the one just fixed) and `supabase/functions/_shared/ingest-pipeline.ts:298-303` (`pickNumber`, minimal) — both Deno, can't `import` a `src/` module directly |
| Number parsing (dead) | — | `parseEuropeanNumber` (`messy-data-guards.ts:66-76`), called only from `certification.test.ts` — leave in place, do not delete in this phase (out of scope; note in report) |
| Date parsing (client) | `parseMessyDate` (`messy-data-guards.ts:122-184`) — same unification story as numbers | `supabase/functions/transform-metrics/index.ts:17-27` (`normalizeDate`, minimal) and `ingest-pipeline.ts:305-315` (`pickDate`, falls to US-convention `new Date()`) |
| Schema/base-role inference | `inferSchema` → `ColumnTarget` (7 roles, collapses physical/structural/semantic into one) | New canonical layer must separate these three (this phase); `inferSchema` itself is **not modified** — a new, additive function is built alongside it |
| Semantic classification | `classifySemanticColumn` → `BusinessRole`/`SemanticColumnType` | Feeds the new canonical `SemanticMapping` via a compat adapter; classifier itself unmodified |

### Production path, file selection → database write (unchanged in this phase)

`DataUpload.tsx` file input → `parseCSVText`/`parseWorkbookFile` → `inferSchema` → `classifyDataset` → `computeDiagnostics` → `buildIngestionIntelligence` (best-effort, wrapped in try/catch) → user reviews mapping in `MappingIntelligencePanel` → `handleImport()` writes `datasets`, `dataset_versions` (with `toIngestionMetadataSnapshot`), `schema_evolution_log`, `data_lineage`, `pipeline_runs`, `raw_records`, `metrics`.

**This phase does not rewire that path.** The canonical contracts and compatibility adapters are built and proven correct against the real functions above, but `DataUpload.tsx` keeps calling the existing functions directly, exactly as the phase brief requires ("the current UI must continue working during Phase 1"). The only production code touched: the two Deno number/date call sites (§ above — in scope per "unify number/date parsing at the boundary"), which is a continuation of the already-approved P0 fix pattern, not a new behavioral risk class.

## 1. Files to create

```
src/lib/ingestion-contracts/
  ids.ts                        # branded ID types + Zod schemas (OrgId, WorkspaceId, ProjectId, DatasetId, SourceId, IngestionRunId)
  source-identity.ts            # SourceIdentity contract + Zod
  parsed-tabular.ts             # ParsedTabularData, ParsedCell, ParsingEvidence contracts + Zod
  sampling.ts                   # SamplingStrategy contract + reusable, reproducible sampling utility
  field-profile.ts              # FieldProfile contract + Zod (uses SamplingStrategy)
  inference.ts                  # PhysicalType, StructuralRole, SemanticMapping — three separate layers + Zod
  evidence.ts                   # EvidenceRecord contract + Zod
  errors.ts                     # ProcessingError contract + Zod, structured-error helper
  infer-structural-roles.ts     # NEW, additive: derives StructuralRoleProposal[] directly from ParsedTabularData + FieldProfile[], preserving multiple date columns
  index.ts                      # barrel export
  compat/
    from-legacy-schema.ts       # DetectedSchema[] -> PhysicalTypeProposal[] + StructuralRoleProposal[], recovers demoted secondary dates via the "single_date_rule:demoted_to_segment" rulesApplied tag
    from-semantic-classification.ts  # SemanticColumnProfile[] -> SemanticMapping[]
    from-diagnostics.ts         # DatasetDiagnostics -> EvidenceRecord[]
    from-parsed-csv.ts          # parseCSVText/parseWorkbookFile output -> ParsedTabularData

supabase/functions/_shared/messy-data-guards.ts   # Deno-runnable port of parseMessyNumber/parseMessyDate (verbatim logic, dual-runtime-importable so a parity test can import the SAME file from Vitest)

docs/implementation/phase-1-canonical-contracts-plan.md     # this file
docs/implementation/phase-1-canonical-contracts-report.md   # written at the end

src/test/ingestion-contracts-schemas.test.ts
src/test/ingestion-contracts-compat-adapters.test.ts
src/test/ingestion-contracts-sampling.test.ts
src/test/ingestion-contracts-structural-roles.test.ts
src/test/number-parser-fixtures.test.ts
src/test/date-parser-fixtures.test.ts
src/test/server-number-date-parser-migration.test.ts
```

## 2. Files to modify

- `supabase/functions/transform-metrics/index.ts` — replace the broken inline `cleanNumeric`/minimal `normalizeDate` with imports from `_shared/messy-data-guards.ts`. This is a **correctness fix**, not a silent behavior change: it closes the same EU-number-corruption bug class already fixed and approved in `DataUpload.tsx`. Documented explicitly in the final report as an intentional, in-scope database-write-path change.
- `supabase/functions/_shared/ingest-pipeline.ts` — replace `pickNumber`/`pickDate` with the same shared module. This function is confirmed by the audit to have **zero frontend callers** (dormant), so this is a zero-production-risk correctness/consistency fix.

## 3. Files explicitly left untouched in this phase

- `src/pages/DataUpload.tsx` — not rewired to the new contracts (only the already-shipped P0 numeric fix applies here)
- `inferSchema`, `classifySemanticColumn`, `computeDiagnostics`, `buildIngestionIntelligence` — unmodified; the new contracts wrap their output, they don't replace their logic
- `src/workers/ingestion.worker.ts` — the ≥1MB divergent-parsing bug found in the audit is a separate, tracked issue, not in scope for "canonical contracts"
- `supabase/functions/ingest-csv-pipeline/index.ts`, `_shared/csv-parser.ts` — dormant, unreachable; not migrated to the new contracts in this phase (would be Phase 3 territory: "relational and nested data" / pipeline unification)
- `parseEuropeanNumber` — left as dead code; flagged, not deleted (deletion is a cleanup decision, not a contracts decision)
- No new database tables, no RLS changes, no migrations. If Phase 1 work reveals persistence is genuinely required, this plan stops and asks before writing one — none was required.

## 4. Zod-first design decision

TypeScript types are derived via `z.infer<typeof Schema>` from the Zod schema, not hand-written separately, to eliminate type/schema drift by construction. Every contract module exports: the Zod schema, the inferred type, and (where useful) a `parseX`/`safeParseX` helper that returns a discriminated `{ ok: true, value } | { ok: false, error: ProcessingError }` result rather than throwing, per the "malformed adapter output must produce a structured error... not partially continue" requirement.

## 5. Evidence-score labelling

Per instruction, no contract calls these values "calibrated confidence" or "probability." The field is named `evidenceScore` (0-100) everywhere in the new contracts, with a doc-comment on every schema stating it is a rule-strength heuristic, not a calibrated statistical probability — directly mirroring the audit's §4.5 finding and the phase brief's explicit prohibition.

## 6. Test strategy

Per instruction ("tests must import and exercise the real production functions"): every compat-adapter test calls the actual `inferSchema`/`classifySemanticColumn`/`computeDiagnostics`/`parseCSVText`/`parseWorkbookFile` from their real modules and feeds the real output into the adapter — no reimplemented logic inside the test file (the exact anti-pattern the audit flagged in `enterprise-data-integration.test.ts`).

## 7. Sequencing

1. `ids.ts`, `errors.ts`, `evidence.ts` (leaf contracts, no dependencies)
2. `sampling.ts` (depends on nothing else)
3. `source-identity.ts`, `parsed-tabular.ts`, `field-profile.ts`, `inference.ts` (core contracts)
4. `infer-structural-roles.ts` (new additive inference, depends on the above)
5. `compat/*.ts` (depends on all of the above + the existing legacy modules)
6. `_shared/messy-data-guards.ts` (Deno port) + migrate the two server call sites
7. Tests for everything above
8. Full suite + build + lint, then the final report

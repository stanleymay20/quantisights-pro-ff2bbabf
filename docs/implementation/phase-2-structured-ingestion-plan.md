# Phase 2: Production Structured-Ingestion Integration — Plan

Authoritative inputs: `docs/audits/enterprise-data-platform-code-audit.md`, `docs/implementation/phase-1-canonical-contracts-plan.md`, `docs/implementation/phase-1-canonical-contracts-report.md`, `src/lib/ingestion-contracts/`.

**Phase gate:** this document and `docs/architecture/phase-2-ingestion-persistence-schema.md` are the full migration design. No migration is written or applied as part of producing these two documents. Implementation (integration code, the actual `.sql` migration file, RLS policies, tests) begins only after explicit approval of the schema in the companion document.

## 1. Production path, re-traced with exact references

```
file selection            src/pages/DataUpload.tsx:1048 (<input accept=".csv,.xlsx,.xls,.xlsm,.ods">)
  ↓
parsing                    parseCSVText (data-upload-utils.ts:208) | parseWorkbookFile (workbook-parser.ts:113)
  ↓                        [size/row-count branch: DataUpload.tsx:124-133, useChunkedIngestion.ts for ≥1MB]
field profiling            (informal today) inferSchema's inline sample-rate computation, data-upload-utils.ts:255-505
  ↓
schema inference            inferSchema -> DetectedSchema[] (ColumnTarget, 7 roles) -- data-upload-utils.ts:255
  ↓
semantic classification     classifySemanticSchema -> SemanticColumnProfile[] -- semantic-column-classifier.ts:238
  ↓
diagnostics                 computeDiagnostics -> DatasetDiagnostics -- data-upload-utils.ts:737
  ↓
ingestion intelligence      buildIngestionIntelligence (best-effort, try/catch) -- ingestion-intelligence.ts:21
  ↓
user mapping review         MappingIntelligencePanel.tsx (renders DetectedSchema + semantic + relationships)
  ↓
validation                  validateData -- data-upload-utils.ts:680 (still calls the unfixed Math.min(...)/Math.max(...) spread version, per audit §3.7)
  ↓
import                      handleImport() -- DataUpload.tsx:436-979
  ↓
Supabase writes             datasets (insert) -> dataset_versions (insert, metadata = toIngestionMetadataSnapshot) ->
                             schema_evolution_log -> data_lineage -> pipeline_runs (insert, then updated at 671/823/933-949) ->
                             raw_records (batched 500) -> metrics (batched 500, upsert) -> raw_records (update transform_status) ->
                             datasets (update status=completed)
  ↓
dataset activation          datasets.status = 'completed', datasets.current_version bumped
  ↓
downstream analytics        Dashboard/DecisionLedger/Reports/etc. query metrics/metric_aggregates directly; none of them read dataset_versions.metadata or any canonical-contract output
```

### Every production path capable of importing structured data

| Path | Entry point | Classification | Basis |
|---|---|---|---|
| Sync CSV/workbook upload | `DataUpload.tsx` + `parseCSVText`/`parseWorkbookFile` | **Canonical (production)** | The only user-reachable dataset-upload UI; everything downstream (Dashboard, Decision Ledger, Reports) depends on data that arrived through this path |
| Web Worker chunked CSV (≥1MB) | `src/workers/ingestion.worker.ts` + `useChunkedIngestion.ts` | **Legacy but reachable — diverges from canonical** | Same UI, same `handleImport()` destination, but skips header dedup/cell normalization the sync path applies (audit §3.1). Phase 2 item 7 requires closing this gap, not routing around it. |
| Phase 1 canonical contracts | `src/lib/ingestion-contracts/**` | **Compatibility layer, not yet wired to production** | Proven correct against real functions (Phase 1 report), but `DataUpload.tsx` does not call any of it yet. Phase 2's core job is to change this row's classification to "canonical." |
| `transform-metrics` Edge Function | `supabase/functions/transform-metrics/index.ts` | **Legacy but reachable — server-side re-transform** | Re-transforms already-ingested `raw_records`. Its number/date parsing was unified onto the canonical parser in Phase 1; it does not yet produce field profiles, mapping proposals, or evidence, and is not the primary import path. |
| `ingest-csv-pipeline` + `_shared/csv-parser.ts` | `supabase/functions/ingest-csv-pipeline/index.ts` | **Dormant** | Confirmed zero frontend callers in the Phase 1 audit and re-confirmed here (`grep -rn "ingest-csv-pipeline" src/` still returns no `supabase.functions.invoke` call site). Requires a pre-provisioned `data_connectors` row; structurally unreachable from the ad-hoc upload flow. |
| `api-ingest` | `supabase/functions/api-ingest/index.ts` | **Legacy but reachable — separate, narrower path** | Authenticated JSON push API for programmatic dataset writes. Skips `raw_records` entirely (no raw/clean separation). Out of scope for Phase 2's UI-integration work, but flagged: it writes to the same `datasets`/`metrics` tables Phase 2's new persistence model touches, so the new tables must not assume every dataset was created via `DataUpload.tsx`. |
| Connector pulls (Salesforce/SAP/Dynamics/NetSuite/Snowflake/BigQuery/etc.) | `supabase/functions/connector-*-pull/index.ts`, `db-connector/index.ts` | **Duplicate structured-ingestion surface, own persistence model** | Real, working integrations (Phase 1 audit §6), but they write through `connector_sync_runs`/`connector_lineage_events`/`canonical_entities`, a wholly separate persistence model from `datasets`/`dataset_versions`/`raw_records`/`metrics`. Explicitly out of scope for Phase 2 unification (mission item 8 targets "CSV and tabular parsers," not the connector subsystem) — noted here so the new schema doesn't collide with connector table names, but no connector code changes in this phase. |
| `FreeAnalysis.tsx` | `src/pages/FreeAnalysis.tsx` | **Unsafe to treat as a dataset-ingestion path** | Sends up to 50 rows of parsed CSV as prose to an AI summarization endpoint; never writes to `datasets`/`metrics`/`raw_records` at all. Not a structured-ingestion path in the sense this phase means — excluded from unification scope, noted only so it isn't mistakenly targeted. |

Item 8's requirement to "not leave multiple reachable paths that interpret numbers or dates differently" is **already satisfied for number/date parsing** as of Phase 1 (every reachable path — sync, worker, `transform-metrics` — calls `parseMessyNumber`/`parseMessyDate` or the parity-tested Deno twin), **except the Web Worker path's header/cell-normalization gap**, which Phase 2 item 7 closes.

## 2. What Phase 2 actually wires up

Per the mission's item 4 ("additive migration strategy... do not replace the existing user mapping controls until the canonical output is available and verified"), the integration is:

```
existing upload output (unchanged: DetectedSchema, SemanticColumnProfile[], DatasetDiagnostics)
        +
canonical metadata and proposals (new: SourceIdentity, ParsedTabularData, FieldProfile[],
  PhysicalTypeProposal[], StructuralRoleProposal[], SemanticMapping[], EvidenceRecord[])
        +
persistence of the above (new tables, see the schema document)
        +
review UI additions surfacing the canonical proposals alongside the existing mapping table
  (not replacing it)
```

Concretely, inside `handleImport()` (and the equivalent worker-path completion handler once item 7 closes the parity gap):

1. Compute a `SourceIdentity` (checksum via `checksumForParsedTable`, parser name/version, MIME/byte-size already available from the `File` object).
2. Run `fromCsvParseResult`/`fromWorkbookSheet` → `ParsedTabularData` (already have this from Phase 1; no new code needed beyond calling it).
3. Run `computeFieldProfile` per column (Phase 1 code, unused until now) → `FieldProfile[]`.
4. Run the existing `inferSchema`/`classifySemanticSchema` (**unchanged**) and pass their output through `fromLegacyDetectedSchema`/`fromLegacySemanticProfiles` (Phase 1 compat adapters) → canonical proposals, **plus** run the new, additive `inferStructuralRoles` directly off the `FieldProfile[]` for the multi-date-preserving proposals the legacy demotion rule can't produce natively.
5. Persist all of the above (new tables — see schema doc) inside the same transaction/sequence as the existing `datasets`/`dataset_versions`/`raw_records`/`metrics` writes, keyed to the same `dataset_versions` row.
6. Extend `MappingIntelligencePanel` (not replace) to additionally show, per field: evidence-labelled badges ("High evidence" / "Moderate evidence" / "Review required" / "Conflicting evidence" — never a percentage framed as a probability) sourced from the new canonical proposals, and to persist the user's accept/edit/reject/unknown decision as a `dataset_field_mapping_decisions` row.
7. The **existing** `ColumnMapping`-based import logic that actually builds `metricsToInsert` is **unchanged** in this phase — canonical persistence happens alongside it, not instead of it. This is what "do not make analytics depend exclusively on new metadata until backfill and compatibility are proven" means concretely: `metrics`/`metric_aggregates` continue being populated exactly as today.

## 3. Locale-aware parsing

`SourceIdentity` gains a `localeHint` field (see schema doc) populated from, in priority order: (a) an explicit user selection surfaced in the upload UI when the system's own ambiguous-date detector fires on 2+ sampled values in a column, (b) an organization-level default locale setting (new, minimal: a single column on `organizations` or reuse an existing settings table if one already carries locale — to be confirmed against the real settings schema before the migration is finalized), (c) `unknown`. When `unknown` and a date column contains genuinely ambiguous values (both D>12 and M>12 candidates never resolve the ambiguity — i.e. the existing `>12` heuristic in `parseMessyDate` can't disambiguate), the field's `StructuralRoleProposal`/`PhysicalTypeProposal` for that column is marked `reviewRequired: true` with an evidence record documenting the ambiguity, rather than silently picking a default. `parseMessyDate` itself is not modified to take a locale parameter in this phase (that would touch the parity-tested canonical parser); instead, the locale hint is consulted only by the new inference layer when deciding whether to flag ambiguity, keeping the parser itself unchanged and still parity-tested.

## 4. Web Worker parity (item 7)

`src/workers/ingestion.worker.ts`'s `step` handler (audit §3.1: skips `deduplicateHeaders`/`normalizeCell`) is changed to call the same normalization the sync path uses. This is a narrow, mechanical fix — not a rewrite of the chunking/streaming behavior — and is covered by a new parity test that runs the same fixture CSV through both the sync path and a simulated worker-message sequence and asserts identical headers, normalized values, and (once wired) identical `FieldProfile`/proposal output modulo documented sampling-metadata differences (representative sampling on a chunked/streamed source necessarily sees rows in chunk order, not full-file order, until all chunks arrive — the sampling strategy's `mode`/`segments` fields make this difference visible and inspectable rather than silent).

## 5. Idempotency and transactions

Supabase (Postgres via `supabase-js` from the browser) does not give the client a multi-table transaction primitive across `datasets`/`dataset_versions`/`raw_records`/`metrics`/the new tables. The existing `handleImport()` already accepts this constraint and handles partial failure via `pipeline_runs.status`/`error_message` plus per-batch error collection. Phase 2 follows the same pattern rather than introducing a new one:

- A client-generated `idempotency_key` (UUID, generated once when the user clicks "Import" and reused across automatic retries of that specific click — not across separate, intentional re-imports of the same file) is attached to the `pipeline_runs` row with a `UNIQUE(organization_id, idempotency_key)` constraint. A retried request that hits the same key gets a `23505` unique-violation from Postgres, which the client interprets as "this run already exists" and switches to polling the existing run's status instead of starting a second one.
- A run is marked `completed` only when metrics persistence **and** canonical metadata persistence both succeed. If canonical metadata persistence fails after metrics succeeded, the run is marked `completed_with_warnings` (a status the `ProcessingStatus` contract from Phase 1 already defines) rather than `completed` or `failed` — the user's data is safely imported and usable, but the richer evidence/mapping trail is incomplete and flagged as such. If metrics persistence itself fails, the run is `failed` and the partial `raw_records`/canonical rows already written are left in place (not rolled back — no transaction spans that far) but are unreachable from any `completed` dataset, and a documented cleanup path (re-run the import, which is safe because of the idempotency key) is the recovery mechanism. This exact decision is captured as a truth table and tested in Phase 2 implementation, per the mission's explicit requirement to "define whether metadata failure blocks import."

## 6. Backward compatibility / backfill (item 13)

Every dataset imported before Phase 2 ships has no rows in the new tables. `dataset_versions` gains a `canonical_metadata_status` column (`'unavailable' | 'pending' | 'available' | 'failed'`, default `'unavailable'` via a `DEFAULT` that only applies going forward — existing rows get an explicit backfill `UPDATE ... SET canonical_metadata_status = 'unavailable'` in the migration itself, not left to infer from NULL). The mapping-review UI and any future consumer must check this status and render "legacy metadata unavailable" rather than either fabricating retroactive evidence or crashing on absent rows. No lazy or automatic backfill job is built in Phase 2 (explicitly deferred to Phase 3 per the mission's scope note); this phase only ensures old datasets remain fully functional and honestly labelled as lacking the new metadata.

## 7. Scope discipline

Confirmed out of scope for this phase, per instruction: PDF/DOCX/OCR, embeddings, vector storage, general RAG, ontology marketplace, connector expansion, dashboard redesign, model training, and converting semantic classification to an external LLM. Nothing in the plan above touches any of these.

## 8. Sequence from here

1. This document + `docs/architecture/phase-2-ingestion-persistence-schema.md` (done, this commit).
2. **Stop. Report the proposed migration. Wait for explicit approval** before writing or applying any `.sql` migration file, per instruction.
3. On approval: write the migration, apply it (or hand off for the user's pipeline to apply it, consistent with how the pilot-access migration in the prior session was handled when this session's Supabase MCP connection wasn't linked to the Quantivis project).
4. RLS policies + automated cross-tenant tests.
5. `DataUpload.tsx` additive integration (steps in §2).
6. Web Worker parity fix + parity tests.
7. Mapping review UI extension.
8. Idempotency implementation + tests.
9. Schema-drift-version foundation (persistence + basic diff, no dashboard).
10. `npm run certify:structured-ingestion` release gate.
11. `docs/architecture/structured-ingestion-paths.md` + `docs/implementation/phase-2-structured-ingestion-report.md`.
12. Commit and push only after all gates pass.

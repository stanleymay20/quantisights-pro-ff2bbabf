# Phase 2: Production Structured-Ingestion Integration — Plan

Authoritative inputs: `docs/audits/enterprise-data-platform-code-audit.md`, `docs/implementation/phase-1-canonical-contracts-plan.md`, `docs/implementation/phase-1-canonical-contracts-report.md`, `src/lib/ingestion-contracts/`.

**Phase gate:** this document and `docs/architecture/phase-2-ingestion-persistence-schema.md` are the full migration design. No migration is applied to any database as part of producing these documents. A `.sql` migration file has now been written for review (`supabase/migrations/20260717120000_phase2_structured_ingestion_persistence.sql`) alongside a separate rollback artifact (`supabase/rollback/20260717120000_phase2_structured_ingestion_persistence_rollback.sql`, deliberately outside `supabase/migrations/` so it is never auto-applied) — **neither has been run against any database.** Production-code integration begins only after explicit approval to apply the migration.

**Revision note:** this document and the schema document were revised after review to close ten mandatory-control gaps (deterministic idempotency, cross-tenant FK integrity, write-authorization tiers, append-only decision versioning, complete uniqueness coverage, pipeline-run/dataset-version sequencing, PII redaction enforcement, controlled-value/JSON bounds, locale provenance, and migration validation/rollback). The schema document's "Summary of what changed" table is the authoritative changelog; this document's §3 and §5 below are updated to match.

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

Revised: locale is now tracked per-run, not just as a single `SourceIdentity` hint, per the schema document's `pipeline_runs.detected_locale`/`.selected_locale`/`.locale_source`/`.locale_ambiguous` columns. Resolution order:

1. **`selected_locale`** — an explicit, ingestion-level user override (mission's explicit requirement to "allow an ingestion-level override"). Always wins when present. `locale_source = 'user_selected'`.
2. **`detected_locale`** — inferred from the file itself: number-format shape (comma vs. period as decimal separator, both already computed by `parseMessyNumber`'s internal EU/US disambiguation), date-format shape, currency symbols, or workbook locale metadata where SheetJS exposes it. `locale_source` records exactly which signal won (`'detected_number_format' | 'detected_date_format' | 'workbook_metadata'`).
3. **`organizations.default_locale`** — a **hint only**, per instruction, never authoritative. `locale_source = 'organization_default'`. Used only when neither (1) nor (2) produced a confident detection.
4. **`unknown`** — `locale_source = 'unknown'`, `locale_ambiguous = true`.

`organizations.default_locale` is validated as a BCP-47-shaped value at the schema level (`CHECK` constraint, see schema doc) but is never treated as ground truth for a specific file — an org's default could be wrong for one particular upload (e.g. a US-based org receiving a file from a European subsidiary), which is exactly why it's ranked below file-level detection.

When a date column contains genuinely ambiguous values (the existing `>12`-based heuristic in `parseMessyDate` can't disambiguate, and no locale signal above resolved it with confidence) the field's `StructuralRoleProposal`/`PhysicalTypeProposal` is marked `reviewRequired: true` with an evidence record documenting the ambiguity and `pipeline_runs.locale_ambiguous = true` is set for the run — a genuinely ambiguous date is never silently resolved by falling back to a default locale. `parseMessyDate` itself is still not modified to take a locale parameter in this phase (it remains the parity-tested canonical parser, unchanged); the locale fields are consulted only by the new inference layer when deciding whether to flag ambiguity for review.

## 4. Web Worker parity (item 7)

`src/workers/ingestion.worker.ts`'s `step` handler (audit §3.1: skips `deduplicateHeaders`/`normalizeCell`) is changed to call the same normalization the sync path uses. This is a narrow, mechanical fix — not a rewrite of the chunking/streaming behavior — and is covered by a new parity test that runs the same fixture CSV through both the sync path and a simulated worker-message sequence and asserts identical headers, normalized values, and (once wired) identical `FieldProfile`/proposal output modulo documented sampling-metadata differences (representative sampling on a chunked/streamed source necessarily sees rows in chunk order, not full-file order, until all chunks arrive — the sampling strategy's `mode`/`segments` fields make this difference visible and inspectable rather than silent).

## 5. Idempotency and transactions (revised)

Supabase (Postgres via `supabase-js` from the browser) does not give the client a multi-table transaction primitive across `datasets`/`dataset_versions`/`raw_records`/`metrics`/the new tables. The existing `handleImport()` already accepts this constraint and handles partial failure via `pipeline_runs.status`/`error_message` plus per-batch error collection. Phase 2 follows the same pattern rather than introducing a new one, with idempotency now **deterministic by construction**, not a randomly-generated value:

- **The idempotency key is a Postgres `GENERATED ALWAYS AS ... STORED` column** on `pipeline_runs`, computed as `sha256(organization_id || client_attempt_key || source_checksum || parser_version || import_config_hash)`. Because the database computes it, not application code, there is no risk of a client bug regenerating a fresh value on retry and silently defeating dedup — the same four inputs always produce the same key, enforced by the engine, not by convention. See the schema document's `pipeline_runs` section for the full DDL and rationale.
- **`client_attempt_key`** is generated once in the browser when the user clicks "Import" and is reused verbatim across every automatic/transport retry of that specific click (e.g. `invokeWithRetry`'s internal retries). It is **not** reused across a distinct, later click — a legitimate second import attempt (even of the identical file) after the first one completed or was abandoned gets a new key, and is correctly treated as a new run, not a duplicate.
- **What legitimately produces a different key** (any one of these changes the generated hash, correctly allowing a new run rather than deduplicating against a stale one): a different `source_checksum` (different file content), a different `parser_version` (app upgraded between attempts), or a different `import_config_hash` (the user edited the column mapping or import mode before clicking import again).
- **Sequencing changed to support pre-dataset-creation dedup**: `pipeline_runs` is now created **first** (before `datasets`/`dataset_versions` exist), with `dataset_id`/`dataset_version_id` initially `NULL` and backfilled via `UPDATE` once those rows are created. This is why the schema document makes `pipeline_runs.dataset_id` nullable — the one non-purely-additive column change in the whole migration, explained in full there. A retried request's `INSERT` into `pipeline_runs` either succeeds (genuinely new attempt) or hits `23505` on `UNIQUE(organization_id, idempotency_key)` (this is a retry of an in-flight or completed attempt), in which case the client fetches and resumes/polls the existing row instead of proceeding to create anything else.
- **Manual retry vs. automatic retry, and `retry_of`**: an automatic/transport retry reuses `client_attempt_key` (same key, caught by the unique constraint, no second row). A manual retry — the user explicitly clicking "Retry" after seeing a failure, potentially after fixing something — generates a **new** `client_attempt_key` (hence a new idempotency key and a new row), with `retry_of` pointing at the prior failed run for lineage. These are deliberately different mechanisms for deliberately different situations.
- A run is marked `completed` only when metrics persistence **and** canonical metadata persistence both succeed. If canonical metadata persistence fails after metrics succeeded, the run is marked `completed_with_warnings` (a status the `ProcessingStatus` contract from Phase 1 already defines, now enforced by a `CHECK` constraint on `pipeline_runs.status`) rather than `completed` or `failed` — the user's data is safely imported and usable, but the richer evidence/mapping trail is incomplete and flagged as such via `dataset_versions.canonical_metadata_status = 'failed'`. If metrics persistence itself fails, the run is `failed` (`failure_stage` records which `ProcessingStage` it failed in) and the partial `raw_records`/canonical rows already written are left in place (not rolled back — no transaction spans that far) but are unreachable from any `completed` dataset; the documented recovery is a manual retry (new `client_attempt_key`, new run, `retry_of` pointing back), which is safe because of the idempotency key on the new attempt. This exact decision is captured as a truth table and tested in Phase 2 implementation, per the mission's explicit requirement to "define whether metadata failure blocks import."

## 5a. Write authorization tiers (new)

Reused, not reinvented: `is_org_member()` (ordinary membership) governs INSERT on the five system-generated tables (`dataset_schema_versions`, `dataset_fields`, `dataset_field_profiles`, `dataset_field_mapping_proposals`, `dataset_field_mapping_evidence`) — these are byproducts of an upload any member can already perform, so this does not raise the bar. `dataset_field_mapping_decisions` — a direct human judgment call — requires a new `can_decide_mapping()` function that additionally requires `exec_require_elevated_role()` (owner/admin, the same function already gating `external_data_sources` admin writes) whenever the field being decided on has ever been profiled with `pii_likelihood >= 0.5`. Full mechanism and rationale in the schema document's "Write authorization" section.

## 5b. PII test requirements (new — specification only, not yet implemented)

Once the redaction function exists (integration phase, not this document-and-schema phase), it must pass, at minimum:

- **True positives, masked or omitted, never raw**: `email` (`jane.doe@example.com`), `phone` (`+1 555 123 4567`), `national_id`/`tax_number`/`Steuernummer`, `beneficiary`/`applicant`/`insured_party`, and German equivalents (`Begünstigter`, `Antragsteller`, `Versicherter`).
- **False positives, NOT redacted** (header-keyword-triggered over-matching the audit already flagged for the legacy `isPotentialPiiHeader`): `product_name`, `company_name`, `campaign_name` — these contain the substring `name` but are not personal data, and the redaction function must not treat every `*_name` column as PII by header alone; the `pii_likelihood` score (not a boolean) is what the profile persists precisely so this kind of case can land at "uncertain, review required" rather than a hard binary miss in either direction.
- **DB-level backstop verified independently of the redaction function's correctness**: attempt to insert a `dataset_field_profiles` row with `pii_likelihood = 0.9` and `redaction_status = 'not_required'` directly (bypassing the application layer) and confirm Postgres rejects it via `dataset_field_profiles_pii_redaction_required` — this is a schema-level test, includable now once the migration is approved and applied to a test database, independent of any application redaction logic existing yet.

## 6. Backward compatibility / backfill (item 13)

Every dataset imported before Phase 2 ships has no rows in the new tables. `dataset_versions` gains a `canonical_metadata_status` column (`'unavailable' | 'pending' | 'available' | 'failed'`, default `'unavailable'` via a `DEFAULT` that only applies going forward — existing rows get an explicit backfill `UPDATE ... SET canonical_metadata_status = 'unavailable'` in the migration itself, not left to infer from NULL). The mapping-review UI and any future consumer must check this status and render "legacy metadata unavailable" rather than either fabricating retroactive evidence or crashing on absent rows. No lazy or automatic backfill job is built in Phase 2 (explicitly deferred to Phase 3 per the mission's scope note); this phase only ensures old datasets remain fully functional and honestly labelled as lacking the new metadata.

## 7. Scope discipline

Confirmed out of scope for this phase, per instruction: PDF/DOCX/OCR, embeddings, vector storage, general RAG, ontology marketplace, connector expansion, dashboard redesign, model training, and converting semantic classification to an external LLM. Nothing in the plan above touches any of these.

## 8. Sequence from here

1. This document + `docs/architecture/phase-2-ingestion-persistence-schema.md`, first draft (done).
2. Review identified 10 mandatory-control gaps; both documents revised to close them (done, this commit).
3. `.sql` migration file + separate rollback artifact written for review (done, this commit). **Not applied.**
4. **Stop again. Report the revised proposal and the SQL. Wait for explicit approval** before running the migration against any database, per instruction.
5. On approval: apply the migration (or hand off for the user's pipeline to apply it, consistent with how the pilot-access migration in an earlier session was handled when this session's Supabase MCP connection wasn't linked to the Quantivis project), then run the post-migration and RLS verification queries from the schema document before proceeding.
6. Automated cross-tenant RLS tests (the ones the verification queries above are manually-run versions of — Phase 2 implementation adds them as a real test suite).
7. `DataUpload.tsx` additive integration (steps in §2), including the deterministic-idempotency-key sequencing change (§5) and locale resolution (§3).
8. Web Worker parity fix + parity tests.
9. Mapping review UI extension, including the elevated-role gate for PII-flagged decisions (§5a).
10. PII redaction implementation + the test suite specified in §5b.
11. Schema-drift-version foundation (persistence + basic diff, no dashboard).
12. `npm run certify:structured-ingestion` release gate.
13. `docs/architecture/structured-ingestion-paths.md` + `docs/implementation/phase-2-structured-ingestion-report.md`.
14. Commit and push only after all gates pass.

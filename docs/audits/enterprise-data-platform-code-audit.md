# Enterprise Data Platform — Code Audit

**Scope:** the executable data-ingestion path in `stanleymay20/quantisights-pro-ff2bbabf` — file upload, parsing, schema/semantic inference, cross-sheet relationship detection, persistence, connectors, embeddings/RAG, and document processing. Read from source, migrations, and tests, not from README/UI copy/roadmap docs.

**Baseline at time of audit:** `npm run test` — 94 files, 830 tests, all passing. `npm run build` — succeeds (one pre-existing bundle-size warning, unrelated to this audit). `npm run lint` — ~720 pre-existing errors across the repo (mostly `@typescript-eslint/no-explicit-any` in Supabase Edge Functions); not attributed to this audit's scope and not re-litigated here.

**Method:** four parallel deep traces (physical parsing; schema/semantic inference; relationship detection & persistence; document/embeddings/connectors), each required to cite file:line for every claim, followed by direct verification of the two highest-severity claims against source. All file:line citations below were produced by that process; the two most consequential (the `cleanNumeric` bug and the `ColumnTarget` role set) were independently re-read and confirmed before writing this document.

---

## Executive summary

Quantivis has a real, non-trivial CSV/spreadsheet ingestion pipeline: a genuine SheetJS-based workbook parser (multi-sheet, hidden-sheet, merged-cell, header-row detection), a genuine messy-number/date normalizer with locale heuristics, a rule-based schema/semantic classifier, and a cross-sheet relationship suggester. This is not vaporware — it has real test coverage and real production callers.

It is not, however, a dependable enterprise data-mapping platform yet, for reasons independent of the "we haven't built unstructured ingestion" gap (which is real and total — see §7):

1. **A confirmed, severe data-corruption bug is live in the actual database-write path.** `cleanNumeric()` (`src/pages/DataUpload.tsx:693-699`) strips commas unconditionally before `parseFloat`, so European-formatted numbers like `"1.234,56"` (one thousand two hundred thirty-four point five six) are silently written to the `metrics` table as `1.234`. This is the exact locale the certification suite (`generateGermanLocalePack`) claims to certify — but the certification suite only calls `inferSchema`/`classifyDataset`/`computeDiagnostics`, never `handleImport`, so it never exercises the function that actually persists the value. **This is a P0.**
2. **Four independent CSV parsers and three independent number parsers** exist across the client and server, with observably different behavior on the same input (a 900 KB CSV and a 1.1 MB CSV with identical content produce different headers, because the sync path deduplicates/normalizes and the Web Worker path for files ≥1 MB does not).
3. **Confidence scores are hardcoded literals** (`confidence: 90`, `confidence: 98`, `Math.max(92, baseConfidence)`), not calibrated against any labelled evaluation set. Nothing in the codebase measures whether "92% confidence" corresponds to 92% empirical accuracy.
4. **The semantic/business-meaning layer is English-only keyword regex.** German business vocabulary exists in the codebase (`src/lib/ontology/kpi-ontology.ts`) but is wired into a separate post-upload "copilot brief" feature, not into the ingestion classifier being audited.
5. **Most of the computed intelligence never reaches the database.** Per-column confidence, individual cross-sheet relationship proposals with evidence, diagnostics (duplicate rows, missing %, health score), and the full mixed-type/header-recovery detail are shown to the user once and then discarded — only a reduced aggregate-count summary survives into `dataset_versions.metadata`. There is no `mapping_proposals`, `source_fields`, or `field_profiles` table in any of the 187 migrations.
6. **Unstructured-document ingestion does not exist**, and one visible UI affordance actively lies about it: the Copilot chat's file-attach control advertises "PDF, TXT" and says "content will be used as context," but no code path ever reads the file — only the filename is sent.
7. **Sampling is capped at 100–1000 rows** across every inference stage, with no representative (beginning/middle/end) or full-column strategy, and no per-mapping record of whether the classification came from a full scan or a sample.

None of this means the feature is fake — the CSV/workbook path is real, tested, and used in production. It means the platform cannot currently support a claim of "reliably maps arbitrary structured data," and definitely cannot support any claim about unstructured data.

---

## 1. Capability classification matrix

| Capability | Verdict | Primary evidence |
|---|---|---|
| CSV parsing (sync, <1MB) | Production-capable | `src/lib/data-upload-utils.ts:208-222` (`parseCSVText`), tested |
| CSV parsing (worker, ≥1MB) | Partially implemented — diverges from sync path | `src/workers/ingestion.worker.ts:86-124`, skips header dedup/cell normalization |
| CSV parsing (server, `ingest-csv-pipeline`) | Partially implemented — unreachable from the UI | `supabase/functions/_shared/csv-parser.ts:14-91`, zero frontend callers |
| Workbook parsing (xlsx/xls/xlsm/ods) | Production-capable | `src/lib/workbook-parser.ts`, best-tested subsystem in the pipeline |
| Header-row auto-detection | Production-capable (workbook only) | `workbook-parser.ts:67-80`, scans first 10 rows; **CSV path has no equivalent** |
| Merged-cell handling | Production-capable | `workbook-parser.ts:93-111`, tested |
| Formula-cell handling | Partially implemented, undertested | Cached values only (`cellFormula: false`), documented but no dedicated test |
| Excel serial date conversion | Production-capable (two parallel implementations) | `workbook-parser.ts` (`cellDates: true`) + `messy-data-guards.ts:116-120` (string-serial path) |
| Locale/number parsing (inference path) | Production-capable | `messy-data-guards.ts:78-109` (`parseMessyNumber`), tested against EU/US formats |
| **Locale/number parsing (DB-write path)** | **Broken for EU locale — P0** | `src/pages/DataUpload.tsx:693-699` (`cleanNumeric`) — see §2 |
| Locale/number parsing (server connector path) | Heuristic only / minimal | `supabase/functions/_shared/ingest-pipeline.ts:298-303` (`pickNumber`), no currency/EU handling |
| Date parsing (ambiguous D/M/Y) | Heuristic only, not true locale-aware | `messy-data-guards.ts:162-171` — always resolves the same way regardless of source locale |
| Date parsing (server connector path) | Diverges from client | `ingest-pipeline.ts:305-315` (`pickDate`), falls to `new Date(s)` (US convention) |
| Identifier protection | Production-capable | Two independent layers, `data-upload-utils.ts:287-304` + `semantic-column-classifier.ts:107-129` |
| Boolean/status field handling | Production-capable (English only) | `data-upload-utils.ts:306-320`, `messy-data-guards.ts:15-19` — no German ja/nein |
| PII detection | Heuristic only, header-keyword + regex, no NER | `messy-data-guards.ts:52-64`, two non-identical keyword lists across two files |
| Base column-role mapping | Production-capable, narrow (7 fixed roles) | `data-upload-utils.ts:34-41` (`ColumnTarget`), confirmed directly |
| Semantic/business classification | Heuristic only, English-only keyword regex | `semantic-column-classifier.ts:60-64` |
| Confidence scoring | Heuristic only, hardcoded literals, uncalibrated | See §4 |
| Multiple date-column handling | Production-capable, but demotes rather than preserves | `data-upload-utils.ts:489-502` — force-demotes all but the highest-confidence date to `segment` |
| Cross-sheet relationship detection | Heuristic only (name/overlap suggestion, no FK/cardinality validation) | `src/lib/cross-sheet-discovery.ts:31-117` |
| Mapping-evidence persistence | Partially implemented — most evidence discarded | `src/lib/ingestion-metadata.ts:54-111` vs. full result; see §5 |
| Raw/clean data persistence (browser path) | Production-capable | `DataUpload.tsx:436-979`, writes `datasets`/`raw_records`/`metrics`/`schema_evolution_log`/`data_lineage`/`pipeline_runs` |
| Large-file / streaming ingestion | Partially implemented — UI-thread relief only, not memory-bounded | `src/hooks/useChunkedIngestion.ts:94` reads the whole file into memory first |
| Server-side large-file escape hatch | Placeholder — unreachable | `supabase/functions/ingest-csv-pipeline/index.ts` has zero frontend callers |
| JSON/XML/Parquet file upload | Missing (no user-facing path) | `DataUpload.tsx:216-225` rejects anything not CSV/workbook; JSON only via authenticated `api-ingest` push API |
| PDF/DOCX/TXT/HTML/email ingestion | Missing, and misrepresented in one UI surface | See §7 |
| Structured connectors (Salesforce/SAP/Dynamics/NetSuite/Snowflake/BigQuery/Redshift/Power BI/Stripe/GA4/Xero/QuickBooks) | Production-capable | Real OAuth/API calls, see §6 |
| Structured connectors (MySQL/SQL Server) | Placeholder | `supabase/functions/db-connector/index.ts:1073,1135` — explicit "requires enterprise driver activation" |
| Embeddings | Heuristic (hash-based), not neural | `supabase/functions/_shared/deterministic-embeddings.ts:143-208` |
| RAG retrieval | Production-capable over internal records only, no document grounding | `supabase/functions/_shared/rag-context.ts:118-163` |
| Document-grounded citations | Missing | No document is ever embedded, so no page/section citation format exists |
| Test coverage — workbook/CSV parsing | Real | `src/lib/workbook-parser.test.ts` |
| Test coverage — semantic classification | Real, but clean/synthetic English-only fixtures | `src/lib/semantic-column-classifier.test.ts` |
| Test coverage — "enterprise data integration" | **Misleading — tests reimplemented logic, not production code** | `src/test/enterprise-data-integration.test.ts` — see §8 |
| Test coverage — embeddings backfill | Real integration test, not wired into CI | `supabase/functions/embed-decisions/backfill_test.ts` — Deno test, not in `npm run test` |

---

## 2. P0: `cleanNumeric()` silently corrupts European-formatted numbers on import

**File:** `src/pages/DataUpload.tsx:693-699`

```ts
const cleanNumeric = (raw: string | undefined): number => {
  if (!raw) return NaN;
  const cleaned = raw
    .replace(/[\s$€£¥₹,]/g, "")
    .replace(/\(([^)]+)\)/, "-$1");
  return parseFloat(cleaned);
};
```

Called at `DataUpload.tsx:758` and `:776`, inside `handleImport()` — the function that builds `metricsToInsert` and writes to the `metrics` table (`DataUpload.tsx:701-813`). This is the **only** numeric-cleaning function on the actual write path.

**Failure mode:** the regex strips commas unconditionally, with no EU-decimal-comma awareness. For input `"1.234,56"` (EU formatting: one thousand two hundred thirty-four point five six):
1. Comma stripped → `"1.234.56"`
2. `parseFloat("1.234.56")` stops at the second `.` → returns `1.234`

The correct value is `1234.56`. The written value is `1.234` — roughly a **1000x silent understatement**, with no error, no warning, no validation failure. `Math.abs(val) > 1e12` (line 759/777) does not catch this, since the corrupted value is smaller, not larger.

**Why the existing test suite doesn't catch it:** `parseMessyNumber()` (`src/lib/messy-data-guards.ts:78-109`) correctly handles this exact case and is well-tested (`data-upload-utils.test.ts:112-123`, `certification.test.ts:181-182`). But `parseMessyNumber` is used for **inference, validation, and preview** — not for the actual insert. The certification suite (`generateGermanLocalePack`, `certification.test.ts:172-182`) only calls `inferSchema`/`classifyDataset`/`computeDiagnostics` (imports at `certification.test.ts:16-22`) — it never calls `handleImport`, so the release gate that's supposed to certify German-locale ingestion never exercises the function that actually writes the number to Postgres.

There is a second, unused, *correct* implementation sitting in the same file family: `parseEuropeanNumber()` (`messy-data-guards.ts:66-76`) is dead code in production — its only caller is `certification.test.ts:30,181`.

**Recommended fix (out of scope for this audit doc, tracked as immediate follow-up):** replace the body of `cleanNumeric` with a call to the existing, tested `parseMessyNumber`, and add a regression test that builds a real `metricsToInsert` row from EU-formatted input and asserts the persisted value.

---

## 3. Physical parsing layer

### 3.1 Four independent CSV parsers

| # | Path | File:line | Header dedup? | Cell normalization? | Errors surfaced? |
|---|---|---|---|---|---|
| 1 | Sync, <1MB (DataUpload) | `data-upload-utils.ts:208-222` (`parseCSVText`) | Yes (`deduplicateHeaders`) | Yes (`normalizeCell`) | No — `result.errors` never read |
| 2 | Worker, ≥1MB (DataUpload) | `src/workers/ingestion.worker.ts:86-124` | **No** | **No** | No — `results.errors` never read |
| 3 | Server (`ingest-csv-pipeline`, unreachable from UI) | `supabase/functions/_shared/csv-parser.ts:14-91` | **No — silently overwrites** duplicate-named columns | No | N/A |
| 4 | Free Analysis (unrelated feature) | `src/pages/FreeAnalysis.tsx:36-44` | N/A (header:true) | No | N/A |

Path 1 vs. Path 2 is a real, live bug class: **the exact same CSV content can be parsed differently by the same UI flow**, purely based on whether the file crosses the 1 MB threshold (`DataUpload.tsx` size branching). A user re-saving/re-exporting the same dataset at a slightly different size could see different column headers or duplicate-header collisions appear/disappear.

### 3.2 Workbook parsing — the strongest subsystem

`src/lib/workbook-parser.ts`, SheetJS (`xlsx@0.20.3`, vendored). Multi-sheet, hidden-sheet detection, merged-cell expansion, header-row auto-detection (scans first 10 rows, scored heuristic), Excel-serial-date conversion — all production-capable and covered by `workbook-parser.test.ts` with real XLSX buffers. Formula cells return cached last-saved values only (`cellFormula: false`, documented, not a bug, but undertested).

### 3.3 Three independent number-cleaning implementations

1. `parseMessyNumber()` (`messy-data-guards.ts:78-109`) — correct, used for inference/validation/preview only.
2. `parseEuropeanNumber()` (`messy-data-guards.ts:66-76`) — dead code, called only from `certification.test.ts`.
3. `cleanNumeric()` (`DataUpload.tsx:693-699`) — **the one used for the actual DB write**, broken for EU locale (§2).
4. (Server) `pickNumber()` (`supabase/functions/_shared/ingest-pipeline.ts:298-303`) — minimal, no currency/EU/percentage handling, a fourth distinct behavior for a conceptually single pipeline.

### 3.4 Date-ambiguity resolution diverges between client and server

Client: `messy-data-guards.ts:162-171` uses a "whichever component is unambiguously >12 is the day" heuristic — for genuinely ambiguous input like `01/02/03` it always resolves the same way regardless of the file's actual source locale (no locale selector exists in the UI). Server (`ingest-pipeline.ts:305-315`, `pickDate`) falls straight to `new Date(s)`, i.e. US `MM/DD/YYYY` convention, with no EU heuristic at all. **The same date string can resolve to a different calendar date** depending on whether it went through the browser upload flow or a server connector.

### 3.5 File-type validation is filename-suffix only

`isSupportedDataFile()` (`src/lib/workbook-parser.ts:35-45`) checks the filename suffix only — no MIME-type or magic-byte sniffing, and no server-side Storage bucket MIME allowlist was found in any migration. A malicious file renamed to `.csv` passes client validation.

### 3.6 Sampling limits (no representative/full-scan strategy anywhere)

| Constant | File:line | Scope |
|---|---|---|
| 100 rows | `data-upload-utils.ts:256` | Base type inference (`inferSchema`) |
| 200 rows | `data-upload-utils.ts:819` | PII detection (`computeDiagnostics`) |
| 100 rows (default) | `semantic-column-classifier.ts:243` | Semantic classification |
| 10 rows | `workbook-parser.ts:68` | Header-row auto-detection scan |
| 1,000 rows | `cross-sheet-discovery.ts:31` | Cross-sheet relationship value overlap |

All are `rows.slice(0, N)` — beginning-of-file only, no middle/end/random sampling, no adaptive sampling, and no field anywhere records whether a given mapping came from a full scan or a partial sample.

### 3.7 Known stack-overflow fix exists but isn't wired in

`src/lib/data-upload-utils-safe.ts` is a rewrite of `validateData()` that avoids `Math.min(...values)`/`Math.max(...values)` spread (which the file's own comment says overflows the JS argument stack on large datasets). Its only consumer is its own test (`data-upload-utils-stack-safe.test.ts`). Production `DataUpload.tsx:680` still calls the original, unfixed `validateData` from `data-upload-utils.ts`.

### 3.8 Large-file / streaming handling is not memory-bounded

`useChunkedIngestion.ts:94` calls `await file.text()` — **the entire file is read into a JS string before any chunking begins.** The subsequent worker chunking (`ingestion.worker.ts`, `DEFAULT_CHUNK_ROWS = 5,000`) is off-main-thread progress reporting, not streaming I/O; peak memory still holds the whole file plus the whole parsed row array. Files over 50,000 rows (`DataUpload.tsx:124-133`, inline literal, not the same declaration as `LARGE_DATASET_THRESHOLD` in `chunked-processor.ts:8` — the two are not connected by an import) show a toast telling the user to use Data Connectors manually; nothing routes automatically to the server-side `ingest-csv-pipeline`, which (per §5) has zero frontend callers regardless.

---

## 4. Schema inference and semantic classification

### 4.1 Base column-role mapper — narrow by design

`inferSchema()`, `src/lib/data-upload-utils.ts:255-505`. Output type, confirmed directly:

```ts
export type ColumnTarget =
  | "date" | "value" | "region" | "region_code"
  | "segment" | "metric_type" | "skip";
```

Every column collapses into one of 7 roles. This is a rule cascade (identifier guard → boolean guard → period → text dimension → date header → geo/country → region code → metric keyword → numeric-stats fallback → categorical fallback → skip), each branch returning a hardcoded confidence value.

### 4.2 Semantic classifier — English-only keyword regex, not a model

`classifySemanticColumn()`, `src/lib/semantic-column-classifier.ts:80-236`. Representative:

```ts
const FINANCIAL_KPI = /(revenue|cost|profit|margin|cash|payable|receivable|budget|expense|income|ebitda|mrr|arr)/i;
```

No LLM or embedding call anywhere in this layer (confirmed: no `openai`/`anthropic`/`langchain` dependency touches this file). The codebase's own certification fixture comment admits the gap: `src/lib/certification/fixtures/expected-classifications.ts:17-18` — *"German locale pack uses German headers (umsatz/kosten/abteilung). Classifier is keyword-based EN..."* — and the German-locale certification test only asserts the classifier doesn't **mis**classify German columns, not that it classifies them correctly.

German business vocabulary does exist in the codebase (`src/lib/ontology/kpi-ontology.ts:37-108` — `umsatz`, `kosten`, `bruttomarge`, `fluktuation`, etc.) but is consumed only by `src/lib/semantic/data-copilot.ts` and `executive-routing.ts` — a separate post-upload "copilot brief" feature reached via `PostUploadSummary.tsx`, not by `inferSchema` or `classifySemanticColumn`. **The multilingual vocabulary and the ingestion classifier are two disconnected systems.**

### 4.3 Identifier and boolean protection — genuinely production-capable

Two independent layers each protect against misclassifying IDs as metrics (`data-upload-utils.ts:287-304`, `semantic-column-classifier.ts:107-129`) and booleans as numeric KPIs (`data-upload-utils.ts:306-320`, `semantic-column-classifier.ts:131-144`). Both are real, tested, and correctly designed. Boolean detection is English-only (`true|false|yes|no|y|n`) — no German `ja/nein`.

### 4.4 PII detection — header-keyword regex, no NER, two non-identical keyword lists

`isPotentialPiiHeader()` (`messy-data-guards.ts:52-55`) and a **separate, slightly different** `PII_HEADER` regex in `semantic-column-classifier.ts:55` — two independently-maintained keyword lists for the same concept in two files. Value-level corroboration is a plain regex for email/phone shape, over a 200-row sample. No named-entity or contextual model.

### 4.5 Confidence scores — hardcoded literals

```ts
semantic-column-classifier.ts:100:   confidence: 90,                              // PII
semantic-column-classifier.ts:122:   confidence: Math.max(92, baseConfidence),    // identifier
data-upload-utils.ts:364:            confidence: lower === "date" ? 98 : 90,      // date header
data-upload-utils.ts:418:            confidence: Math.round(78 + numericRate*20), // metric value
schema-evolution.ts:137,150,198,209: confidence: 0.95 / 0.85                      // drift detection
```

No training data, accuracy feedback loop, or measured-outcome calibration feeds any of these numbers. `Math.round(78 + numericRate*20)` is the only example with any input-derived scaling, and it's still a hand-picked linear formula, not a fitted one. There is no code anywhere that measures "of the mappings assigned 90% confidence, what fraction were actually correct."

### 4.6 Multiple date columns are demoted, not preserved

`data-upload-utils.ts:489-502` — when more than one column looks like a date, the highest-confidence one is kept as `date`; every other date-like column is force-relabeled to `segment` with the reason string `"Secondary date-like column kept as segment for grouping"`. There is no `order_date`/`ship_date`/`invoice_date`-style multi-role retention anywhere in the schema.

### 4.7 Output type set has no unit/physical-quantity distinctions

Two type systems, neither distinguishes quantity vs. currency vs. percentage vs. unit-price vs. count vs. duration vs. lat/long vs. ordinal category:
- `ColumnTarget` (7 structural roles, §4.1)
- `SemanticColumnType` (`semantic-column-classifier.ts:4-16`): `date | metric | currency | percentage | ratio | identifier | boolean | location | pii | categorical | text | unknown` — 12 values, still no unit/duration/lat-long/ordinal distinction, and `currency`/`percentage`/`ratio` are assigned by header regex applied post-hoc to columns already flagged numeric, not derived from value inspection.

### 4.8 Test coverage is real but synthetic-clean

`data-upload-utils.test.ts` and `semantic-column-classifier.test.ts` use clean, English, well-formed headers (`revenue_eur`, `gross_margin_pct`, `employee_id`). The certification suite's "German locale" pack tests locale-aware **number/date parsing** only (`1.234,56`, `01.01.2024`) with English column headers — it does not test German column-**header** semantic classification, and its own fixture comments say so. No test fixture anywhere uses realistic messy/multilingual column headers.

---

## 5. Cross-sheet relationship detection and persistence

### 5.1 Relationship detection is a name/overlap heuristic, not schema reconstruction

`discoverCrossSheetRelationships()`, `src/lib/cross-sheet-discovery.ts:62-117`. Samples up to 1,000 values per candidate column (`maxRows = 1000`, line 31 — first 1,000 rows only, not the full column). Requires either an exact normalized-name match or both columns matching a key-suffix pattern (`_id`/`_no`/`_number`/`uuid`/`sku`) with similar names (lines 71-79) — **no fuzzy/semantic matching**, so `customer_number` ↔ `buyer_reference` would never be proposed even with 100% value overlap. Confidence is `Math.min(0.95, 0.55 + overlap*0.4 + (keyNameMatch?0.1:0))` — another hand-picked formula. **Nowhere does this validate uniqueness on the "one" side, referential integrity, or 1:1 vs. 1:many cardinality** — `inferKind` labels a relationship as `primary_foreign_key`/`shared_business_key`/`possible_lookup` purely from name shape, not a validated constraint check.

A second, unrelated "relationship" system exists — `src/lib/semantic/entity-resolution.ts` + `relationship-discovery.ts` — which classifies columns into canonical entity types and draws edges from a **static template graph** (`Customer → Order`), never inspecting actual column names or values across sheets. It feeds only the post-upload "Data Copilot" brief (`PostUploadSummary.tsx`), a fully separate code path from the pre-import mapping screen. Two non-integrated systems both plausibly labeled "relationship discovery" is a real audit risk for future maintainers.

### 5.2 Most computed intelligence never reaches the database

`toIngestionMetadataSnapshot()` (`src/lib/ingestion-metadata.ts:54-111`) is the **only** function whose output reaches Postgres (into `dataset_versions.metadata`, a jsonb column). Comparing it to the full `IngestionIntelligenceResult`:

**Persisted:** locale fields, repair-report summary counts/strings, data-dictionary counts, semantic-schema column-name lists, column-similarity groups, cross-sheet relationship **counts** (not the individual proposals).

**Discarded — computed, shown to the user once, then gone:**
- `diagnostics` (missing-value %, duplicate/near-duplicate row counts, PII column names, health score, outlier count) — none of these fields exist in `IngestionMetadataSnapshot` at all.
- The full per-column mixed-type analysis and header-recovery detail.
- The full per-field data-dictionary entries.
- **The individual cross-sheet relationship proposals** (from-sheet, to-sheet, from-column, to-column, kind, confidence, basis) that `MappingIntelligencePanel.tsx:622` renders in full to the user — only the aggregate count survives.
- The entire post-upload "Data Copilot brief" (`PostUploadSummary.tsx`, re-computed from a fresh 500-row sample) — this component's own header comment claims *"Snapshot recorded in dataset registry, schema log, lineage, and audit trail"*, which is **misleading**: none of what this specific component computes is recorded; only the earlier, separate `handleImport`-time snapshot is.

There is no `mapping_proposals`, `source_fields`, or `field_profiles` table anywhere in the 187 migrations — confirmed absent, so there is no schema location for this evidence even if the application wanted to keep it.

### 5.3 Persistence — production-capable for the "happy path," but no per-mapping evidence

`handleImport()` (`DataUpload.tsx:436-979`) writes to `datasets`, `dataset_versions`, `schema_evolution_log`, `data_lineage`, `pipeline_runs`, `raw_records`, and `metrics`, all directly from the browser via `supabase-js`. `raw_records` stores rows keyed by column **index** (`rowData[String(idx)]`), not header name — traceability back to the header requires cross-referencing `datasets.column_mapping` at read time. `datasets.column_mapping` itself stores only `header → target type`, with **no confidence score per column**.

### 5.4 Three parallel, non-unified ingestion pipelines

1. **Browser client pipeline** (`DataUpload.tsx`) — the one actually used by the upload UI. Own run-tracking table `pipeline_runs`.
2. **Connector CSV pipeline** (`ingest-csv-pipeline`, self-described in-code as a "Strangler-pattern entry point") — own run table `connector_sync_runs`, own error table, own lineage table. Requires a pre-provisioned `data_connectors` row. **Never invoked by the DataUpload UI** despite comments suggesting it's the large-file destination.
3. **API ingestion pipeline** (`api-ingest`, `// @ts-nocheck`) — a third, separate run table `data_sync_jobs`. **Skips `raw_records` entirely** — no raw/clean separation on this path, unlike the other two.

Three separately-implemented "run tracking" tables for what is conceptually one pipeline stage, each with its own error-handling convention.

### 5.5 Dead code inventory (ingestion-adjacent)

- `parseEuropeanNumber()` (§3.3) — dead in production.
- `src/lib/data-upload-utils-safe.ts` — the stack-overflow-safe `validateData()` rewrite, used only by its own test (§3.7).
- `src/components/upload/MappingIntelligencePanelInteractive.tsx` — re-renders `MappingIntelligencePanel` with identical props; zero importers anywhere in the repo.
- `src/lib/data-upload-utils-compat.d.ts` — orphaned `@deprecated missingPercent` compat shim; that field has exactly one occurrence in `src/` (this declaration file itself).
- `src/lib/edge-function-retry.ts.bak` — a stray, non-importable backup file.
- `chunked-processor.ts:78-97` (`planIngestion`) — its routing logic is duplicated inline in `useChunkedIngestion.ts:99` rather than calling this function; likely dead, not confirmed with full certainty.
- `db-connector/index.ts` — `discoverBigQuery`/`testBigQuery` (superseded, stub-returning) coexist with the real `discoverBigQueryFull` that the router actually calls — dead, misleading code left in the file.

---

## 6. Connectors

Two separate, non-unified connector subsystems exist: **System A** (`data_connectors` table, `src/pages/admin/Connectors.tsx`, per-vendor `connector-*-pull` functions) and **System B** (`connector_configs`/`data_sources` tables, `src/pages/DataConnectors.tsx`, `db-connector`/`connector-pull` functions).

**Production-capable, real API integrations:** Salesforce (OAuth2 refresh + paginated SOQL), SAP S/4HANA (OData, read-only enforced), Dynamics 365 (Azure AD client-credentials + Dataverse v9.2), NetSuite (OAuth 1.0a HMAC-SHA256 + SuiteTalk REST), Google Sheets (JWT service-account), Postgres/Snowflake/BigQuery/Redshift/Power BI (real drivers/REST APIs), Stripe/GA4/Xero/QuickBooks (real REST calls). HubSpot and S3 are real but proxied through a third-party gateway (`connector-gateway.lovable.dev`), requiring an additional API key.

**Placeholder:** MySQL and SQL Server — `db-connector/index.ts:1073,1135` return an explicit `"requires enterprise driver activation... contact support"` message; "test" is a bare TCP handshake, not credential validation.

**UI-only gap:** in System A's admin UI, "Run Now" is disabled for every connector type except `rest_api` (`admin/Connectors.tsx:176-196`) — connectors created through this specific screen have no manual-sync trigger wired, even though the underlying edge functions are real.

Credential handling is genuinely solid: Vault-backed via RPC (`_shared/connector-credentials.ts`), with org-membership/role checks and an encrypted-at-rest fallback.

---

## 7. Unstructured data and embeddings

**No document-processing library exists in this codebase** — no PDF parser, DOCX extractor, OCR engine, or email/MIME parser anywhere in `package.json` or any Edge Function's imports. Only output-direction tools exist (`jspdf`, `pptxgenjs`, for generating exports, not reading uploads).

**The dataset-upload pipeline (`DataUpload.tsx`) accepts only CSV/XLSX/XLS/XLSM/ODS** — confirmed at the validator (`isSupportedDataFile`, `workbook-parser.ts:42-45`).

**A misleading UI affordance exists and should be treated as a defect, not a roadmap gap:** the Copilot chat's file-attach control (`src/pages/Copilot.tsx:320`) advertises `accept=".csv,.xlsx,.pdf,.txt,.json,.docx"` and its own copy states *"content will be used as context."* Confirmed: no `FileReader`, no `arrayBuffer()`, no upload of file bytes anywhere in the component — only the filename is concatenated into the chat message (`Copilot.tsx:198-199`). **Every one of the six advertised extensions, including PDF and DOCX which have zero parser support anywhere in the codebase, silently degrades to "the AI sees the filename only."** This is exactly the class of thing Part 12 of the mission prohibits claiming — it should be fixed (either wire real extraction or remove the false affordance) independent of any larger unstructured-ingestion program.

**Embeddings are a deterministic hash vectorizer, not a neural model.** `generateDeterministicEmbedding()` (`supabase/functions/_shared/deterministic-embeddings.ts:143-208`) is an FNV-1a feature-hashing / TF-IDF-style bag-of-n-grams approach — its own header comment says it "replaces LLM-prompted pseudo-embeddings" and needs no network call. Cosine similarity over these vectors reflects lexical n-gram overlap, not learned semantic similarity. A secondary "neural fallback" path calls an LLM to extract ~10-20 keyword concepts, then hashes those into the *same* space — still not a genuine dense embedding.

**What gets embedded is entirely internal records** — decisions, outcomes, insights, advisories (`embed-decisions/index.ts:56-160`) — **never uploaded documents.** The vector store (`decision_embeddings`, pgvector, real IVFFlat index) and retrieval RPC are genuinely wired into the executive copilot's prompt (`executive-copilot/index.ts:354-366`), and citations are returned as `[1] (decision, 82% relevant)` — record-level provenance, not page/section references, because nothing document-shaped is ever embedded. **No document RAG citation format exists anywhere in the codebase.**

---

## 8. Test-quality flags

**`src/test/enterprise-data-integration.test.ts` is misleadingly named.** It claims to validate "connector contracts" and "metric mapping" but **reimplements the logic under test inline inside the test file itself** (e.g., its own `guessMetricType`, its own connector-type resolver, its own sanitization regex) rather than importing from `DataConnectors.tsx` or `db-connector/index.ts`. A regression in the real production code would not be caught by this suite despite its name implying otherwise. This should be either rewritten to import the real implementations or renamed to make clear it's testing a reference implementation, not production code.

**`src/test/trust-center-connector-health-fake-100.test.ts`** is a source-grep test — it asserts a specific string literal is present in `compute-trust-metrics/index.ts`, not that the runtime behavior is correct. Weak but at least touches the real file.

**`supabase/functions/embed-decisions/backfill_test.ts`** is a real integration test (calls a live Supabase instance) but runs under Deno, is not invoked by any `package.json` script, and is not part of `npm run test` — it likely never runs in CI.

**Certification suite (`src/lib/certification/`)** is the most rigorous coverage in the repo (industry packs including a German-locale pack, realistic messy-number/date fixtures), but as established in §2 and §4.8, it only exercises inference/classification functions, not the actual import/persistence path, and its own fixtures document that German column-**header** semantic classification is untested, not passing.

---

## 9. Security / tenant-isolation observations (scoped to ingestion)

- File-type validation is filename-suffix only, both client and (as far as could be determined from migrations) server-side — no magic-byte or MIME verification (§3.5).
- `raw_records` and `metrics` writes happen directly from the browser via `supabase-js` with the user's own session — correctness depends entirely on RLS policies on those tables, which were not re-audited here (out of scope for this pass; recommend a dedicated RLS test pass per Part 4 of the mission before any new ingestion tables are added).
- No cross-tenant leakage was found in the traced ingestion code itself, but the `api-ingest` Edge Function (`// @ts-nocheck`, skips `raw_records`) was not deeply reviewed for authorization boundaries in this pass and should be a priority in a dedicated security review.

---

## 10. What this audit does not cover

This pass traced the **ingestion/mapping** path specifically, per the mission's Part 1 scope. It did not deeply re-verify: RLS policy correctness on every table listed in §5.3/§5.4 (recommend a dedicated pass before Part 4's new tables are added), the full connector credential-rotation lifecycle, or the executive-copilot RAG prompt's injection resistance against retrieved content. These should be explicit follow-ups, not assumed clean because they weren't flagged here.

---

## 11. Immediate recommendation

Per the mission's own working rule ("do not begin large implementation work until this audit exists") and its Phase 0 gate ("proceed with Phase 1 unless a critical architectural or security blocker requires resolution first"): **the §2 finding is exactly that blocker.** It is small, isolated, high-confidence, and actively corrupting real numeric data for any European-locale pilot user today (of direct relevance now that pilot signups have full product access with no payment gate). Recommend fixing it as a standalone, tested hotfix before or in parallel with scoping Phase 1 — not as part of the larger canonical-contracts rewrite, and not blocked on it either.

Beyond that fix, Phase 1 ("canonical contracts") as specified in the mission is a substantial, multi-week undertaking (new Zod-validated contracts, new DB tables with RLS, compatibility adapters for the existing pipeline) that should be scoped and confirmed with the product owner before implementation begins, rather than started unilaterally off the back of this audit.

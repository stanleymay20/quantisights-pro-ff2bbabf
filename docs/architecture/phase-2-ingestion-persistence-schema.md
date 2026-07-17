# Phase 2: Ingestion Persistence Schema (Design — Not Yet Applied)

**Status: proposed, awaiting explicit approval. No migration has been written to a `.sql` file and nothing described here has been applied to any database.**

Companion to `docs/implementation/phase-2-structured-ingestion-plan.md`. Grounded in the actual current schema (read directly from `supabase/migrations/*.sql`, not assumed) as of commit `d784a52`.

## Design principle: reuse over duplication

The mission's Part 2 field lists (Ingestion source, Ingestion run, Source schema version, Source field, Field profile, Mapping proposal, Mapping decision, Processing evidence) describe **concepts**, not a mandate to create 8 new tables. Two of those concepts already have a home:

- **Ingestion source + Ingestion run** → the existing `dataset_versions` + `pipeline_runs` pair already models "one ingestion event that produced one version of a dataset" 1:1 with the run that produced it (confirmed: `DataUpload.tsx` creates exactly one `dataset_versions` row and one `pipeline_runs` row per upload, in that order). These are **extended with new columns**, not duplicated with new tables.
- The remaining six concepts (schema version snapshot, field, field profile, mapping proposal, mapping decision, evidence) have **no existing table** (confirmed absent from all 187 pre-Phase-2 migrations, per the original audit). These need **new tables**.

Net: **2 existing tables extended, 6 new tables created.** No `ingestion_sources` or `ingestion_runs` table is created, despite those names appearing in the mission text, because they would duplicate `dataset_versions`/`pipeline_runs`.

## Existing tables reused (extended with new columns)

### `public.dataset_versions` — gains ingestion-source identity

Current columns (unchanged): `id, dataset_id, organization_id, version_number, file_path, row_count, column_mapping, change_summary, created_by, is_active, created_at, metadata jsonb (added 2026-04-29)`.

New columns:

| Column | Type | Notes |
|---|---|---|
| `mime_type` | `text` | nullable — not always knowable client-side |
| `byte_size` | `bigint` | nullable |
| `checksum` | `text` | **nullable at the column level** (existing rows have none), but see unique index below |
| `parser_name` | `text` | e.g. `"parseCSVText"`, `"parseWorkbookFile"` |
| `parser_version` | `text` | e.g. `"legacy"` today; will read `"canonical:v1"` once wired |
| `source_timestamp` | `timestamptz` | nullable — file's own last-modified time if available, distinct from `created_at` (ingestion time) |
| `canonical_metadata_status` | `text` | `'unavailable' \| 'pending' \| 'available' \| 'failed'`, `NOT NULL DEFAULT 'unavailable'`, `CHECK` constraint on the four values |

Backfill for existing rows: the migration's `ALTER TABLE ... ADD COLUMN` defaults handle `canonical_metadata_status` automatically (`DEFAULT 'unavailable'` applies to existing rows too under Postgres's `ADD COLUMN ... DEFAULT` semantics for a non-volatile default — no separate `UPDATE` needed). All other new columns are nullable and simply `NULL` for pre-Phase-2 rows, which is the correct "we don't know" representation, not a fabricated value.

No new index needed beyond what's proposed below for idempotency (which lives on `pipeline_runs`, not here).

### `public.pipeline_runs` — gains idempotency and run-lineage fields

Current columns (unchanged): `id, organization_id, dataset_id, run_type, status, stage, raw_count, transformed_count, aggregated_count, error_count, error_message, started_at, completed_at, duration_ms, metadata jsonb`.

New columns:

| Column | Type | Notes |
|---|---|---|
| `idempotency_key` | `uuid` | `NOT NULL DEFAULT gen_random_uuid()` — existing rows get a fresh random value each (fine: idempotency only matters for NEW runs going forward; retroactively deduplicating historical runs is not a goal) |
| `dataset_version_id` | `uuid REFERENCES public.dataset_versions(id) ON DELETE SET NULL` | nullable — links a run to the specific version it produced; not previously tracked explicitly (the relationship existed only implicitly via matching timestamps) |
| `run_version` | `text` | nullable — parser/pipeline version marker, e.g. `"canonical:v1"` |
| `failure_stage` | `text` | nullable — one of the `ProcessingStage` values from `src/lib/ingestion-contracts/errors.ts`, so a failed run records *where* it failed in the same vocabulary the contracts already use |
| `retry_of` | `uuid REFERENCES public.pipeline_runs(id) ON DELETE SET NULL` | nullable — self-reference for the run this one is a retry of, if any |

New constraint: `UNIQUE (organization_id, idempotency_key)`. This is the DB-level idempotency guarantee — a retried import that reuses the same key gets a `23505` unique-violation instead of a second row, per the plan document's §5.

New status values: `pipeline_runs.status` is currently an unconstrained `text` with application-level values (`pending`, `running`, `completed`, etc. — confirmed no `CHECK` constraint exists today, so no migration is needed to *add* the value, but the application must start writing) — `completed_with_warnings` joins the existing informal set, consistent with the `ProcessingStatus` contract already defined in Phase 1.

## New tables

All six follow the same scoping pattern as every existing ingestion table (`raw_records`, `schema_evolution_log`, `data_lineage`): `organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE` on every table, checked directly in RLS policies (no join required to enforce tenant isolation), plus a `workspace_id uuid REFERENCES public.workspaces(id)` nullable column mirroring `datasets.workspace_id`'s nullability (workspace is an optional refinement, not a requirement, matching the existing model). No `project_id` column is added directly, matching the existing convention where project association goes through the `project_datasets` join table rather than a direct column on data-bearing tables.

### 1. `public.dataset_schema_versions`

One row per detected schema snapshot for a dataset (created on first import and again whenever drift is detected on re-import).

```sql
CREATE TABLE public.dataset_schema_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id),
  dataset_id uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  dataset_version_id uuid NOT NULL REFERENCES public.dataset_versions(id) ON DELETE CASCADE,
  pipeline_run_id uuid NOT NULL REFERENCES public.pipeline_runs(id) ON DELETE CASCADE,
  schema_version_number integer NOT NULL,
  field_count integer NOT NULL,
  schema_checksum text NOT NULL,
  previous_schema_version_id uuid REFERENCES public.dataset_schema_versions(id) ON DELETE SET NULL,
  drift_status text NOT NULL DEFAULT 'initial'
    CHECK (drift_status IN ('initial', 'no_drift', 'informational', 'warning', 'breaking', 'security_sensitive')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_dataset_schema_versions_dataset_version
  ON public.dataset_schema_versions (dataset_id, schema_version_number);
CREATE INDEX idx_dataset_schema_versions_org ON public.dataset_schema_versions (organization_id, dataset_id);
```

`drift_status` values match the mission's own vocabulary (informational/warning/breaking/security_sensitive) plus `initial` (first-ever schema for this dataset — nothing to diff against) and `no_drift` (re-import, schema checksum unchanged).

### 2. `public.dataset_fields`

One row per column/field within a specific schema version.

```sql
CREATE TABLE public.dataset_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id),
  dataset_id uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  schema_version_id uuid NOT NULL REFERENCES public.dataset_schema_versions(id) ON DELETE CASCADE,
  ordinal integer NOT NULL,
  sheet_or_table text NOT NULL DEFAULT 'csv',
  original_header text NOT NULL,
  normalized_header text NOT NULL,
  source_location jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_dataset_fields_version_ordinal
  ON public.dataset_fields (schema_version_id, sheet_or_table, ordinal);
CREATE INDEX idx_dataset_fields_org_dataset ON public.dataset_fields (organization_id, dataset_id);
```

`source_location` mirrors the `SourceLocation` shape from `src/lib/ingestion-contracts/evidence.ts` (sheet/column/row-range) — reused as-is rather than inventing a parallel shape.

### 3. `public.dataset_field_profiles`

One row per `(dataset_field, pipeline_run)` — a field re-profiled on re-import gets a new row, not an overwrite, preserving history.

```sql
CREATE TABLE public.dataset_field_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id),
  dataset_field_id uuid NOT NULL REFERENCES public.dataset_fields(id) ON DELETE CASCADE,
  pipeline_run_id uuid NOT NULL REFERENCES public.pipeline_runs(id) ON DELETE CASCADE,
  profiling_mode text NOT NULL CHECK (profiling_mode IN ('full_scan', 'representative')),
  sampling_strategy jsonb NOT NULL,
  sample_size integer NOT NULL,
  row_coverage numeric NOT NULL CHECK (row_coverage >= 0 AND row_coverage <= 1),
  null_rate numeric NOT NULL CHECK (null_rate >= 0 AND null_rate <= 1),
  distinct_count integer NOT NULL,
  numeric_rate numeric NOT NULL CHECK (numeric_rate >= 0 AND numeric_rate <= 1),
  date_rate numeric NOT NULL CHECK (date_rate >= 0 AND date_rate <= 1),
  boolean_rate numeric NOT NULL CHECK (boolean_rate >= 0 AND boolean_rate <= 1),
  identifier_likelihood numeric NOT NULL CHECK (identifier_likelihood >= 0 AND identifier_likelihood <= 1),
  pii_likelihood numeric NOT NULL CHECK (pii_likelihood >= 0 AND pii_likelihood <= 1),
  detected_formats text[] NOT NULL DEFAULT '{}',
  -- Bounded and redacted BEFORE insert by the application layer (see "PII
  -- handling" below) -- the CHECK constraints here are defense-in-depth,
  -- not the primary control.
  representative_values text[] NOT NULL DEFAULT '{}'
    CHECK (array_length(representative_values, 1) IS NULL OR array_length(representative_values, 1) <= 20),
  anomalies text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_dataset_field_profiles_field_run
  ON public.dataset_field_profiles (dataset_field_id, pipeline_run_id);
CREATE INDEX idx_dataset_field_profiles_org ON public.dataset_field_profiles (organization_id);
```

A `CHECK` constraint bounding individual value length (not just array length) is deliberately **not** expressed in SQL — Postgres `CHECK` over array-of-text element lengths is awkward and better enforced in the application layer where the redaction logic already lives (see PII section). This is documented here as an explicit choice, not an oversight.

### 4. `public.dataset_field_mapping_proposals`

One row per `(dataset_field, proposal_kind)` per run — physical type, structural role, and semantic concept are three rows per field, not three columns, so evidence/alternatives/state can differ per layer exactly as the Phase 1 contracts already model them separately.

```sql
CREATE TABLE public.dataset_field_mapping_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id),
  dataset_field_id uuid NOT NULL REFERENCES public.dataset_fields(id) ON DELETE CASCADE,
  pipeline_run_id uuid NOT NULL REFERENCES public.pipeline_runs(id) ON DELETE CASCADE,
  proposal_kind text NOT NULL CHECK (proposal_kind IN ('physical_type', 'structural_role', 'semantic_concept')),
  proposed_value text NOT NULL, -- e.g. "decimal", "transaction_date", "revenue:financial_kpi"
  evidence_score numeric NOT NULL CHECK (evidence_score >= 0 AND evidence_score <= 100),
  mapping_method text NOT NULL,
  rule_or_model_version text NOT NULL,
  alternatives_considered text[] NOT NULL DEFAULT '{}',
  review_required boolean NOT NULL,
  state text NOT NULL DEFAULT 'proposed'
    CHECK (state IN ('proposed', 'accepted', 'rejected', 'edited', 'unknown', 'superseded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mapping_proposals_field ON public.dataset_field_mapping_proposals (dataset_field_id, proposal_kind);
CREATE INDEX idx_mapping_proposals_org ON public.dataset_field_mapping_proposals (organization_id);
CREATE INDEX idx_mapping_proposals_review_required
  ON public.dataset_field_mapping_proposals (organization_id, review_required) WHERE review_required = true;
```

The `evidenceScore` naming and 0-100 bound is carried verbatim from `src/lib/ingestion-contracts/inference.ts` — **no column here is named or documented as a calibrated confidence or probability**, per the phase brief's explicit prohibition, and the partial index on `review_required = true` is what powers the "expose unresolved mappings for review" requirement (mission item 5) as a cheap, direct query rather than a full-table scan.

### 5. `public.dataset_field_mapping_evidence`

One row per evidence record backing a proposal, mirroring `src/lib/ingestion-contracts/evidence.ts`'s `EvidenceRecord` exactly.

```sql
CREATE TABLE public.dataset_field_mapping_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mapping_proposal_id uuid NOT NULL REFERENCES public.dataset_field_mapping_proposals(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  description text NOT NULL,
  -- Safe location reference only (sheet/column/row-range) -- never a raw
  -- cell value. See PII handling below.
  source_location jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_statistic text NOT NULL,
  rule_or_method text NOT NULL,
  weight numeric NOT NULL CHECK (weight >= 0 AND weight <= 1),
  stance text NOT NULL CHECK (stance IN ('supporting', 'contradicting', 'neutral')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mapping_evidence_proposal ON public.dataset_field_mapping_evidence (mapping_proposal_id);
CREATE INDEX idx_mapping_evidence_org ON public.dataset_field_mapping_evidence (organization_id);
```

`observed_statistic` is a short descriptive string (e.g. `"numericRate=0.94"`), consistent with the Phase 1 contract's own design choice to avoid a raw-value-bearing free-form field — see PII handling below for why this matters at the persistence layer specifically, not just the in-memory contract.

### 6. `public.dataset_field_mapping_decisions`

One row per **decision event** (append-only — a changed mind creates a new row, not an update), so the full review history is preserved.

```sql
CREATE TABLE public.dataset_field_mapping_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id),
  dataset_field_id uuid NOT NULL REFERENCES public.dataset_fields(id) ON DELETE CASCADE,
  mapping_proposal_id uuid REFERENCES public.dataset_field_mapping_proposals(id) ON DELETE SET NULL,
  decision text NOT NULL CHECK (decision IN ('accepted', 'rejected', 'edited', 'marked_unknown')),
  final_value text, -- NULL only when decision = 'rejected' or 'marked_unknown'
  reason text,
  reviewer_id uuid NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  supersedes_decision_id uuid REFERENCES public.dataset_field_mapping_decisions(id) ON DELETE SET NULL,
  decision_version integer NOT NULL DEFAULT 1
);

CREATE INDEX idx_mapping_decisions_field ON public.dataset_field_mapping_decisions (dataset_field_id, decided_at DESC);
CREATE INDEX idx_mapping_decisions_org ON public.dataset_field_mapping_decisions (organization_id);
```

"The current decision for a field" is `SELECT ... ORDER BY decided_at DESC LIMIT 1` per `(dataset_field_id, proposal_kind)` — no separate "current" flag/table needed, and the append-only design directly satisfies "mapping corrections must be versioned and auditable" without a trigger.

## Relationships (summary)

```
organizations
  └─ datasets
       └─ dataset_versions  (+ mime_type, byte_size, checksum, parser_name/version, source_timestamp, canonical_metadata_status)
            └─ pipeline_runs  (+ idempotency_key UNIQUE, dataset_version_id, run_version, failure_stage, retry_of)
                 └─ dataset_schema_versions  (schema_checksum, drift_status, previous_schema_version_id self-ref)
                      └─ dataset_fields  (ordinal, header, source_location)
                           ├─ dataset_field_profiles  (per pipeline_run)
                           ├─ dataset_field_mapping_proposals  (per proposal_kind, per pipeline_run)
                           │    └─ dataset_field_mapping_evidence
                           └─ dataset_field_mapping_decisions  (append-only, supersedes_decision_id self-ref)
```

## Indexes and unique constraints (consolidated)

| Table | Unique constraint | Supporting indexes |
|---|---|---|
| `pipeline_runs` | `(organization_id, idempotency_key)` | existing `(organization_id, dataset_id)`, `(status, started_at DESC)` unchanged |
| `dataset_schema_versions` | `(dataset_id, schema_version_number)` | `(organization_id, dataset_id)` |
| `dataset_fields` | `(schema_version_id, sheet_or_table, ordinal)` | `(organization_id, dataset_id)` |
| `dataset_field_profiles` | `(dataset_field_id, pipeline_run_id)` | `(organization_id)` |
| `dataset_field_mapping_proposals` | — (multiple proposals per field over time by design) | `(dataset_field_id, proposal_kind)`, partial index on `review_required` |
| `dataset_field_mapping_evidence` | — | `(mapping_proposal_id)` |
| `dataset_field_mapping_decisions` | — (append-only) | `(dataset_field_id, decided_at DESC)` |

## Retention implications

- `dataset_field_profiles` and `dataset_field_mapping_evidence` grow one set of rows per re-import (not per row of source data — bounded by field count × runs, not dataset size), so growth is proportional to how often a dataset is re-uploaded, not its row count. No retention policy is proposed in Phase 2; if re-import frequency turns out to be high for some orgs, a future phase can prune `dataset_field_profiles`/evidence for superseded schema versions, keeping only the current and immediately-previous version. Flagged here, not built now (out of scope: "do not build a large drift dashboard yet" extends to not over-building retention tooling for a problem not yet observed).
- `representative_values` is capped at 20 entries per profile and is subject to the redaction rules below — this bounds worst-case row size regardless of source dataset width.
- `dataset_field_mapping_decisions` is intentionally append-only/unbounded (audit trail) — this matches how `audit_log` and `schema_evolution_log` already behave in this schema; no special-casing needed.

## PII handling in persistence (mission item 11)

This is a persistence-layer control, not just an application convention, because the mission requires it survive independent of any one code path remembering to redact:

1. **`representative_values` and `observed_statistic` never contain a raw value from a field the profiler has flagged `pii_likelihood >= 0.5`.** The application layer (Phase 2 integration code, not this migration) redacts before insert — e.g. `j***@example.com` for emails, `***-**-1234`-style masking for identifier-shaped values — but the schema encodes the bound (`array_length <= 20`) as defense-in-depth against a redaction-logic bug producing unbounded output, not as the redaction mechanism itself.
2. **`source_location` never carries a value, only a position** (sheet/column/row-range) — this is enforced by the `SourceLocation` contract shape itself (Phase 1, `evidence.ts`), reused verbatim as the jsonb shape here, so there is no field in the new schema *capable* of holding a raw source value except `representative_values` (bounded/redacted) and `dataset_fields.original_header`/`normalized_header` (header text, not cell values — headers are essentially never PII themselves, and the existing legacy PII detectors already treat header text as public).
3. **False-positive-prone header patterns** (`product_name`, `company_name`, `campaign_name`) and **under-covered sensitive synonyms** (`beneficiary`, `applicant`, `insured_party`, `national_id`, `tax_number`, and German equivalents) are an **application-layer PII-detection improvement**, not a schema change — tracked as Phase 2 implementation work against `computeFieldProfile`'s `piiLikelihood` calculation (currently header-keyword-only, per the Phase 1 audit), with the schema already supporting a graded `pii_likelihood numeric` rather than a boolean so "uncertain" is representable and can trigger `review_required` rather than a hard binary classification.

## RLS policies

Every new table gets exactly the pattern already used by `raw_records`/`schema_evolution_log`/`data_lineage` (verified against the real `is_org_member(_user_id uuid, _org_id uuid)` `SECURITY DEFINER` function, which checks `organization_members` — not copied blindly, confirmed to be the correct, currently-in-use membership check):

```sql
ALTER TABLE public.dataset_schema_versions ENABLE ROW LEVEL SECURITY;
-- (repeated for all six new tables)

CREATE POLICY "Org members can view <table>"
  ON public.<table> FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert <table>"
  ON public.<table> FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id));
```

**No `UPDATE` policy is created for any of the six new tables.** Every one of them is designed to be append-only (schema versions, fields, profiles, proposals, evidence, and decisions are all new-row-per-event) — this is what "prevent changing tenant ownership after creation" means concretely here: there is no code path, RLS-permitted or otherwise, that can mutate `organization_id` on an existing row, because there is no `UPDATE` grant at all. `dataset_field_mapping_proposals.state` might look like it wants an UPDATE (proposed → accepted), but per the schema above, state transitions are recorded by inserting a `dataset_field_mapping_decisions` row that references the proposal, not by mutating the proposal itself — the proposal row is immutable history; the decision is the mutable-in-spirit, append-only-in-fact layer on top.

**No `DELETE` policy.** Deletion, if ever needed (e.g. GDPR erasure), goes through `ON DELETE CASCADE` from `datasets`/`dataset_versions`/`pipeline_runs` (all six new tables cascade from one of those), which already requires elevated/service-role action to delete a dataset — consistent with how the rest of the schema handles erasure today.

**Service-role behavior:** the service role (used by Edge Functions like `transform-metrics`, and by any future backfill job) bypasses RLS by default in Supabase, as every existing Edge Function in this codebase already relies on. No new service-role-specific policy is added; this is a deliberate continuation of the existing model, not a new decision — flagged here per the instruction to "define service-role behaviour deliberately" rather than leave it implicit.

## Migration order

0. `ALTER TABLE organizations ADD COLUMN default_locale text` (nullable, no dependency on anything else)
1. `ALTER TABLE dataset_versions ADD COLUMN ...` (new columns, all nullable or defaulted — safe, no data rewrite beyond the default-value fast-path Postgres already optimizes for `ADD COLUMN ... DEFAULT`)
2. `ALTER TABLE pipeline_runs ADD COLUMN ...` + the new `UNIQUE (organization_id, idempotency_key)` constraint (safe: `idempotency_key DEFAULT gen_random_uuid()` guarantees every existing row gets a distinct value before the unique constraint is checked)
3. `CREATE TABLE dataset_schema_versions` (+ RLS)
4. `CREATE TABLE dataset_fields` (+ RLS) — depends on (3)
5. `CREATE TABLE dataset_field_profiles` (+ RLS) — depends on (2), (4)
6. `CREATE TABLE dataset_field_mapping_proposals` (+ RLS) — depends on (2), (4)
7. `CREATE TABLE dataset_field_mapping_evidence` (+ RLS) — depends on (6)
8. `CREATE TABLE dataset_field_mapping_decisions` (+ RLS) — depends on (4), (6)

Steps 3-8 have no interdependency on data, only on schema (foreign keys), so they can ship as one migration file in this order, or eight — recommend **one file**, matching this repo's existing convention of grouping a cohesive feature's DDL into a single timestamped migration (e.g. the `20260418013025` migration that created `tier_features` + `check_feature_access` + `external_data_sources` together).

## Rollback approach

- Steps 3-8 (new tables): `DROP TABLE IF EXISTS ... CASCADE` in reverse dependency order. Zero risk to existing data — nothing pre-Phase-2 references these tables.
- Steps 1-2 (`ALTER TABLE ADD COLUMN`): `ALTER TABLE ... DROP COLUMN ...`. Safe as long as no Phase 2 application code has been deployed that depends on the columns existing — since this phase's integration work (§2 of the plan doc) ships *after* the migration is approved and applied, a rollback immediately post-migration (before integration code deploys) is a pure no-op for the running application. A rollback *after* integration code has shipped and started writing rows would need the integration code reverted first (standard "migrate forward, revert app, then migrate back" order) — noted here, not a concern until that point is reached.
- No data-migrating rollback is needed anywhere in this design because no existing column is altered in place, dropped, or repurposed — every change is additive.

## Compatibility with current datasets and metrics

- `datasets`, `metrics`, `metric_aggregates`, `raw_records` schemas are **completely unchanged**. Every existing query, RLS policy, and downstream analytics feature (Dashboard, Decision Ledger, Reports, etc.) continues to operate exactly as today.
- Pre-Phase-2 `dataset_versions` rows read back with `canonical_metadata_status = 'unavailable'` and `NULL` for the other new columns — a well-defined "we don't know" state the UI can render honestly (per the plan doc's §6), not an error state and not silently fabricated data.
- `connector_sync_runs`/`connector_lineage_events`/`canonical_entities` (the separate connector persistence model) are untouched — this schema does not attempt to unify with it in Phase 2, per the plan doc's explicit scope note.

## Resolved: organization-level locale setting

Checked before finalizing this document: no `locale`, `default_locale`, or equivalent region/number-format column exists anywhere in the current schema (`grep` across all 187 pre-Phase-2 migrations for locale-related columns on `organizations` or any settings table returns nothing). The plan document's §3 (locale-aware parsing) therefore adds one new column as part of this same migration:

```sql
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS default_locale text; -- e.g. 'en-US', 'de-DE'; NULL = unknown, not a fabricated default
```

Nullable, no default value forced — an org with `default_locale IS NULL` is honestly "we don't know this org's number/date convention," which the ambiguous-date review-required logic (plan doc §3) already handles as one of its inputs. This is included as step 0 of the migration order above (no dependency on any other step in this migration).

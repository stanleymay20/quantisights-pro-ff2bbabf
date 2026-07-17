# Phase 2: Ingestion Persistence Schema (Design — Not Yet Applied)

**Status: revised proposal, awaiting explicit approval. No migration has been applied to any database. This revision closes the ten mandatory-control gaps identified in review of the first draft.**

Companion to `docs/implementation/phase-2-structured-ingestion-plan.md`. Grounded in the actual current schema (read directly from `supabase/migrations/*.sql`) as of commit `abfbeea`, plus direct verification of `exec_require_elevated_role`, the real `pipeline_runs.status` values written by production code, and the real `metrics` upsert conflict target (all cited below with file:line).

## Summary of what changed since the first draft

| # | Gap | Resolution (this revision) |
|---|---|---|
| 1 | Idempotency key was `gen_random_uuid()` — regenerates every attempt, defeats dedup | `idempotency_key` is now a Postgres `GENERATED ALWAYS AS ... STORED` column, deterministically computed from `organization_id`, a client-supplied stable `client_attempt_key`, `source_checksum`, `parser_version`, `import_config_hash` |
| 2 | `is_org_member` alone doesn't stop cross-tenant references via a self-supplied `organization_id` | Every parent table gets `UNIQUE (id, organization_id)`; every child FK becomes a composite `FOREIGN KEY (parent_id, organization_id) REFERENCES parent(id, organization_id)` |
| 3 | No distinction between ordinary-member INSERT and elevated-role-required INSERT | New `can_decide_mapping()` SECURITY DEFINER function: ordinary `is_org_member` for non-PII fields, `exec_require_elevated_role` (owner/admin) required when the field has ever been profiled with `pii_likelihood >= 0.5` |
| 4 | `decision_version` had no enforced sequencing; no defined "current" query | `BEFORE INSERT` trigger computes the next version under an advisory lock; `UNIQUE(dataset_field_id, proposal_kind, decision_version)`; a new view `dataset_field_current_mapping` defines "latest effective mapping" deterministically |
| 5 | Uniqueness list was incomplete (profiler version, inference version, decision version not covered) | Full uniqueness table added, section "Uniqueness and retry safety," including confirmation that the *existing* `metrics_unique_series` constraint already protects the `metrics` table |
| 6 | `pipeline_runs.dataset_id` was `NOT NULL`, but a run must exist before a dataset does, for idempotency dedup to work pre-creation | `pipeline_runs.dataset_id` becomes nullable (the one non-purely-additive column change in this migration, explicitly flagged); a run is created first, dataset/version linked after |
| 7 | "20 values" was a count cap only; no length cap, no redaction tracking | Added per-element length cap via a helper function, `redaction_status`/`redaction_method` columns, and a `CHECK` that forbids `redaction_status = 'not_required'` when `pii_likelihood >= 0.5` |
| 8 | No CHECK/enum on several statuses; jsonb columns unbounded | Added CHECKs/enums throughout (including retrofitting `pipeline_runs.status`, added as `NOT VALID` pending a preflight query); every jsonb/array column now has a size bound |
| 9 | `default_locale` had no format validation, no per-run locale provenance | Added a BCP-47-shaped `CHECK`; four new `pipeline_runs` columns capture detected/selected locale, source, and ambiguity per run |
| 10 | No rollback artifact, no preflight/verification queries | Added a separate rollback script (outside `supabase/migrations/` so it is never auto-applied) plus preflight/post-migration/RLS verification query sets |

## Design principle: reuse over duplication (unchanged from the first draft)

**Ingestion source + Ingestion run** → `dataset_versions` + `pipeline_runs`, extended, not duplicated. **Six new tables** for the concepts with no existing home. This revision does not change that decision — it hardens the constraints around it.

## Existing tables reused (extended)

### `public.organizations`

```sql
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS default_locale text;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_default_locale_format
  CHECK (default_locale IS NULL OR default_locale ~ '^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$');
```

Nullable (confirmed absent from all prior migrations, as in the first draft). The `CHECK` is a simplified BCP-47 shape (language[-script][-region]), e.g. `en`, `en-US`, `de-DE`, `zh-Hans-CN` — not a full BCP-47 validator (Postgres has no built-in one), sufficient to reject obviously malformed input while accepting the locale tags this system actually needs. **Treated as a hint, never authoritative evidence** — see `pipeline_runs.locale_source` below, which is what actually drives ambiguous-date handling per run.

### `public.datasets`

```sql
ALTER TABLE public.datasets
  ADD CONSTRAINT datasets_id_org_unique UNIQUE (id, organization_id);
```

Enables every child table's composite foreign key (see "Cross-tenant foreign-key integrity" below). No other change to `datasets`.

### `public.dataset_versions`

```sql
ALTER TABLE public.dataset_versions
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS byte_size bigint,
  ADD COLUMN IF NOT EXISTS checksum text,
  ADD COLUMN IF NOT EXISTS parser_name text,
  ADD COLUMN IF NOT EXISTS parser_version text,
  ADD COLUMN IF NOT EXISTS source_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS canonical_metadata_status text NOT NULL DEFAULT 'unavailable';

ALTER TABLE public.dataset_versions
  ADD CONSTRAINT dataset_versions_canonical_status_check
  CHECK (canonical_metadata_status IN ('unavailable', 'pending', 'available', 'failed'));

ALTER TABLE public.dataset_versions
  ADD CONSTRAINT dataset_versions_id_org_unique UNIQUE (id, organization_id);

ALTER TABLE public.dataset_versions
  ADD CONSTRAINT dataset_versions_dataset_org_fk
  FOREIGN KEY (dataset_id, organization_id) REFERENCES public.datasets (id, organization_id);
```

The last constraint is **new relative to the first draft**: `dataset_versions.dataset_id` already had a plain `REFERENCES datasets(id)`; this adds a second, composite FK that additionally requires `dataset_versions.organization_id = datasets.organization_id`, closing the cross-tenant gap for this specific edge (a user who is a genuine member of org A cannot create a `dataset_versions` row with `organization_id = A` that points at a `dataset_id` actually owned by org B — Postgres rejects the insert outright, independent of any RLS policy).

### `public.pipeline_runs`

This table changes the most, for two independent reasons: idempotency (control 1) and the run-before-dataset-exists requirement (control 6).

```sql
-- Step 1: add nullable columns first (existing rows get NULL, backfilled below where NOT NULL is required)
ALTER TABLE public.pipeline_runs
  ADD COLUMN IF NOT EXISTS client_attempt_key text,
  ADD COLUMN IF NOT EXISTS source_checksum text,
  ADD COLUMN IF NOT EXISTS parser_version text,
  ADD COLUMN IF NOT EXISTS import_config_hash text,
  ADD COLUMN IF NOT EXISTS dataset_version_id uuid,
  ADD COLUMN IF NOT EXISTS run_version text,
  ADD COLUMN IF NOT EXISTS failure_stage text,
  ADD COLUMN IF NOT EXISTS retry_of uuid,
  ADD COLUMN IF NOT EXISTS detected_locale text,
  ADD COLUMN IF NOT EXISTS selected_locale text,
  ADD COLUMN IF NOT EXISTS locale_source text,
  ADD COLUMN IF NOT EXISTS locale_ambiguous boolean NOT NULL DEFAULT false;

-- Step 2: backfill the four NOT-NULL-to-be columns for pre-existing rows with
-- explicitly legacy-tagged, deterministic-per-row values (never fabricated
-- as if they were real client-supplied data).
UPDATE public.pipeline_runs
SET client_attempt_key = 'legacy:' || id::text,
    source_checksum   = 'legacy:unknown',
    parser_version    = 'legacy:unknown',
    import_config_hash = 'legacy:unknown'
WHERE client_attempt_key IS NULL;

ALTER TABLE public.pipeline_runs
  ALTER COLUMN client_attempt_key SET NOT NULL,
  ALTER COLUMN source_checksum SET NOT NULL,
  ALTER COLUMN parser_version SET NOT NULL,
  ALTER COLUMN import_config_hash SET NOT NULL;

-- Step 3: the deterministic idempotency key, computed BY POSTGRES, not by
-- application code -- removes an entire class of "the app forgot to reuse
-- the key on retry" bugs. sha256 over a delimited, fully-qualified string;
-- collision-safe for this purpose (not a security boundary, a dedup key).
ALTER TABLE public.pipeline_runs
  ADD COLUMN IF NOT EXISTS idempotency_key text
  GENERATED ALWAYS AS (
    encode(
      digest(
        organization_id::text || ':' || client_attempt_key || ':' ||
        source_checksum || ':' || parser_version || ':' || import_config_hash,
        'sha256'
      ),
      'hex'
    )
  ) STORED;

ALTER TABLE public.pipeline_runs
  ADD CONSTRAINT pipeline_runs_org_idempotency_unique UNIQUE (organization_id, idempotency_key);

-- Step 4: dataset_id becomes nullable -- the one non-additive change in
-- this migration. See "Pipeline-run relationship" below for why.
ALTER TABLE public.pipeline_runs
  ALTER COLUMN dataset_id DROP NOT NULL;

ALTER TABLE public.pipeline_runs
  ADD CONSTRAINT pipeline_runs_id_org_unique UNIQUE (id, organization_id);

-- Composite FKs, nullable-safe (NULL values are simply exempt from FK
-- checking in Postgres, which is correct here: a run with no dataset yet
-- has nothing to validate against).
ALTER TABLE public.pipeline_runs
  ADD CONSTRAINT pipeline_runs_dataset_org_fk
  FOREIGN KEY (dataset_id, organization_id) REFERENCES public.datasets (id, organization_id);

ALTER TABLE public.pipeline_runs
  ADD CONSTRAINT pipeline_runs_dataset_version_org_fk
  FOREIGN KEY (dataset_version_id, organization_id) REFERENCES public.dataset_versions (id, organization_id);

ALTER TABLE public.pipeline_runs
  ADD CONSTRAINT pipeline_runs_retry_of_org_fk
  FOREIGN KEY (retry_of, organization_id) REFERENCES public.pipeline_runs (id, organization_id);

-- Controlled values.
ALTER TABLE public.pipeline_runs
  ADD CONSTRAINT pipeline_runs_locale_source_check
  CHECK (locale_source IS NULL OR locale_source IN
    ('user_selected', 'organization_default', 'detected_number_format', 'detected_date_format', 'workbook_metadata', 'unknown'));

-- Retrofitting the pre-existing, previously-unconstrained status column.
-- Added NOT VALID first: does not scan/validate existing rows at
-- migration time (fast, no lock escalation risk), validated separately
-- in a follow-up statement only after the preflight query below confirms
-- no unexpected historical value exists.
ALTER TABLE public.pipeline_runs
  ADD CONSTRAINT pipeline_runs_status_check
  CHECK (status IN ('pending', 'running', 'completed', 'completed_with_warnings', 'failed', 'cancelled', 'awaiting_review'))
  NOT VALID;
-- Run after the preflight query in "Migration validation" confirms
-- clean data: ALTER TABLE public.pipeline_runs VALIDATE CONSTRAINT pipeline_runs_status_check;
```

**Why `dataset_id` must become nullable — control 6, worked through explicitly:**

Real production status values, confirmed by grep of the actual write sites: `src/pages/DataUpload.tsx:485` (`datasets.status = "processing"`, a different table), `:627` (`pipeline_runs.status = "running"`), `:938/:969` (`"failed"`), `:945` (`"completed"`); `supabase/functions/transform-metrics/index.ts:78` and `supabase/functions/refresh-aggregates/index.ts:77` (`"running"`). The default is `'pending'`. This confirms the enum list above covers every value the running system actually writes, with `completed_with_warnings`/`cancelled`/`awaiting_review` added as not-yet-used-but-reserved values from the `ProcessingStatus` contract (Phase 1) — the preflight query still must run to catch any value this grep missed (e.g. a since-removed code path, or a manual DB edit) before validating the constraint.

Today, `handleImport()` creates rows in the order `datasets` → `dataset_versions` → ... → `pipeline_runs` (`DataUpload.tsx:474-487`, `:495-507`, `:621-629`) — meaning a `pipeline_runs` row only ever comes into existence *after* both parent rows already exist, which is exactly what breaks idempotency: if the process fails between creating `datasets` and creating `pipeline_runs`, there is no run row to have deduplicated against, so a retry using the same idempotency key would create a **second** `datasets` row instead of being recognized as a retry.

The fix is to invert the creation order: the pipeline_runs row is created **first**, with `dataset_id = NULL`, `dataset_version_id = NULL`, and the deterministic idempotency key already computed from the generated column. The `UNIQUE(organization_id, idempotency_key)` constraint is the dedup mechanism: an application retry attempts the same INSERT; if a matching row already exists, Postgres raises `23505` and the application looks up and resumes/polls the existing run instead of proceeding. Only after this insert succeeds does the application create `datasets` → `dataset_versions` and `UPDATE pipeline_runs SET dataset_id = ..., dataset_version_id = ...`.

**"Processing fails before a dataset version exists":** with this ordering, that failure now has a `pipeline_runs` row to record it against — `status = 'failed'`, `failure_stage` set to whichever `ProcessingStage` (Phase 1 `errors.ts` vocabulary) the failure occurred in, `dataset_id` and `dataset_version_id` left `NULL`. This is a real, queryable, non-silent failure state that did not exist before this migration.

**`retry_of` semantics, defined precisely:** two distinct kinds of "retry" exist, and only one of them reuses the idempotency key:
- **Automatic/transport retry** (the same user action, retried by the client due to a network blip, e.g. `invokeWithRetry`): the SAME `client_attempt_key` is reused, so the SAME `idempotency_key` is generated, and the unique constraint prevents a second row outright. `retry_of` is not set for this case — there is only ever one row.
- **Manual retry** (the user sees a failed import and explicitly clicks "Retry" after the fact, potentially with a re-selected file or edited mapping): a **new** `client_attempt_key` is generated client-side, producing a **new** `idempotency_key` and a **new** row, with `retry_of` pointing at the prior failed run. This is deliberate lineage tracking of a distinct user action, not deduplication.

## New tables

All six carry `organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE` (checked directly by RLS with no join) and a nullable `workspace_id uuid REFERENCES public.workspaces(id)`, exactly as the first draft proposed. This revision adds, to every one of them: a `UNIQUE(id, organization_id)` constraint (so they can each be a composite-FK target for whatever the next table down references them), and composite (not plain) foreign keys on every parent reference.

### 1. `public.dataset_schema_versions`

```sql
CREATE TABLE public.dataset_schema_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id),
  dataset_id uuid NOT NULL,
  dataset_version_id uuid NOT NULL,
  pipeline_run_id uuid NOT NULL,
  schema_version_number integer NOT NULL CHECK (schema_version_number > 0),
  field_count integer NOT NULL CHECK (field_count >= 0),
  schema_checksum text NOT NULL,
  previous_schema_version_id uuid,
  drift_status text NOT NULL DEFAULT 'initial'
    CHECK (drift_status IN ('initial', 'no_drift', 'informational', 'warning', 'breaking', 'security_sensitive')),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dataset_schema_versions_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT dataset_schema_versions_dataset_version_unique UNIQUE (dataset_id, schema_version_number),
  CONSTRAINT dataset_schema_versions_dataset_org_fk
    FOREIGN KEY (dataset_id, organization_id) REFERENCES public.datasets (id, organization_id),
  CONSTRAINT dataset_schema_versions_version_org_fk
    FOREIGN KEY (dataset_version_id, organization_id) REFERENCES public.dataset_versions (id, organization_id),
  CONSTRAINT dataset_schema_versions_run_org_fk
    FOREIGN KEY (pipeline_run_id, organization_id) REFERENCES public.pipeline_runs (id, organization_id),
  CONSTRAINT dataset_schema_versions_previous_org_fk
    FOREIGN KEY (previous_schema_version_id, organization_id) REFERENCES public.dataset_schema_versions (id, organization_id)
);

CREATE INDEX idx_dataset_schema_versions_org ON public.dataset_schema_versions (organization_id, dataset_id);
```

Every one of the four foreign keys (`dataset_id`, `dataset_version_id`, `pipeline_run_id`, `previous_schema_version_id`) is composite with `organization_id`, including the **self-referential** one (`previous_schema_version_id`), which requires this table's own `UNIQUE(id, organization_id)` to exist before the self-FK can be declared — satisfied by declaring that constraint earlier in the same `CREATE TABLE` statement (Postgres allows this within one statement).

### 2. `public.dataset_fields`

```sql
CREATE TABLE public.dataset_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id),
  dataset_id uuid NOT NULL,
  schema_version_id uuid NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  sheet_or_table text NOT NULL DEFAULT 'csv',
  original_header text NOT NULL,
  normalized_header text NOT NULL,
  source_location jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (length(source_location::text) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dataset_fields_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT dataset_fields_version_ordinal_unique UNIQUE (schema_version_id, sheet_or_table, ordinal),
  CONSTRAINT dataset_fields_dataset_org_fk
    FOREIGN KEY (dataset_id, organization_id) REFERENCES public.datasets (id, organization_id),
  CONSTRAINT dataset_fields_schema_version_org_fk
    FOREIGN KEY (schema_version_id, organization_id) REFERENCES public.dataset_schema_versions (id, organization_id)
);

CREATE INDEX idx_dataset_fields_org_dataset ON public.dataset_fields (organization_id, dataset_id);
```

### 3. `public.dataset_field_profiles`

```sql
CREATE TABLE public.dataset_field_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id),
  dataset_field_id uuid NOT NULL,
  pipeline_run_id uuid NOT NULL,
  profiler_version text NOT NULL,
  contract_version text NOT NULL,

  profiling_mode text NOT NULL CHECK (profiling_mode IN ('full_scan', 'representative')),
  sampling_strategy jsonb NOT NULL CHECK (length(sampling_strategy::text) <= 2000),
  sample_size integer NOT NULL CHECK (sample_size >= 0),
  row_coverage numeric NOT NULL CHECK (row_coverage >= 0 AND row_coverage <= 1),

  null_rate numeric NOT NULL CHECK (null_rate >= 0 AND null_rate <= 1),
  distinct_count integer NOT NULL CHECK (distinct_count >= 0),
  numeric_rate numeric NOT NULL CHECK (numeric_rate >= 0 AND numeric_rate <= 1),
  date_rate numeric NOT NULL CHECK (date_rate >= 0 AND date_rate <= 1),
  boolean_rate numeric NOT NULL CHECK (boolean_rate >= 0 AND boolean_rate <= 1),
  identifier_likelihood numeric NOT NULL CHECK (identifier_likelihood >= 0 AND identifier_likelihood <= 1),
  pii_likelihood numeric NOT NULL CHECK (pii_likelihood >= 0 AND pii_likelihood <= 1),

  detected_formats text[] NOT NULL DEFAULT '{}'
    CHECK (array_length(detected_formats, 1) IS NULL OR array_length(detected_formats, 1) <= 10),

  -- PII control (mission item 7): bounded count AND per-element length,
  -- plus an explicit, DB-enforced rule that a high-PII-likelihood field
  -- cannot be persisted with unredacted samples.
  representative_values text[] NOT NULL DEFAULT '{}'
    CHECK (array_length(representative_values, 1) IS NULL OR array_length(representative_values, 1) <= 20)
    CHECK (public.array_max_text_length(representative_values) <= 40),
  redaction_status text NOT NULL DEFAULT 'not_required'
    CHECK (redaction_status IN ('not_required', 'masked', 'omitted')),
  redaction_method text,

  anomalies text[] NOT NULL DEFAULT '{}'
    CHECK (array_length(anomalies, 1) IS NULL OR array_length(anomalies, 1) <= 20),

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dataset_field_profiles_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT dataset_field_profiles_field_run_version_unique
    UNIQUE (dataset_field_id, pipeline_run_id, profiler_version),
  CONSTRAINT dataset_field_profiles_field_org_fk
    FOREIGN KEY (dataset_field_id, organization_id) REFERENCES public.dataset_fields (id, organization_id),
  CONSTRAINT dataset_field_profiles_run_org_fk
    FOREIGN KEY (pipeline_run_id, organization_id) REFERENCES public.pipeline_runs (id, organization_id),
  CONSTRAINT dataset_field_profiles_pii_redaction_required
    CHECK (pii_likelihood < 0.5 OR redaction_status <> 'not_required')
);

CREATE INDEX idx_dataset_field_profiles_org ON public.dataset_field_profiles (organization_id);
```

`array_max_text_length` is a small helper function (defined once, used here and in the evidence table below):

```sql
CREATE OR REPLACE FUNCTION public.array_max_text_length(_arr text[])
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(MAX(length(elem)), 0) FROM unnest(_arr) AS elem;
$$;
```

The `dataset_field_profiles_pii_redaction_required` CHECK is the concrete, DB-enforced answer to "persist no raw representative values for high-likelihood PII unless irreversibly masked": it is **not possible** to insert a row with `pii_likelihood >= 0.5` and `redaction_status = 'not_required'` — the insert is rejected regardless of what the application layer intended. `redaction_status = 'omitted'` is the expected value when the application chooses not to persist any samples at all for a flagged field (safest option); `'masked'` when a one-way-masked representative sample is kept (e.g. `j***@example.com`) — `redaction_method` records which masking function produced it, for audit purposes, never the reverse mapping.

### 4. `public.dataset_field_mapping_proposals`

```sql
CREATE TABLE public.dataset_field_mapping_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id),
  dataset_field_id uuid NOT NULL,
  pipeline_run_id uuid NOT NULL,
  proposal_kind text NOT NULL CHECK (proposal_kind IN ('physical_type', 'structural_role', 'semantic_concept')),
  proposed_value text NOT NULL CHECK (length(proposed_value) <= 200),
  evidence_score numeric NOT NULL CHECK (evidence_score >= 0 AND evidence_score <= 100),
  mapping_method text NOT NULL,
  rule_or_model_version text NOT NULL,
  contract_version text NOT NULL,
  alternatives_considered text[] NOT NULL DEFAULT '{}'
    CHECK (array_length(alternatives_considered, 1) IS NULL OR array_length(alternatives_considered, 1) <= 10),
  review_required boolean NOT NULL,
  state text NOT NULL DEFAULT 'proposed'
    CHECK (state IN ('proposed', 'accepted', 'rejected', 'edited', 'unknown', 'superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dataset_field_mapping_proposals_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT dataset_field_mapping_proposals_field_kind_run_version_unique
    UNIQUE (dataset_field_id, proposal_kind, pipeline_run_id, rule_or_model_version),
  CONSTRAINT dataset_field_mapping_proposals_field_org_fk
    FOREIGN KEY (dataset_field_id, organization_id) REFERENCES public.dataset_fields (id, organization_id),
  CONSTRAINT dataset_field_mapping_proposals_run_org_fk
    FOREIGN KEY (pipeline_run_id, organization_id) REFERENCES public.pipeline_runs (id, organization_id)
);

CREATE INDEX idx_mapping_proposals_field ON public.dataset_field_mapping_proposals (dataset_field_id, proposal_kind);
CREATE INDEX idx_mapping_proposals_org ON public.dataset_field_mapping_proposals (organization_id);
CREATE INDEX idx_mapping_proposals_review_required
  ON public.dataset_field_mapping_proposals (organization_id, review_required) WHERE review_required = true;
```

`rule_or_model_version` doubles as "inference version" for the uniqueness requirement (mission item 5) — no separate column, since the Phase 1 contract already names this field `ruleOrModelVersion` and using the same name end-to-end avoids a redundant, driftable duplicate.

### 5. `public.dataset_field_mapping_evidence`

```sql
CREATE TABLE public.dataset_field_mapping_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mapping_proposal_id uuid NOT NULL,
  evidence_type text NOT NULL,
  description text NOT NULL CHECK (length(description) <= 500),
  source_location jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (length(source_location::text) <= 1000),
  observed_statistic text NOT NULL CHECK (length(observed_statistic) <= 500),
  rule_or_method text NOT NULL,
  contract_version text NOT NULL,
  weight numeric NOT NULL CHECK (weight >= 0 AND weight <= 1),
  stance text NOT NULL CHECK (stance IN ('supporting', 'contradicting', 'neutral')),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dataset_field_mapping_evidence_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT dataset_field_mapping_evidence_proposal_org_fk
    FOREIGN KEY (mapping_proposal_id, organization_id) REFERENCES public.dataset_field_mapping_proposals (id, organization_id),
  -- Cheap, deliberately narrow defense-in-depth guard against an obvious
  -- raw email ending up in a field that is supposed to carry only a short
  -- descriptive statistic. Not a general PII scanner (that lives in the
  -- application layer, see the plan document) -- this only catches the
  -- single, unambiguous, zero-false-positive-risk pattern of a bare email
  -- address, so it cannot block legitimate evidence text.
  CONSTRAINT dataset_field_mapping_evidence_no_raw_email
    CHECK (description !~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
       AND observed_statistic !~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
);

CREATE INDEX idx_mapping_evidence_proposal ON public.dataset_field_mapping_evidence (mapping_proposal_id);
CREATE INDEX idx_mapping_evidence_org ON public.dataset_field_mapping_evidence (organization_id);
```

No `dataset_field_id`/`pipeline_run_id` composite FK is needed directly on this table — it reaches both transitively through `mapping_proposal_id`, and Postgres composite FKs don't support "reach-through" validation, so redundant direct columns would need their own FKs to stay consistent for no added safety; the single FK to `dataset_field_mapping_proposals(id, organization_id)` is sufficient because that table already enforces its own field/run/org consistency.

### 6. `public.dataset_field_mapping_decisions`

```sql
CREATE TABLE public.dataset_field_mapping_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id),
  dataset_field_id uuid NOT NULL,
  proposal_kind text NOT NULL CHECK (proposal_kind IN ('physical_type', 'structural_role', 'semantic_concept')),
  mapping_proposal_id uuid,
  decision text NOT NULL CHECK (decision IN ('accepted', 'rejected', 'edited', 'marked_unknown')),
  final_value text CHECK (final_value IS NULL OR length(final_value) <= 200),
  reason text CHECK (reason IS NULL OR length(reason) <= 500),
  reviewer_id uuid NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  supersedes_decision_id uuid,
  decision_version integer NOT NULL, -- set by trigger, not by the application

  CONSTRAINT dataset_field_mapping_decisions_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT dataset_field_mapping_decisions_field_kind_version_unique
    UNIQUE (dataset_field_id, proposal_kind, decision_version),
  CONSTRAINT dataset_field_mapping_decisions_final_value_required
    CHECK ((decision IN ('accepted', 'edited') AND final_value IS NOT NULL) OR decision IN ('rejected', 'marked_unknown')),
  CONSTRAINT dataset_field_mapping_decisions_field_org_fk
    FOREIGN KEY (dataset_field_id, organization_id) REFERENCES public.dataset_fields (id, organization_id),
  CONSTRAINT dataset_field_mapping_decisions_proposal_org_fk
    FOREIGN KEY (mapping_proposal_id, organization_id) REFERENCES public.dataset_field_mapping_proposals (id, organization_id),
  CONSTRAINT dataset_field_mapping_decisions_supersedes_org_fk
    FOREIGN KEY (supersedes_decision_id, organization_id) REFERENCES public.dataset_field_mapping_decisions (id, organization_id)
);

CREATE INDEX idx_mapping_decisions_field ON public.dataset_field_mapping_decisions (dataset_field_id, proposal_kind, decision_version DESC);
CREATE INDEX idx_mapping_decisions_org ON public.dataset_field_mapping_decisions (organization_id);
```

**Append-only current-state mechanism (control 4), fully worked through:**

`decision_version` is `NOT NULL` but has no application-supplied value or simple `DEFAULT` — it is set by a `BEFORE INSERT` trigger:

```sql
CREATE OR REPLACE FUNCTION public.set_mapping_decision_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _next_version integer;
BEGIN
  -- Advisory lock scoped to this (field, proposal_kind) pair for the
  -- duration of the transaction, so two concurrent decisions on the same
  -- field/kind can't both compute the same "next" version. hashtextextended
  -- takes a seed to reduce collision risk with unrelated advisory locks
  -- used elsewhere in this schema.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.dataset_field_id::text || ':' || NEW.proposal_kind, 42));

  SELECT COALESCE(MAX(decision_version), 0) + 1 INTO _next_version
  FROM public.dataset_field_mapping_decisions
  WHERE dataset_field_id = NEW.dataset_field_id AND proposal_kind = NEW.proposal_kind;

  NEW.decision_version := _next_version;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_mapping_decision_version
  BEFORE INSERT ON public.dataset_field_mapping_decisions
  FOR EACH ROW EXECUTE FUNCTION public.set_mapping_decision_version();
```

The advisory lock is released automatically at transaction end (`pg_advisory_xact_lock`, not the session-scoped variant), so it cannot leak across requests. The `UNIQUE(dataset_field_id, proposal_kind, decision_version)` constraint is the enforced backstop even if the locking logic were ever bypassed (e.g. a future direct `INSERT ... OVERRIDING SYSTEM VALUE`-style edge case): a genuine race would surface as a `23505` unique-violation on the losing transaction, which the application retries — the same optimistic-concurrency pattern used for the idempotency key, applied consistently rather than inventing a second pattern.

**Deterministic "current mapping" query — a view, not an ad-hoc query scattered across the application:**

```sql
CREATE VIEW public.dataset_field_current_mapping AS
SELECT DISTINCT ON (dataset_field_id, proposal_kind)
  dataset_field_id, proposal_kind, decision, final_value, reason,
  reviewer_id, decided_at, decision_version, id AS decision_id
FROM public.dataset_field_mapping_decisions
ORDER BY dataset_field_id, proposal_kind, decision_version DESC;
```

Ordering by `decision_version DESC` (a strictly-increasing, trigger-enforced integer with a uniqueness guarantee per group) rather than `decided_at DESC` is what makes this deterministic — timestamps can tie under concurrent writes or clock skew; the version number cannot, by construction. The view inherits the underlying table's RLS (Postgres views run with the invoking user's permissions by default, and this view is not declared `SECURITY DEFINER`), so it requires no separate RLS policy of its own.

**"Prevent duplicate decision versions and ambiguous simultaneous current decisions":** the `UNIQUE` constraint prevents duplicates outright; the view's `DISTINCT ON` ordering guarantees exactly one "current" row per `(dataset_field_id, proposal_kind)` is ever returned, so "ambiguous simultaneous current decisions" is structurally impossible to observe through this view even if it were somehow possible to create in the base table (which the constraint also prevents).

## Cross-tenant foreign-key integrity — mechanism per relationship (control 2)

Every relationship in this schema uses the **composite foreign key** mechanism: the referenced (parent) table carries `UNIQUE(id, organization_id)`, and the referencing (child) column pair is `FOREIGN KEY (parent_id, organization_id) REFERENCES parent(id, organization_id)`. This was chosen over the two alternatives the review raised, for these reasons:

- **Chosen: composite FK.** Declarative, enforced by the Postgres engine itself on every INSERT/UPDATE regardless of which code path (application, Edge Function, future backfill job, manual `psql` session under a role that isn't `service_role`) performs the write. No trigger to forget to attach, no function to forget to call. The only cost is one extra `UNIQUE` index per table (already needed for the PK in most cases, so the marginal cost is one more index using the same columns plus `organization_id`).
- **Considered, not chosen: tenant-validation trigger per table.** Equivalent enforcement power, but six more trigger functions to write, test, and keep in sync with the composite-FK approach chosen for `dataset_versions`/`pipeline_runs` already — mixing two mechanisms for the same problem is more surface area to audit, not less.
- **Considered, not chosen: tightly-scoped SECURITY DEFINER validation functions called from RLS `WITH CHECK`.** This is the mechanism used *in addition* for `dataset_field_mapping_decisions` (via `can_decide_mapping()`), because that specific case needs *authorization* logic (elevated role for PII) that a plain FK can't express — but for pure tenant-consistency (not authorization), a composite FK is strictly stronger: an RLS `WITH CHECK` only runs for the specific role/policy it's attached to and can, in principle, be bypassed by `service_role` (which bypasses RLS by default, per this schema's existing convention) or a future policy misconfiguration; a `FOREIGN KEY` constraint applies unconditionally to every writer, including `service_role`.

| Relationship | Mechanism |
|---|---|
| `dataset_versions.dataset_id` → `datasets` | Composite FK `(dataset_id, organization_id)` |
| `pipeline_runs.dataset_id` → `datasets` | Composite FK `(dataset_id, organization_id)`, nullable |
| `pipeline_runs.dataset_version_id` → `dataset_versions` | Composite FK, nullable |
| `pipeline_runs.retry_of` → `pipeline_runs` (self) | Composite FK, nullable |
| `dataset_schema_versions.dataset_id` → `datasets` | Composite FK |
| `dataset_schema_versions.dataset_version_id` → `dataset_versions` | Composite FK |
| `dataset_schema_versions.pipeline_run_id` → `pipeline_runs` | Composite FK |
| `dataset_schema_versions.previous_schema_version_id` → `dataset_schema_versions` (self) | Composite FK, nullable |
| `dataset_fields.dataset_id` → `datasets` | Composite FK |
| `dataset_fields.schema_version_id` → `dataset_schema_versions` | Composite FK |
| `dataset_field_profiles.dataset_field_id` → `dataset_fields` | Composite FK |
| `dataset_field_profiles.pipeline_run_id` → `pipeline_runs` | Composite FK |
| `dataset_field_mapping_proposals.dataset_field_id` → `dataset_fields` | Composite FK |
| `dataset_field_mapping_proposals.pipeline_run_id` → `pipeline_runs` | Composite FK |
| `dataset_field_mapping_evidence.mapping_proposal_id` → `dataset_field_mapping_proposals` | Composite FK (reaches field/run transitively — see table 5's note) |
| `dataset_field_mapping_decisions.dataset_field_id` → `dataset_fields` | Composite FK |
| `dataset_field_mapping_decisions.mapping_proposal_id` → `dataset_field_mapping_proposals` | Composite FK, nullable |
| `dataset_field_mapping_decisions.supersedes_decision_id` → `dataset_field_mapping_decisions` (self) | Composite FK, nullable |
| **Authorization** for `dataset_field_mapping_decisions` INSERT | `can_decide_mapping()` SECURITY DEFINER function (not a plain FK — see "Write authorization" below) |

## Write authorization (control 3)

Verified: `is_org_member(_user_id, _org_id)` (`supabase/migrations/20260222210806...sql:21-28`) checks only `organization_members` — ordinary membership, any role. `exec_require_elevated_role(_user_id, _org_id)` (`supabase/migrations/20260406234653_b12ef3a5-0852-4c54-9d13-5f8f4d61898e.sql:3-15`) additionally requires `role IN ('owner', 'admin')`. This schema reuses both, deliberately choosing which for which table:

- **`dataset_schema_versions`, `dataset_fields`, `dataset_field_profiles`, `dataset_field_mapping_proposals`, `dataset_field_mapping_evidence`: `is_org_member` suffices for INSERT.** These rows are system-generated as a direct byproduct of an upload any org member is already allowed to perform (the existing `datasets`/`dataset_versions` INSERT policies require only `is_org_member` + `created_by = auth.uid()` — this schema does not raise the bar beyond what uploading itself already requires).
- **`dataset_field_mapping_decisions`: requires `can_decide_mapping()`, a new SECURITY DEFINER function.** A decision is a direct human judgment call, and per the mission's instruction to "reuse existing owner/admin/data-role checks... for sensitive mapping approval," a decision on a field ever profiled with `pii_likelihood >= 0.5` requires `exec_require_elevated_role` (owner/admin), not just membership. Non-PII-flagged fields still only require `is_org_member` — this is not a blanket elevation of every decision, only the ones the mission specifically calls "sensitive mapping approval."

```sql
CREATE OR REPLACE FUNCTION public.can_decide_mapping(_user_id uuid, _org_id uuid, _dataset_field_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _is_member boolean;
  _ever_pii_flagged boolean;
BEGIN
  SELECT public.is_org_member(_user_id, _org_id) INTO _is_member;
  IF NOT _is_member THEN
    RETURN false;
  END IF;

  -- Conservative by design: if ANY profile run ever flagged this field as
  -- likely PII, elevated approval is required going forward, even if a
  -- later re-profile scored it lower -- a field doesn't get easier to
  -- approve just because a later sample happened to look cleaner.
  SELECT EXISTS (
    SELECT 1 FROM public.dataset_field_profiles p
    WHERE p.dataset_field_id = _dataset_field_id
      AND p.organization_id = _org_id
      AND p.pii_likelihood >= 0.5
  ) INTO _ever_pii_flagged;

  IF _ever_pii_flagged THEN
    RETURN public.exec_require_elevated_role(_user_id, _org_id);
  END IF;

  RETURN true;
END;
$$;
```

## Uniqueness and retry safety (control 5) — full list

| What | Constraint | Table |
|---|---|---|
| Schema version numbers per dataset | `UNIQUE(dataset_id, schema_version_number)` | `dataset_schema_versions` |
| Field ordinal per schema version + sheet/table | `UNIQUE(schema_version_id, sheet_or_table, ordinal)` | `dataset_fields` |
| Profile per field, run, **and profiler version** | `UNIQUE(dataset_field_id, pipeline_run_id, profiler_version)` | `dataset_field_profiles` |
| Proposal per field, kind, run, **and inference (rule/model) version** | `UNIQUE(dataset_field_id, proposal_kind, pipeline_run_id, rule_or_model_version)` | `dataset_field_mapping_proposals` |
| Decision version per field + proposal kind | `UNIQUE(dataset_field_id, proposal_kind, decision_version)`, version assigned by trigger | `dataset_field_mapping_decisions` |
| Ingestion run per (org, idempotency key) | `UNIQUE(organization_id, idempotency_key)`, key deterministic via generated column | `pipeline_runs` |
| **Metric records** | **Already exists, confirmed, unchanged:** `metrics_unique_series UNIQUE(organization_id, metric_type, date, region, segment, source_id)` (`supabase/migrations/20260304093013_009d4f36-ea40-455c-a22c-3d826ce8b6a7.sql:21-23`), and `DataUpload.tsx:811` already upserts against exactly this conflict target (`onConflict: "organization_id,metric_type,date,region,segment,source_id"`). A retried import that reaches the metrics-write stage twice already cannot create duplicate metric rows — this was verified against the real code, not assumed. |

With the idempotency key preventing a second `pipeline_runs` row for the same attempt, and every downstream table's uniqueness keyed through `pipeline_run_id`, a retry that reuses the same run cannot create duplicate schema versions, fields, profiles, proposals, or evidence either — they are all scoped to the one run that was (or wasn't) actually allowed to proceed.

## PII safety (control 7) — summary

Covered in detail within tables 3 and 5 above; consolidated here:

1. **Length + count bound**, not count alone: `array_max_text_length(representative_values) <= 40` in addition to `array_length(...) <= 20`.
2. **`redaction_status`/`redaction_method` columns**, with a hard `CHECK` preventing `pii_likelihood >= 0.5` from coexisting with `redaction_status = 'not_required'`.
3. **No raw PII in evidence**: `dataset_field_mapping_evidence` carries no value-bearing field beyond the bounded, application-redacted `observed_statistic`/`description`, plus a narrow regex `CHECK` rejecting an obvious bare email as defense-in-depth.
4. **No raw PII in structured errors or logs**: this schema does not persist a dedicated errors table in Phase 2 (`pipeline_runs.error_message` remains free text, unchanged) — the application-layer requirement that `ProcessingError.rawValueIfSafe` (Phase 1 contract) is only ever populated when the field is confirmed *not* PII-likely is documented in the plan document as a hold-the-line requirement for the integration phase, not encoded here as a DB constraint (a general free-text error message is not a good CHECK-regex target without unacceptable false-positive risk).
5. **Required test fixtures** (English + German false positives and true positives) are specified precisely in the plan document's "PII test requirements" section — not implemented as executable tests in this document-and-schema-only phase, since there is no redaction function yet to test against; they are the acceptance criteria the integration phase's redaction implementation must satisfy.

## Controlled values and JSON bounds (control 8) — consolidated

| Table.column | Control |
|---|---|
| `dataset_versions.canonical_metadata_status` | `CHECK IN (4 values)` |
| `pipeline_runs.status` | `CHECK IN (7 values)`, added `NOT VALID`, validated after preflight |
| `pipeline_runs.locale_source` | `CHECK IN (6 values)` |
| `dataset_schema_versions.drift_status` | `CHECK IN (6 values)` |
| `dataset_field_profiles.profiling_mode` | `CHECK IN (2 values)` |
| `dataset_field_profiles.redaction_status` | `CHECK IN (3 values)` |
| `dataset_field_mapping_proposals.proposal_kind` | `CHECK IN (3 values)` |
| `dataset_field_mapping_proposals.state` | `CHECK IN (6 values)` |
| `dataset_field_mapping_evidence.stance` | `CHECK IN (3 values)` |
| `dataset_field_mapping_decisions.decision` | `CHECK IN (4 values)` |
| `dataset_field_mapping_decisions.proposal_kind` | `CHECK IN (3 values)` |
| `organizations.default_locale` | `CHECK` (BCP-47-shaped regex) |
| Every `jsonb` column (`source_location`, `sampling_strategy`) | `CHECK (length(col::text) <= N)` |
| Every `text[]` column | `CHECK (array_length(...) <= N)`, plus per-element length where the array can carry PII-adjacent content |
| Every free-text field carrying a proposed/final value or reason | `CHECK (length(...) <= N)` |

Every jsonb/array/free-text column in the six new tables has an explicit bound — none is left as an unrestricted secondary raw-data store, per instruction. `contract_version text NOT NULL` is added to `dataset_field_profiles`, `dataset_field_mapping_proposals`, and `dataset_field_mapping_evidence` (the three tables whose shape is directly derived from `src/lib/ingestion-contracts` Zod schemas), so a future contract-version bump is traceable per row without needing to infer it from `created_at` ranges.

## Locale (control 9) — consolidated

- `organizations.default_locale`: nullable, BCP-47-shaped `CHECK`, a **hint** only.
- `pipeline_runs.detected_locale`, `.selected_locale`, `.locale_source`, `.locale_ambiguous`: the actual per-run record. `selected_locale` is the ingestion-level override point (mission's explicit requirement) — it can differ from both `detected_locale` and `organizations.default_locale`, and `locale_source` records which of the two (or neither, if the user explicitly overrode) actually won.
- No column here changes how `parseMessyDate`/`parseMessyNumber` behave (still parity-tested, unchanged) — the locale fields are inputs to the *review-required* decision the new inference layer makes when it encounters an ambiguous date, exactly as described in the plan document's locale section, not a new parsing code path.

## Migration validation and rollback (control 10)

Full preflight, verification, and rollback SQL is provided as separate artifacts, not narrative-only:

- **Forward migration**: `supabase/migrations/20260717120000_phase2_structured_ingestion_persistence.sql` — **written, not applied.**
- **Rollback script**: `supabase/rollback/20260717120000_phase2_structured_ingestion_persistence_rollback.sql` — deliberately placed **outside** `supabase/migrations/` so Supabase's migration tooling never auto-applies it; it is a manually-invoked artifact only.

**Rollback explicitly deletes any metadata collected after deployment.** Dropping the six new tables destroys every schema-version, field, profile, proposal, evidence, and decision row created since the migration was applied — there is no way to roll back the schema without losing that data, because it has nowhere else to live. This is stated plainly in the rollback script's header and must be acknowledged before it is ever run against a database with real post-deployment data in these tables. Rolling back the `pipeline_runs`/`dataset_versions`/`organizations` column additions is non-destructive to pre-existing data (those columns are additive; dropping them only discards the new columns' values, not any pre-existing column).

Preflight, post-migration, and RLS verification queries are included at the top of the forward migration file as commented SQL blocks (run manually before/after applying, not executed automatically as part of the migration itself) — see the file for the literal queries, summarized here:

- **Preflight**: `SELECT DISTINCT status FROM pipeline_runs` (must be a subset of the 7 allowed values before `VALIDATE CONSTRAINT` is run), confirm `is_org_member`/`exec_require_elevated_role` exist with the expected signatures, confirm none of the 6 new table names already exist.
- **Post-migration**: row counts on all touched tables unchanged for pre-existing tables; `SELECT relrowsecurity FROM pg_class WHERE relname IN (...)` all `true`; `SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN (...)` shows exactly SELECT+INSERT policies (no UPDATE/DELETE) on all six new tables.
- **RLS verification**: representative cross-tenant probes using two seeded test users in different organizations, run under `SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = '{"sub": "<user-id>"}'`-style impersonation (the standard Supabase local-testing pattern), asserting a SELECT/INSERT against another org's rows returns zero rows / a policy violation.

### Validation actually performed before presenting this proposal

Both the forward migration and the rollback script were **executed against a disposable local Postgres 16 instance** (not the remote Quantivis project — no network access to it exists in this session, and it would not have been run there regardless without approval) seeded with a minimal stub of the real pre-existing schema (`organizations`, `workspaces`, `organization_members`, `datasets`, `dataset_versions`, `pipeline_runs`, `is_org_member`, `exec_require_elevated_role`, matching the actual column shapes verified from `supabase/migrations/*.sql`). This caught and fixed one real ordering bug (the `dataset_versions` → `datasets` composite FK was originally sequenced before the `datasets.id_org_unique` constraint it depends on existed) that a read-through alone had not caught.

Beyond confirming the DDL applies without error, six behavioral smoke tests were run against the applied schema and all six passed:

1. Two `pipeline_runs` inserts with identical `(org, client_attempt_key, source_checksum, parser_version, import_config_hash)` — first succeeds, second correctly rejected with `23505` on `pipeline_runs_org_idempotency_unique`.
2. The same four inputs except a different `import_config_hash` — both inserts succeed (a real mapping-configuration change correctly produces a new key rather than being deduplicated away).
3. A `dataset_field_profiles` insert with `pii_likelihood = 0.9` and `redaction_status = 'not_required'` — correctly rejected by `dataset_field_profiles_pii_redaction_required`; the same row with `redaction_status = 'masked'` succeeds.
4. A `dataset_schema_versions` insert claiming `organization_id = A` while `dataset_id` pointed at a dataset actually owned by organization `B` — correctly rejected by the composite foreign key (`dataset_schema_versions_dataset_org_fk`), independent of any RLS policy, which is the entire point of control 2.
5. A `representative_values` array containing one 41-character element — correctly rejected by `array_max_text_length(representative_values) <= 40`; a 40-character element is correctly accepted (confirms the boundary is exact, not off-by-one).
6. Two sequential decisions on the same `(dataset_field_id, proposal_kind)` — `decision_version` auto-assigned 1 then 2 by the trigger, and `dataset_field_current_mapping` correctly returned only the version-2 row with its edited `final_value`.

The rollback script was then run against the same post-migration database and verified to remove all six tables, remove `idempotency_key`/`client_attempt_key` from `pipeline_runs`, and restore `pipeline_runs.dataset_id` to `NOT NULL` — all confirmed by direct query afterward, not assumed. The scratch database and all temporary files were dropped/deleted afterward; nothing from this validation persists anywhere.

This is real execution evidence, not a claim of correctness from reading alone — but it is still schema-only validation against synthetic stub data, not a test of the application integration code that will actually call these tables (that code doesn't exist yet, per this phase's scope).

## Unresolved decisions carried forward (not blocking this document, but not yet decided)

1. Whether `dataset_field_mapping_decisions.reviewer_id` should itself be constrained to `is_org_member` via a composite FK to `organization_members` — deferred, since `organization_members` is keyed by `(user_id, organization_id)` without its own single-column surrogate `id` suitable for this pattern; the RLS `WITH CHECK` (via `can_decide_mapping`) is the enforcement point instead, which is sufficient but noted as a design asymmetry versus the rest of the schema's FK-first approach.
2. Whether `import_config_hash` should be computed client-side (browser) or server-side (Edge Function) — affects whether a client bug could theoretically produce a wrong hash and defeat dedup for that one attempt (not a tenant-isolation or correctness-of-persisted-data risk, only a dedup-effectiveness risk). Recommend server-side computation in the integration phase; not decided here since it's implementation, not schema.
3. Retention policy for `dataset_field_profiles`/evidence across many re-imports — flagged, not designed, per the first draft's note; still deferred.

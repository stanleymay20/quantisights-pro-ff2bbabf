-- ROLLBACK for supabase/migrations/20260717120000_phase2_structured_ingestion_persistence.sql
--
-- *** DELIBERATELY NOT IN supabase/migrations/ ***
-- Supabase's migration tooling only scans supabase/migrations/. This file
-- lives outside that directory specifically so it is NEVER auto-applied --
-- it must be run manually, deliberately, with the warning below actually
-- read first.
--
-- *** THIS SCRIPT DESTROYS DATA ***
-- Every row in dataset_schema_versions, dataset_fields,
-- dataset_field_profiles, dataset_field_mapping_proposals,
-- dataset_field_mapping_evidence, and dataset_field_mapping_decisions
-- created AFTER the forward migration was applied is deleted by this
-- script and CANNOT be recovered by re-running the forward migration --
-- that only recreates empty tables. There is no other copy of this data
-- anywhere in the system.
--
-- If the forward migration has been applied and the application has
-- started writing rows into these tables (i.e. Phase 2 integration code
-- has shipped and is in use), do NOT run this rollback without first
-- reverting the integration code that depends on these tables/columns --
-- otherwise the running application will start failing on every ingestion
-- attempt the moment these objects disappear.
--
-- Rolling back BEFORE any integration code has shipped (i.e. immediately
-- after applying the forward migration, before Phase 2 §7 onward in
-- docs/implementation/phase-2-structured-ingestion-plan.md begins) is a
-- safe no-op for the running application: nothing reads or writes these
-- objects yet.
--
-- Rolling back the dataset_versions/pipeline_runs/organizations column
-- additions is non-destructive to pre-existing data in those tables --
-- only the NEW columns' values are discarded, no pre-existing column is
-- touched.

BEGIN;

-- ============================================================================
-- Drop new tables (reverse dependency order). CASCADE also drops their
-- indexes, RLS policies, and (for dataset_field_mapping_decisions) the
-- trigger and the dataset_field_current_mapping view.
-- ============================================================================

DROP VIEW IF EXISTS public.dataset_field_current_mapping;

DROP TABLE IF EXISTS public.dataset_field_mapping_decisions CASCADE;
DROP TABLE IF EXISTS public.dataset_field_mapping_evidence CASCADE;
DROP TABLE IF EXISTS public.dataset_field_mapping_proposals CASCADE;
DROP TABLE IF EXISTS public.dataset_field_profiles CASCADE;
DROP TABLE IF EXISTS public.dataset_fields CASCADE;
DROP TABLE IF EXISTS public.dataset_schema_versions CASCADE;

-- ============================================================================
-- Drop helper functions and triggers introduced by the forward migration.
-- (Trigger itself already dropped via CASCADE above with its table; the
-- function definition survives table drops and must be dropped explicitly.)
-- ============================================================================

DROP FUNCTION IF EXISTS public.set_mapping_decision_version();
DROP FUNCTION IF EXISTS public.can_decide_mapping(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.array_max_text_length(text[]);

-- ============================================================================
-- Revert pipeline_runs. Order matters: drop constraints before columns
-- that they depend on; the GENERATED column must be dropped before (or
-- together with) the columns it's derived from, though dropping the
-- column itself is sufficient (Postgres drops a GENERATED column's
-- dependency automatically when the column is dropped, but not when only
-- its source columns are dropped first -- so idempotency_key is dropped
-- explicitly first here for clarity and safety).
-- ============================================================================

ALTER TABLE public.pipeline_runs DROP CONSTRAINT IF EXISTS pipeline_runs_status_check;
ALTER TABLE public.pipeline_runs DROP CONSTRAINT IF EXISTS pipeline_runs_locale_source_check;
ALTER TABLE public.pipeline_runs DROP CONSTRAINT IF EXISTS pipeline_runs_retry_of_org_fk;
ALTER TABLE public.pipeline_runs DROP CONSTRAINT IF EXISTS pipeline_runs_dataset_version_org_fk;
ALTER TABLE public.pipeline_runs DROP CONSTRAINT IF EXISTS pipeline_runs_dataset_org_fk;
ALTER TABLE public.pipeline_runs DROP CONSTRAINT IF EXISTS pipeline_runs_id_org_unique;
ALTER TABLE public.pipeline_runs DROP CONSTRAINT IF EXISTS pipeline_runs_org_idempotency_unique;

ALTER TABLE public.pipeline_runs DROP COLUMN IF EXISTS idempotency_key;

-- Restore dataset_id NOT NULL. WARNING: if any pipeline_runs row was
-- created post-migration with dataset_id still NULL (a run that failed
-- before a dataset was created -- the whole point of the nullable
-- change), this ALTER TABLE will fail with a not-null violation. Resolve
-- by either deleting those rows (they represent pre-dataset failures with
-- no dataset to restore a reference to) or backfilling a placeholder
-- before running this line -- a decision the operator running the
-- rollback must make deliberately, which is why this is not automated
-- away with a silent DELETE here.
ALTER TABLE public.pipeline_runs ALTER COLUMN dataset_id SET NOT NULL;

ALTER TABLE public.pipeline_runs
  DROP COLUMN IF EXISTS client_attempt_key,
  DROP COLUMN IF EXISTS source_checksum,
  DROP COLUMN IF EXISTS parser_version,
  DROP COLUMN IF EXISTS import_config_hash,
  DROP COLUMN IF EXISTS dataset_version_id,
  DROP COLUMN IF EXISTS run_version,
  DROP COLUMN IF EXISTS failure_stage,
  DROP COLUMN IF EXISTS retry_of,
  DROP COLUMN IF EXISTS detected_locale,
  DROP COLUMN IF EXISTS selected_locale,
  DROP COLUMN IF EXISTS locale_source,
  DROP COLUMN IF EXISTS locale_ambiguous;

-- ============================================================================
-- Revert dataset_versions
-- ============================================================================

ALTER TABLE public.dataset_versions DROP CONSTRAINT IF EXISTS dataset_versions_dataset_org_fk;
ALTER TABLE public.dataset_versions DROP CONSTRAINT IF EXISTS dataset_versions_id_org_unique;
ALTER TABLE public.dataset_versions DROP CONSTRAINT IF EXISTS dataset_versions_canonical_status_check;

ALTER TABLE public.dataset_versions
  DROP COLUMN IF EXISTS mime_type,
  DROP COLUMN IF EXISTS byte_size,
  DROP COLUMN IF EXISTS checksum,
  DROP COLUMN IF EXISTS parser_name,
  DROP COLUMN IF EXISTS parser_version,
  DROP COLUMN IF EXISTS source_timestamp,
  DROP COLUMN IF EXISTS canonical_metadata_status;

-- ============================================================================
-- Revert datasets
-- ============================================================================

ALTER TABLE public.datasets DROP CONSTRAINT IF EXISTS datasets_id_org_unique;

-- ============================================================================
-- Revert organizations
-- ============================================================================

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_default_locale_format;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS default_locale;

COMMIT;

-- Post-rollback verification:
--   SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
--     'dataset_schema_versions', 'dataset_fields', 'dataset_field_profiles',
--     'dataset_field_mapping_proposals', 'dataset_field_mapping_evidence',
--     'dataset_field_mapping_decisions'
--   );
--   -- Expected: zero rows.
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'pipeline_runs' AND column_name IN ('idempotency_key', 'client_attempt_key');
--   -- Expected: zero rows.

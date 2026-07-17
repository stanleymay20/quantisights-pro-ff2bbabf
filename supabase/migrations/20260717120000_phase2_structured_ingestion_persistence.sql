-- Phase 2: structured-ingestion persistence (canonical contracts wiring).
-- See docs/architecture/phase-2-ingestion-persistence-schema.md for full
-- design rationale, and docs/implementation/phase-2-structured-ingestion-plan.md
-- for the production-integration plan this schema supports.
--
-- STATUS: PROPOSED. This file has NOT been applied to the Quantivis
-- database (no network access to it exists in this session regardless).
-- It HAS been test-applied, along with its rollback script, against a
-- disposable local Postgres 16 instance seeded with a stub of the real
-- schema, and six behavioral smoke tests (idempotency dedup, config-change
-- allows a new key, PII redaction backstop, cross-tenant composite-FK
-- rejection, representative_values length cap, decision-version
-- sequencing) all passed. See docs/architecture/phase-2-ingestion-persistence-schema.md,
-- "Validation actually performed before presenting this proposal," for
-- the full account. That local instance and all its data have since been
-- dropped. Do not run this file against the real database without
-- explicit approval.
--
-- Rollback: supabase/rollback/20260717120000_phase2_structured_ingestion_persistence_rollback.sql
-- (deliberately outside supabase/migrations/ so it is never auto-applied).
-- Rollback DESTROYS any dataset_schema_versions/dataset_fields/
-- dataset_field_profiles/dataset_field_mapping_proposals/
-- dataset_field_mapping_evidence/dataset_field_mapping_decisions rows
-- created after this migration is applied -- there is no other copy of
-- that data. See the rollback script header for the full warning.

-- ============================================================================
-- PREFLIGHT (run manually BEFORE applying this migration; not executed
-- automatically as part of it)
-- ============================================================================
--
-- 1. Confirm no unexpected historical pipeline_runs.status values exist
--    (the CHECK constraint below is added NOT VALID and validated in a
--    separate step at the end of this file specifically so this can be
--    checked first without blocking the migration on it):
--
--      SELECT status, count(*) FROM public.pipeline_runs GROUP BY status;
--
--    Expected: only pending, running, completed, failed (per the real
--    write sites cited in the schema doc). If anything else appears,
--    STOP and decide how to handle it (map to an existing value, or add
--    it to the CHECK list) before running the VALIDATE CONSTRAINT
--    statement at the end of this file.
--
-- 2. Confirm the functions this migration depends on exist with the
--    expected signatures:
--
--      SELECT proname, pg_get_function_identity_arguments(oid)
--      FROM pg_proc WHERE proname IN ('is_org_member', 'exec_require_elevated_role');
--
--    Expected: is_org_member(uuid, uuid), exec_require_elevated_role(uuid, uuid).
--
-- 3. Confirm none of the six new table names already exist:
--
--      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
--        'dataset_schema_versions', 'dataset_fields', 'dataset_field_profiles',
--        'dataset_field_mapping_proposals', 'dataset_field_mapping_evidence',
--        'dataset_field_mapping_decisions'
--      );
--
--    Expected: zero rows.
--
-- 4. Record pre-migration row counts for post-migration comparison:
--
--      SELECT 'datasets' t, count(*) FROM public.datasets
--      UNION ALL SELECT 'dataset_versions', count(*) FROM public.dataset_versions
--      UNION ALL SELECT 'pipeline_runs', count(*) FROM public.pipeline_runs
--      UNION ALL SELECT 'metrics', count(*) FROM public.metrics;
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- Step 0: organizations.default_locale
-- ============================================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS default_locale text;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_default_locale_format
  CHECK (default_locale IS NULL OR default_locale ~ '^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$');

-- ============================================================================
-- Shared helper functions
-- ============================================================================

-- Bounds the longest element in a text[] -- used as a PII-adjacent size
-- guard on representative_values (count alone is not a privacy control).
CREATE OR REPLACE FUNCTION public.array_max_text_length(_arr text[])
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(MAX(length(elem)), 0) FROM unnest(_arr) AS elem;
$$;

-- Write-authorization gate for mapping decisions: ordinary membership
-- suffices unless the field has ever been profiled as likely-PII, in
-- which case the existing owner/admin elevated-role check is required.
-- Conservative by design -- see docs/architecture/phase-2-ingestion-persistence-schema.md
-- "Write authorization" for the full rationale, including why this checks
-- "ever flagged" rather than only the latest profile.
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

-- ============================================================================
-- Step 1: datasets -- composite-FK target (must exist before
-- dataset_versions' composite FK below can reference it)
-- ============================================================================

ALTER TABLE public.datasets
  ADD CONSTRAINT datasets_id_org_unique UNIQUE (id, organization_id);

-- ============================================================================
-- Step 1a: dataset_versions -- ingestion-source identity fields
-- ============================================================================

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

-- ============================================================================
-- Step 2: pipeline_runs -- idempotency, run/version linkage, locale
-- ============================================================================

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

-- Backfill for pre-existing rows: explicitly tagged as legacy, never
-- fabricated as if they were real client-supplied values. These rows
-- will never be matched by a real retry (their idempotency_key is
-- deterministic but meaningless -- derived from the row's own id, which
-- no future request will ever supply).
UPDATE public.pipeline_runs
SET client_attempt_key = 'legacy:' || id::text,
    source_checksum    = 'legacy:unknown',
    parser_version      = 'legacy:unknown',
    import_config_hash  = 'legacy:unknown'
WHERE client_attempt_key IS NULL;

ALTER TABLE public.pipeline_runs
  ALTER COLUMN client_attempt_key SET NOT NULL,
  ALTER COLUMN source_checksum SET NOT NULL,
  ALTER COLUMN parser_version SET NOT NULL,
  ALTER COLUMN import_config_hash SET NOT NULL;

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

-- The one non-purely-additive change in this migration: a run must be
-- creatable before a dataset exists, for idempotency dedup to cover the
-- window before any dataset/dataset_version row is created. See the
-- schema document's "Why dataset_id must become nullable" for the full
-- justification, including confirmation (via grep of real write sites)
-- that no existing code assumes this column is always non-null.
ALTER TABLE public.pipeline_runs
  ALTER COLUMN dataset_id DROP NOT NULL;

ALTER TABLE public.pipeline_runs
  ADD CONSTRAINT pipeline_runs_id_org_unique UNIQUE (id, organization_id);

ALTER TABLE public.pipeline_runs
  ADD CONSTRAINT pipeline_runs_dataset_org_fk
  FOREIGN KEY (dataset_id, organization_id) REFERENCES public.datasets (id, organization_id);

ALTER TABLE public.pipeline_runs
  ADD CONSTRAINT pipeline_runs_dataset_version_org_fk
  FOREIGN KEY (dataset_version_id, organization_id) REFERENCES public.dataset_versions (id, organization_id);

ALTER TABLE public.pipeline_runs
  ADD CONSTRAINT pipeline_runs_retry_of_org_fk
  FOREIGN KEY (retry_of, organization_id) REFERENCES public.pipeline_runs (id, organization_id);

ALTER TABLE public.pipeline_runs
  ADD CONSTRAINT pipeline_runs_locale_source_check
  CHECK (locale_source IS NULL OR locale_source IN
    ('user_selected', 'organization_default', 'detected_number_format', 'detected_date_format', 'workbook_metadata', 'unknown'));

-- Retrofitting the pre-existing, previously-unconstrained status column.
-- NOT VALID: does not scan/lock-escalate over existing rows at migration
-- time. Validate separately, after the preflight query above confirms
-- clean data (see the VALIDATE CONSTRAINT statement at the end of this file).
ALTER TABLE public.pipeline_runs
  ADD CONSTRAINT pipeline_runs_status_check
  CHECK (status IN ('pending', 'running', 'completed', 'completed_with_warnings', 'failed', 'cancelled', 'awaiting_review'))
  NOT VALID;

-- ============================================================================
-- Step 3: dataset_schema_versions
-- ============================================================================

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

ALTER TABLE public.dataset_schema_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view dataset schema versions"
  ON public.dataset_schema_versions FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert dataset schema versions"
  ON public.dataset_schema_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ============================================================================
-- Step 4: dataset_fields
-- ============================================================================

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

ALTER TABLE public.dataset_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view dataset fields"
  ON public.dataset_fields FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert dataset fields"
  ON public.dataset_fields FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ============================================================================
-- Step 5: dataset_field_profiles
-- ============================================================================

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

ALTER TABLE public.dataset_field_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view dataset field profiles"
  ON public.dataset_field_profiles FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert dataset field profiles"
  ON public.dataset_field_profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ============================================================================
-- Step 6: dataset_field_mapping_proposals
-- ============================================================================

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

ALTER TABLE public.dataset_field_mapping_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view mapping proposals"
  ON public.dataset_field_mapping_proposals FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert mapping proposals"
  ON public.dataset_field_mapping_proposals FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ============================================================================
-- Step 7: dataset_field_mapping_evidence
-- ============================================================================

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
  CONSTRAINT dataset_field_mapping_evidence_no_raw_email
    CHECK (description !~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
       AND observed_statistic !~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
);

CREATE INDEX idx_mapping_evidence_proposal ON public.dataset_field_mapping_evidence (mapping_proposal_id);
CREATE INDEX idx_mapping_evidence_org ON public.dataset_field_mapping_evidence (organization_id);

ALTER TABLE public.dataset_field_mapping_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view mapping evidence"
  ON public.dataset_field_mapping_evidence FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert mapping evidence"
  ON public.dataset_field_mapping_evidence FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ============================================================================
-- Step 8: dataset_field_mapping_decisions
-- ============================================================================

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
  decision_version integer NOT NULL,

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

-- Append-only current-state versioning: the trigger computes decision_version
-- under an advisory lock scoped to (dataset_field_id, proposal_kind), and the
-- UNIQUE constraint above is the backstop if that lock were ever bypassed.
CREATE OR REPLACE FUNCTION public.set_mapping_decision_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _next_version integer;
BEGIN
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

ALTER TABLE public.dataset_field_mapping_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view mapping decisions"
  ON public.dataset_field_mapping_decisions FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

-- Write authorization for decisions is NOT plain is_org_member -- see
-- can_decide_mapping() above: ordinary members may decide on non-PII
-- fields, but a field ever profiled pii_likelihood >= 0.5 requires
-- exec_require_elevated_role (owner/admin).
CREATE POLICY "Authorized members can insert mapping decisions"
  ON public.dataset_field_mapping_decisions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(auth.uid(), organization_id)
    AND reviewer_id = auth.uid()
    AND public.can_decide_mapping(auth.uid(), organization_id, dataset_field_id)
  );

-- Deterministic "current mapping" view -- ordering by decision_version
-- (strictly increasing, uniquely constrained per group) rather than
-- decided_at avoids any possible tie under concurrent writes or clock
-- skew. Inherits RLS from the base table (not SECURITY DEFINER).
CREATE VIEW public.dataset_field_current_mapping AS
SELECT DISTINCT ON (dataset_field_id, proposal_kind)
  dataset_field_id, proposal_kind, decision, final_value, reason,
  reviewer_id, decided_at, decision_version, id AS decision_id, organization_id
FROM public.dataset_field_mapping_decisions
ORDER BY dataset_field_id, proposal_kind, decision_version DESC;

-- ============================================================================
-- Finalization: validate the NOT VALID status constraint added above.
-- Run the preflight query at the top of this file FIRST; if it reveals a
-- pipeline_runs.status value not in the CHECK list, STOP and resolve that
-- before running this statement -- do not proceed with an unvalidated
-- constraint left in place indefinitely.
-- ============================================================================

ALTER TABLE public.pipeline_runs VALIDATE CONSTRAINT pipeline_runs_status_check;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (run manually AFTER applying; not executed
-- automatically)
-- ============================================================================
--
-- 1. Row counts on pre-existing tables unchanged:
--
--      SELECT 'datasets' t, count(*) FROM public.datasets
--      UNION ALL SELECT 'dataset_versions', count(*) FROM public.dataset_versions
--      UNION ALL SELECT 'pipeline_runs', count(*) FROM public.pipeline_runs
--      UNION ALL SELECT 'metrics', count(*) FROM public.metrics;
--
--    Compare against the preflight counts -- must match exactly (this
--    migration adds columns/tables, it never deletes or updates rows in
--    a way that changes row counts, except the pipeline_runs backfill
--    UPDATE which does not change row count either).
--
-- 2. RLS is enabled on every new table:
--
--      SELECT relname, relrowsecurity FROM pg_class
--      WHERE relname IN (
--        'dataset_schema_versions', 'dataset_fields', 'dataset_field_profiles',
--        'dataset_field_mapping_proposals', 'dataset_field_mapping_evidence',
--        'dataset_field_mapping_decisions'
--      );
--
--    Expected: relrowsecurity = true for all six.
--
-- 3. Exactly the intended policies exist (SELECT + INSERT only; no
--    UPDATE/DELETE on any of the six new tables):
--
--      SELECT tablename, policyname, cmd FROM pg_policies
--      WHERE tablename IN (
--        'dataset_schema_versions', 'dataset_fields', 'dataset_field_profiles',
--        'dataset_field_mapping_proposals', 'dataset_field_mapping_evidence',
--        'dataset_field_mapping_decisions'
--      )
--      ORDER BY tablename, cmd;
--
--    Expected: exactly one SELECT and one INSERT policy per table, no
--    UPDATE or DELETE rows at all.
--
-- 4. Composite foreign keys exist as designed:
--
--      SELECT conname, conrelid::regclass, confrelid::regclass
--      FROM pg_constraint
--      WHERE contype = 'f' AND conname LIKE '%_org_fk'
--      ORDER BY conrelid::regclass::text;
--
--    Expected: one row per relationship in the "Cross-tenant foreign-key
--    integrity" table in docs/architecture/phase-2-ingestion-persistence-schema.md.
--
-- 5. Idempotency key is actually deterministic (manual smoke test, run in
--    a transaction and roll back -- do not leave test rows behind):
--
--      BEGIN;
--      INSERT INTO public.pipeline_runs (organization_id, dataset_id, client_attempt_key, source_checksum, parser_version, import_config_hash)
--      VALUES ('<real org id>', NULL, 'test-attempt-1', 'checksum-a', 'canonical:v1', 'config-hash-a')
--      RETURNING idempotency_key;
--      -- re-running the identical INSERT in a new statement should raise
--      -- 23505 on pipeline_runs_org_idempotency_unique, not succeed:
--      INSERT INTO public.pipeline_runs (organization_id, dataset_id, client_attempt_key, source_checksum, parser_version, import_config_hash)
--      VALUES ('<real org id>', NULL, 'test-attempt-1', 'checksum-a', 'canonical:v1', 'config-hash-a');
--      ROLLBACK;
--
-- 6. PII redaction backstop rejects an unredacted high-PII-likelihood
--    profile (manual smoke test, transaction rolled back):
--
--      BEGIN;
--      -- requires a valid dataset_field_id and pipeline_run_id fixture;
--      -- expected to fail with dataset_field_profiles_pii_redaction_required
--      INSERT INTO public.dataset_field_profiles (
--        organization_id, dataset_field_id, pipeline_run_id, profiler_version, contract_version,
--        profiling_mode, sampling_strategy, sample_size, row_coverage,
--        null_rate, distinct_count, numeric_rate, date_rate, boolean_rate,
--        identifier_likelihood, pii_likelihood, redaction_status
--      ) VALUES (
--        '<real org id>', '<real dataset_field id>', '<real pipeline_run id>', 'v1', '1.0.0',
--        'full_scan', '{}'::jsonb, 10, 1,
--        0, 5, 0, 0, 0,
--        0, 0.9, 'not_required'
--      );
--      ROLLBACK;
-- ============================================================================

-- ============================================================================
-- RLS VERIFICATION (run manually AFTER applying, using two seeded test
-- users in different organizations; standard Supabase local-testing
-- impersonation pattern -- not executed automatically)
-- ============================================================================
--
-- SET LOCAL ROLE authenticated;
-- SET LOCAL request.jwt.claims = '{"sub": "<tenant-A-user-id>"}';
-- -- Attempt to read tenant B's rows: must return zero rows, not an error
-- -- (RLS filters rather than raising, by design).
-- SELECT * FROM public.dataset_fields WHERE organization_id = '<tenant-B-org-id>';
--
-- -- Attempt to insert a row claiming tenant A's organization_id but
-- -- pointing dataset_id at a dataset actually owned by tenant B: must be
-- -- rejected by the composite FK (23503), independent of RLS.
-- INSERT INTO public.dataset_fields (organization_id, dataset_id, schema_version_id, ordinal, original_header, normalized_header)
-- VALUES ('<tenant-A-org-id>', '<tenant-B-dataset-id>', '<any schema_version_id>', 0, 'x', 'x');
--
-- -- Attempt to insert a mapping decision on a PII-flagged field as an
-- -- ordinary (non-owner/admin) member: must be rejected by can_decide_mapping().
-- INSERT INTO public.dataset_field_mapping_decisions (organization_id, dataset_field_id, proposal_kind, decision, final_value, reviewer_id)
-- VALUES ('<tenant-A-org-id>', '<pii-flagged-field-id>', 'semantic_concept', 'accepted', 'revenue', '<tenant-A-user-id>');
-- ============================================================================

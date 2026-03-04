
-- =====================================================
-- DATA LAKE ARCHITECTURE: Raw → Clean → Analytical
-- =====================================================

-- 1) RAW RECORDS TABLE (Immutable audit trail of all ingested data)
-- Stores exact CSV row data before any normalization/transformation.
-- Enables: replay, re-processing, data lineage, audit trail.
CREATE TABLE public.raw_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dataset_id uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  dataset_version_id uuid REFERENCES public.dataset_versions(id) ON DELETE SET NULL,
  row_index integer NOT NULL,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  transform_status text NOT NULL DEFAULT 'pending',
  transform_error text,
  transformed_at timestamptz
);

-- Indexes for raw_records
CREATE INDEX idx_raw_records_org_dataset ON public.raw_records (organization_id, dataset_id);
CREATE INDEX idx_raw_records_dataset_status ON public.raw_records (dataset_id, transform_status);
CREATE INDEX idx_raw_records_ingested ON public.raw_records (ingested_at DESC);

-- RLS for raw_records
ALTER TABLE public.raw_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view raw records"
  ON public.raw_records FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can insert raw records"
  ON public.raw_records FOR INSERT TO authenticated
  WITH CHECK (
    get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role])
  );

CREATE POLICY "Org admins can delete raw records"
  ON public.raw_records FOR DELETE TO authenticated
  USING (
    get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role])
  );

-- 2) METRIC AGGREGATES TABLE (Pre-computed rollups for fast dashboard serving)
-- Eliminates full-table scans on 100M+ metrics for KPI cards, charts, reports.
CREATE TABLE public.metric_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dataset_id uuid REFERENCES public.datasets(id) ON DELETE CASCADE,
  metric_type text NOT NULL,
  period_type text NOT NULL DEFAULT 'monthly',
  period_start date NOT NULL,
  region text NOT NULL DEFAULT '',
  segment text NOT NULL DEFAULT '',
  agg_sum numeric NOT NULL DEFAULT 0,
  agg_count integer NOT NULL DEFAULT 0,
  agg_min numeric,
  agg_max numeric,
  agg_avg numeric,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, dataset_id, metric_type, period_type, period_start, region, segment)
);

-- Indexes for metric_aggregates
CREATE INDEX idx_metric_agg_org_dataset ON public.metric_aggregates (organization_id, dataset_id);
CREATE INDEX idx_metric_agg_query ON public.metric_aggregates (organization_id, dataset_id, metric_type, period_type, period_start);
CREATE INDEX idx_metric_agg_computed ON public.metric_aggregates (computed_at DESC);

-- RLS for metric_aggregates
ALTER TABLE public.metric_aggregates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view aggregates"
  ON public.metric_aggregates FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

-- 3) PIPELINE STATUS TABLE (Tracks pipeline run state for observability)
CREATE TABLE public.pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dataset_id uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  run_type text NOT NULL DEFAULT 'full',
  status text NOT NULL DEFAULT 'pending',
  stage text NOT NULL DEFAULT 'raw_ingest',
  raw_count integer DEFAULT 0,
  transformed_count integer DEFAULT 0,
  aggregated_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_pipeline_runs_org ON public.pipeline_runs (organization_id, dataset_id);
CREATE INDEX idx_pipeline_runs_status ON public.pipeline_runs (status, started_at DESC);

ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view pipeline runs"
  ON public.pipeline_runs FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can insert pipeline runs"
  ON public.pipeline_runs FOR INSERT TO authenticated
  WITH CHECK (
    get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role])
  );

CREATE POLICY "Org admins can update pipeline runs"
  ON public.pipeline_runs FOR UPDATE TO authenticated
  USING (
    get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role])
  );

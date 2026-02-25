
-- =============================================
-- PHASE B: INSTITUTIONAL TRUST LAYER
-- =============================================

-- 1. Metric Provenance: Track origin of every metric value
ALTER TABLE public.metrics
ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS source_id uuid,
ADD COLUMN IF NOT EXISTS ingested_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS quality_score integer DEFAULT 100;

COMMENT ON COLUMN public.metrics.source_type IS 'Origin: manual, csv, webhook, api, computed';
COMMENT ON COLUMN public.metrics.source_id IS 'FK to data_sources.id for traceability';
COMMENT ON COLUMN public.metrics.quality_score IS '0-100 data quality confidence';

-- 2. Advisory Traceability: Link advisories to evidence
ALTER TABLE public.advisory_instances
ADD COLUMN IF NOT EXISTS source_evidence jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS generation_version integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS data_snapshot_date date;

COMMENT ON COLUMN public.advisory_instances.source_evidence IS 'Array of {metric_id, kpi_id, value, date} that triggered this advisory';
COMMENT ON COLUMN public.advisory_instances.generation_version IS 'Version of the advisory generation algorithm';
COMMENT ON COLUMN public.advisory_instances.data_snapshot_date IS 'Date of the data snapshot used to generate this advisory';

-- 3. Insight Provenance
ALTER TABLE public.insights
ADD COLUMN IF NOT EXISTS source_kpi_id uuid,
ADD COLUMN IF NOT EXISTS source_metric_ids jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS generation_model text DEFAULT 'rule-based',
ADD COLUMN IF NOT EXISTS confidence_score integer DEFAULT 80;

COMMENT ON COLUMN public.insights.generation_model IS 'rule-based, ai-gemini, ai-gpt, statistical';
COMMENT ON COLUMN public.insights.confidence_score IS '0-100 how confident is this insight';

-- 4. Data Freshness Tracking on datasets
ALTER TABLE public.datasets
ADD COLUMN IF NOT EXISTS last_refreshed_at timestamptz,
ADD COLUMN IF NOT EXISTS freshness_policy_hours integer DEFAULT 24,
ADD COLUMN IF NOT EXISTS is_stale boolean DEFAULT false;

-- 5. KPI Computation Provenance
ALTER TABLE public.kpi_values
ADD COLUMN IF NOT EXISTS computation_version integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS input_metric_ids jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS formula_snapshot text;

COMMENT ON COLUMN public.kpi_values.formula_snapshot IS 'Frozen formula at computation time for reproducibility';

-- 6. Create a data_quality_checks table for systematic quality tracking
CREATE TABLE IF NOT EXISTS public.data_quality_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  dataset_id uuid REFERENCES public.datasets(id),
  check_type text NOT NULL DEFAULT 'completeness',
  status text NOT NULL DEFAULT 'passed',
  details jsonb DEFAULT '{}'::jsonb,
  records_checked integer DEFAULT 0,
  records_failed integer DEFAULT 0,
  score integer DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_quality_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view quality checks"
ON public.data_quality_checks FOR SELECT
USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "System can insert quality checks"
ON public.data_quality_checks FOR INSERT
WITH CHECK (is_org_member(auth.uid(), organization_id));

-- 7. Create intelligence_audit_trail for full traceability
CREATE TABLE IF NOT EXISTS public.intelligence_audit_trail (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  input_data jsonb DEFAULT '{}'::jsonb,
  output_data jsonb DEFAULT '{}'::jsonb,
  model_used text,
  confidence_score integer,
  processing_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intelligence_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view audit trail"
ON public.intelligence_audit_trail FOR SELECT
USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY "System can insert audit trail"
ON public.intelligence_audit_trail FOR INSERT
WITH CHECK (is_org_member(auth.uid(), organization_id));

-- 8. Function to compute data freshness
CREATE OR REPLACE FUNCTION public.update_dataset_staleness()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.datasets
  SET is_stale = (
    last_refreshed_at IS NULL
    OR last_refreshed_at < now() - (freshness_policy_hours || ' hours')::interval
  )
  WHERE status = 'active';
END;
$$;

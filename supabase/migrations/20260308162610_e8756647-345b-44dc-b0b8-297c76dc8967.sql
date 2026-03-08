
-- ═══════════════════════════════════════════════════════
-- 1. SSO/SAML Configuration Table
-- ═══════════════════════════════════════════════════════
CREATE TABLE public.sso_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL DEFAULT 'saml' CHECK (provider_type IN ('saml', 'oidc')),
  idp_entity_id TEXT,
  idp_sso_url TEXT,
  idp_certificate TEXT,
  idp_metadata_url TEXT,
  attribute_mapping JSONB DEFAULT '{"email":"email","firstName":"first_name","lastName":"last_name","role":"role"}'::jsonb,
  enforce_sso BOOLEAN NOT NULL DEFAULT false,
  allowed_domains TEXT[] DEFAULT '{}',
  auto_provision BOOLEAN NOT NULL DEFAULT true,
  deactivate_on_removal BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider_type)
);

ALTER TABLE public.sso_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owners can manage SSO configs" ON public.sso_configs
  FOR ALL
  TO authenticated
  USING (public.get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'))
  WITH CHECK (public.get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

CREATE POLICY "Org members can read SSO configs" ON public.sso_configs
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

-- Trigger for updated_at
CREATE TRIGGER update_sso_configs_updated_at
  BEFORE UPDATE ON public.sso_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════
-- 2. SSO Domain Resolver Function
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.resolve_sso_for_email(_email TEXT)
RETURNS TABLE(organization_id UUID, provider_type TEXT, idp_sso_url TEXT, enforce_sso BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT sc.organization_id, sc.provider_type, sc.idp_sso_url, sc.enforce_sso
  FROM public.sso_configs sc
  WHERE sc.is_active = true
    AND EXISTS (
      SELECT 1 FROM unnest(sc.allowed_domains) AS d
      WHERE _email LIKE '%@' || d
    )
  LIMIT 1;
$$;

-- ═══════════════════════════════════════════════════════
-- 3. Analytics Compute Jobs (async compute queue)
-- ═══════════════════════════════════════════════════════
CREATE TABLE public.analytics_compute_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('rollup', 'forecast', 'anomaly_scan', 'correlation', 'cohort', 'custom')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  parameters JSONB DEFAULT '{}',
  result JSONB,
  error_message TEXT,
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.analytics_compute_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage compute jobs" ON public.analytics_compute_jobs
  FOR ALL
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE INDEX idx_compute_jobs_status ON public.analytics_compute_jobs(status, priority DESC, created_at ASC);
CREATE INDEX idx_compute_jobs_org ON public.analytics_compute_jobs(organization_id, dataset_id);

-- ═══════════════════════════════════════════════════════
-- 4. Materialized Rollup Table (replaces slow raw scans)
-- ═══════════════════════════════════════════════════════
CREATE TABLE public.metric_rollups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  period_start DATE NOT NULL,
  region TEXT DEFAULT '_all',
  segment TEXT DEFAULT '_all',
  val_sum DOUBLE PRECISION NOT NULL DEFAULT 0,
  val_count BIGINT NOT NULL DEFAULT 0,
  val_min DOUBLE PRECISION,
  val_max DOUBLE PRECISION,
  val_avg DOUBLE PRECISION,
  val_stddev DOUBLE PRECISION,
  val_p50 DOUBLE PRECISION,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, dataset_id, metric_type, period_type, period_start, region, segment)
);

ALTER TABLE public.metric_rollups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read rollups" ON public.metric_rollups
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Service can write rollups" ON public.metric_rollups
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE INDEX idx_rollups_lookup ON public.metric_rollups(organization_id, dataset_id, period_type, period_start);

-- ═══════════════════════════════════════════════════════
-- 5. Metric Latest Snapshot (fast KPI card lookups)
-- ═══════════════════════════════════════════════════════
CREATE TABLE public.metric_latest (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  latest_value DOUBLE PRECISION NOT NULL,
  latest_date DATE NOT NULL,
  total_count BIGINT NOT NULL DEFAULT 0,
  total_sum DOUBLE PRECISION NOT NULL DEFAULT 0,
  mean_value DOUBLE PRECISION,
  stddev_value DOUBLE PRECISION,
  min_value DOUBLE PRECISION,
  max_value DOUBLE PRECISION,
  trend_slope DOUBLE PRECISION,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, dataset_id, metric_type)
);

ALTER TABLE public.metric_latest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read metric_latest" ON public.metric_latest
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Service can write metric_latest" ON public.metric_latest
  FOR ALL
  TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

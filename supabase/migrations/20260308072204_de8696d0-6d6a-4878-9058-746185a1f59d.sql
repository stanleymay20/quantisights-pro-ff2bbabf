
-- Connector configurations (stores connection parameters, credentials in Vault)
CREATE TABLE public.connector_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  data_source_id UUID REFERENCES public.data_sources(id) ON DELETE CASCADE,
  connector_type TEXT NOT NULL DEFAULT 'postgresql',
  host TEXT,
  port INTEGER DEFAULT 5432,
  database_name TEXT,
  schema_name TEXT DEFAULT 'public',
  username TEXT,
  credential_vault_key TEXT,
  ssl_mode TEXT DEFAULT 'require',
  selected_tables JSONB DEFAULT '[]'::jsonb,
  discovered_schema JSONB DEFAULT '{}'::jsonb,
  connection_status TEXT DEFAULT 'untested',
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.connector_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_connector_configs" ON public.connector_configs
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- Metric mappings (column → standardized metric type)
CREATE TABLE public.metric_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  data_source_id UUID NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  source_column TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  aggregation TEXT DEFAULT 'sum',
  date_column TEXT,
  segment_column TEXT,
  region_column TEXT,
  transform_expression TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.metric_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_metric_mappings" ON public.metric_mappings
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- Sync schedules
CREATE TABLE public.sync_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  data_source_id UUID NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL DEFAULT 'daily',
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(data_source_id)
);

ALTER TABLE public.sync_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_sync_schedules" ON public.sync_schedules
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- Indexes
CREATE INDEX idx_connector_configs_org ON public.connector_configs(organization_id);
CREATE INDEX idx_connector_configs_ds ON public.connector_configs(data_source_id);
CREATE INDEX idx_metric_mappings_org ON public.metric_mappings(organization_id);
CREATE INDEX idx_metric_mappings_ds ON public.metric_mappings(data_source_id);
CREATE INDEX idx_sync_schedules_org ON public.sync_schedules(organization_id);
CREATE INDEX idx_sync_schedules_next ON public.sync_schedules(next_run_at) WHERE is_active = true;

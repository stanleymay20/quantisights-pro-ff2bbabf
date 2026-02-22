
-- Data Sources: connector registry for each organization
CREATE TABLE public.data_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_type text NOT NULL DEFAULT 'csv',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  credentials_key text,
  status text NOT NULL DEFAULT 'active',
  last_synced_at timestamp with time zone,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view data sources"
  ON public.data_sources FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins/owners can insert data sources"
  ON public.data_sources FOR INSERT
  WITH CHECK (
    get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin')
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins/owners can update data sources"
  ON public.data_sources FOR UPDATE
  USING (get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

CREATE POLICY "Admins/owners can delete data sources"
  ON public.data_sources FOR DELETE
  USING (get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

CREATE TRIGGER update_data_sources_updated_at
  BEFORE UPDATE ON public.data_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Data Sync Jobs: track each sync run
CREATE TABLE public.data_sync_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_source_id uuid NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  records_synced integer DEFAULT 0,
  error_message text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.data_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view sync jobs"
  ON public.data_sync_jobs FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE INDEX idx_sync_jobs_source ON public.data_sync_jobs(data_source_id);
CREATE INDEX idx_sync_jobs_status ON public.data_sync_jobs(status);

-- Dataset Versions: version control for datasets
CREATE TABLE public.dataset_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  file_path text,
  row_count integer DEFAULT 0,
  column_mapping jsonb,
  change_summary text,
  created_by uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.dataset_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view dataset versions"
  ON public.dataset_versions FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can insert dataset versions"
  ON public.dataset_versions FOR INSERT
  WITH CHECK (
    is_org_member(auth.uid(), organization_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins can update dataset versions"
  ON public.dataset_versions FOR UPDATE
  USING (get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

CREATE UNIQUE INDEX idx_dataset_version_active
  ON public.dataset_versions(dataset_id) WHERE is_active = true;

CREATE INDEX idx_dataset_versions_dataset ON public.dataset_versions(dataset_id);

-- Add source reference to datasets table
ALTER TABLE public.datasets ADD COLUMN IF NOT EXISTS data_source_id uuid REFERENCES public.data_sources(id);
ALTER TABLE public.datasets ADD COLUMN IF NOT EXISTS current_version integer DEFAULT 1;

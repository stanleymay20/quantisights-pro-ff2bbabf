
-- 1. Add composite index on metrics(dataset_id, metric_type, date) for dataset-scoped metric-type queries
CREATE INDEX IF NOT EXISTS idx_metrics_dataset_type_date 
ON public.metrics (dataset_id, metric_type, date) WHERE dataset_id IS NOT NULL;

-- 2. Add composite index on datasets(organization_id, created_at desc)
CREATE INDEX IF NOT EXISTS idx_datasets_org_created_desc 
ON public.datasets (organization_id, created_at DESC);

-- 3. Add composite index on projects(organization_id, created_at desc)
CREATE INDEX IF NOT EXISTS idx_projects_org_created_desc 
ON public.projects (organization_id, created_at DESC);

-- 4. Add UPDATE policy on metrics for admins/owners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'metrics' AND policyname = 'Admins can update metrics'
  ) THEN
    CREATE POLICY "Admins can update metrics" ON public.metrics
    FOR UPDATE TO authenticated
    USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));
  END IF;
END $$;

-- 5. Add UPDATE policy on project_datasets for admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_datasets' AND policyname = 'Admins can update project_datasets'
  ) THEN
    CREATE POLICY "Admins can update project_datasets" ON public.project_datasets
    FOR UPDATE TO authenticated
    USING (EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_datasets.project_id
      AND get_user_org_role(auth.uid(), p.organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role])
    ));
  END IF;
END $$;

-- 6. Add INSERT policy on insights for service role (edge functions) — 
-- insights are inserted by edge functions using service role, so this is for completeness
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'insights' AND policyname = 'Service can insert insights'
  ) THEN
    CREATE POLICY "Service can insert insights" ON public.insights
    FOR INSERT TO authenticated
    WITH CHECK (is_org_member(auth.uid(), organization_id));
  END IF;
END $$;

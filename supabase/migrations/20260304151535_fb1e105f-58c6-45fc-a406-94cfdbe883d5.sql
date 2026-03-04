
-- ═══════════════════════════════════════════════════════════
-- WORKSPACE HARD SECURITY BOUNDARY
-- Add workspace_id to all data tables + RLS enforcement
-- ═══════════════════════════════════════════════════════════

-- 1. Security definer function to check workspace membership
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id
  )
$$;

-- 2. Add workspace_id to datasets
ALTER TABLE public.datasets ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
CREATE INDEX IF NOT EXISTS idx_datasets_workspace ON public.datasets(workspace_id);

-- 3. Add workspace_id to raw_records
ALTER TABLE public.raw_records ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
CREATE INDEX IF NOT EXISTS idx_raw_records_workspace ON public.raw_records(workspace_id);

-- 4. Add workspace_id to metrics
ALTER TABLE public.metrics ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
CREATE INDEX IF NOT EXISTS idx_metrics_workspace ON public.metrics(workspace_id);

-- 5. Add workspace_id to metric_aggregates
ALTER TABLE public.metric_aggregates ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
CREATE INDEX IF NOT EXISTS idx_metric_aggregates_workspace ON public.metric_aggregates(workspace_id);

-- 6. Add workspace_id to pipeline_runs
ALTER TABLE public.pipeline_runs ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_workspace ON public.pipeline_runs(workspace_id);

-- 7. Add workspace_id to dataset_versions
ALTER TABLE public.dataset_versions ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
CREATE INDEX IF NOT EXISTS idx_dataset_versions_workspace ON public.dataset_versions(workspace_id);

-- 8. Add workspace_id to data_quality_checks
ALTER TABLE public.data_quality_checks ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);

-- ═══════════════════════════════════════════════════════════
-- RLS POLICIES — Workspace-scoped access
-- ═══════════════════════════════════════════════════════════

-- datasets: Replace existing SELECT policy to also check workspace membership
DROP POLICY IF EXISTS "Org members can view datasets" ON public.datasets;
CREATE POLICY "Workspace members can view datasets" ON public.datasets
  FOR SELECT TO authenticated
  USING (
    is_org_member(auth.uid(), organization_id)
    AND (workspace_id IS NULL OR is_workspace_member(auth.uid(), workspace_id))
  );

-- datasets: Replace INSERT policy
DROP POLICY IF EXISTS "Org members can insert datasets" ON public.datasets;
CREATE POLICY "Workspace members can insert datasets" ON public.datasets
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(auth.uid(), organization_id)
    AND uploaded_by = auth.uid()
    AND (workspace_id IS NULL OR is_workspace_member(auth.uid(), workspace_id))
  );

-- datasets: Replace UPDATE policy
DROP POLICY IF EXISTS "Uploaders can update own datasets" ON public.datasets;
CREATE POLICY "Workspace uploaders can update datasets" ON public.datasets
  FOR UPDATE TO authenticated
  USING (
    uploaded_by = auth.uid()
    AND (workspace_id IS NULL OR is_workspace_member(auth.uid(), workspace_id))
  );

-- raw_records: Add workspace policy for SELECT
DROP POLICY IF EXISTS "Org members can view raw records" ON public.raw_records;
CREATE POLICY "Workspace members can view raw records" ON public.raw_records
  FOR SELECT TO authenticated
  USING (
    is_org_member(auth.uid(), organization_id)
    AND (workspace_id IS NULL OR is_workspace_member(auth.uid(), workspace_id))
  );

-- metrics: Replace SELECT policy
DROP POLICY IF EXISTS "Org members can view metrics" ON public.metrics;
CREATE POLICY "Workspace members can view metrics" ON public.metrics
  FOR SELECT TO authenticated
  USING (
    is_org_member(auth.uid(), organization_id)
    AND (workspace_id IS NULL OR is_workspace_member(auth.uid(), workspace_id))
  );

-- metric_aggregates: Replace SELECT policy
DROP POLICY IF EXISTS "Org members can view aggregates" ON public.metric_aggregates;
CREATE POLICY "Workspace members can view aggregates" ON public.metric_aggregates
  FOR SELECT TO authenticated
  USING (
    is_org_member(auth.uid(), organization_id)
    AND (workspace_id IS NULL OR is_workspace_member(auth.uid(), workspace_id))
  );

-- pipeline_runs: Replace SELECT policy
DROP POLICY IF EXISTS "Org members can view pipeline runs" ON public.pipeline_runs;
CREATE POLICY "Workspace members can view pipeline runs" ON public.pipeline_runs
  FOR SELECT TO authenticated
  USING (
    is_org_member(auth.uid(), organization_id)
    AND (workspace_id IS NULL OR is_workspace_member(auth.uid(), workspace_id))
  );

-- dataset_versions: Replace SELECT policy
DROP POLICY IF EXISTS "Org members can view dataset versions" ON public.dataset_versions;
CREATE POLICY "Workspace members can view dataset versions" ON public.dataset_versions
  FOR SELECT TO authenticated
  USING (
    is_org_member(auth.uid(), organization_id)
    AND (workspace_id IS NULL OR is_workspace_member(auth.uid(), workspace_id))
  );

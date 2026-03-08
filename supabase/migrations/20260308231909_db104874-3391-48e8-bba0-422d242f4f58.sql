
-- ═══════════════════════════════════════════════════════════════
-- Enterprise workspace isolation: defense-in-depth at DB layer
-- ═══════════════════════════════════════════════════════════════

-- 1. Security definer function: resolves workspace from dataset_id
--    and checks workspace membership. Returns true if:
--    - dataset_id is NULL (backward compat)
--    - dataset has no workspace_id (legacy data)
--    - user is a member of the dataset's workspace
CREATE OR REPLACE FUNCTION public.is_dataset_workspace_member(_user_id uuid, _dataset_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _dataset_id IS NULL THEN true
    ELSE COALESCE(
      (SELECT
        CASE
          WHEN d.workspace_id IS NULL THEN true
          ELSE EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = d.workspace_id
              AND wm.user_id = _user_id
          )
        END
      FROM public.datasets d WHERE d.id = _dataset_id),
      true  -- dataset not found = allow (RLS on org_id still applies)
    )
  END
$$;

-- 2. Fix metrics: drop overly permissive role-only SELECT policy
--    The workspace-member policy already covers authorized access
DROP POLICY IF EXISTS "Authorized roles can view metrics" ON public.metrics;

-- 3. advisory_instances: add workspace isolation to SELECT
DROP POLICY IF EXISTS "Leadership can view advisories" ON public.advisory_instances;
CREATE POLICY "Leadership can view advisories"
ON public.advisory_instances FOR SELECT TO authenticated
USING (
  get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin', 'executive')
  AND is_dataset_workspace_member(auth.uid(), dataset_id)
);

-- Also add workspace check to UPDATE/DELETE
DROP POLICY IF EXISTS "Admins/owners can update advisories" ON public.advisory_instances;
CREATE POLICY "Admins/owners can update advisories"
ON public.advisory_instances FOR UPDATE TO authenticated
USING (
  get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin')
  AND is_dataset_workspace_member(auth.uid(), dataset_id)
);

DROP POLICY IF EXISTS "Admins/owners can delete advisories" ON public.advisory_instances;
CREATE POLICY "Admins/owners can delete advisories"
ON public.advisory_instances FOR DELETE TO authenticated
USING (
  get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin')
  AND is_dataset_workspace_member(auth.uid(), dataset_id)
);

DROP POLICY IF EXISTS "Admins/owners can insert advisories" ON public.advisory_instances;
CREATE POLICY "Admins/owners can insert advisories"
ON public.advisory_instances FOR INSERT TO authenticated
WITH CHECK (
  get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin')
  AND is_dataset_workspace_member(auth.uid(), dataset_id)
);

-- 4. insights: add workspace isolation
DROP POLICY IF EXISTS "Org members can view insights" ON public.insights;
CREATE POLICY "Org members can view insights"
ON public.insights FOR SELECT TO authenticated
USING (
  is_org_member(auth.uid(), organization_id)
  AND is_dataset_workspace_member(auth.uid(), dataset_id)
);

DROP POLICY IF EXISTS "Members can mark as read" ON public.insights;
CREATE POLICY "Members can mark as read"
ON public.insights FOR UPDATE TO authenticated
USING (
  is_org_member(auth.uid(), organization_id)
  AND is_dataset_workspace_member(auth.uid(), dataset_id)
);

-- 5. portfolio_companies: add workspace isolation
DROP POLICY IF EXISTS "Org members can view portfolio companies" ON public.portfolio_companies;
CREATE POLICY "Org members can view portfolio companies"
ON public.portfolio_companies FOR SELECT TO authenticated
USING (
  is_org_member(auth.uid(), organization_id)
  AND is_dataset_workspace_member(auth.uid(), dataset_id)
);

DROP POLICY IF EXISTS "Admins can update portfolio companies" ON public.portfolio_companies;
CREATE POLICY "Admins can update portfolio companies"
ON public.portfolio_companies FOR UPDATE TO authenticated
USING (
  get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin')
  AND is_dataset_workspace_member(auth.uid(), dataset_id)
);

DROP POLICY IF EXISTS "Admins can delete portfolio companies" ON public.portfolio_companies;
CREATE POLICY "Admins can delete portfolio companies"
ON public.portfolio_companies FOR DELETE TO authenticated
USING (
  get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin')
  AND is_dataset_workspace_member(auth.uid(), dataset_id)
);

DROP POLICY IF EXISTS "Admins can insert portfolio companies" ON public.portfolio_companies;
CREATE POLICY "Admins can insert portfolio companies"
ON public.portfolio_companies FOR INSERT TO authenticated
WITH CHECK (
  get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin')
  AND is_dataset_workspace_member(auth.uid(), dataset_id)
);

-- 6. simulation_results: add workspace isolation
DROP POLICY IF EXISTS "Leadership can view simulations" ON public.simulation_results;
CREATE POLICY "Leadership can view simulations"
ON public.simulation_results FOR SELECT TO authenticated
USING (
  get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin', 'executive')
  AND is_dataset_workspace_member(auth.uid(), dataset_id)
);

DROP POLICY IF EXISTS "Admins/owners can delete simulations" ON public.simulation_results;
CREATE POLICY "Admins/owners can delete simulations"
ON public.simulation_results FOR DELETE TO authenticated
USING (
  get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin')
  AND is_dataset_workspace_member(auth.uid(), dataset_id)
);

DROP POLICY IF EXISTS "Admins/owners can insert simulations" ON public.simulation_results;
CREATE POLICY "Admins/owners can insert simulations"
ON public.simulation_results FOR INSERT TO authenticated
WITH CHECK (
  get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin')
  AND is_dataset_workspace_member(auth.uid(), dataset_id)
);

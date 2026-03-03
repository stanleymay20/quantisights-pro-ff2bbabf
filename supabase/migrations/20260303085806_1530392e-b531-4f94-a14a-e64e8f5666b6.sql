
-- =====================================================
-- PHASE 1: LEAST-PRIVILEGE RLS TIGHTENING
-- Restrict strategic tables from viewer-level access
-- =====================================================

-- 1. data_sources: restrict SELECT to admin/owner only
DROP POLICY IF EXISTS "Org members can view data sources" ON public.data_sources;
CREATE POLICY "Admins/owners can view data sources"
  ON public.data_sources FOR SELECT
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- 2. decision_ledger: restrict SELECT to owner/admin/executive
DROP POLICY IF EXISTS "Org members can view decisions" ON public.decision_ledger;
CREATE POLICY "Leadership can view decisions"
  ON public.decision_ledger FOR SELECT
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role, 'executive'::org_role]));

-- 3. metrics: restrict SELECT to owner/admin/executive/analyst
DROP POLICY IF EXISTS "Org members can view metrics" ON public.metrics;
CREATE POLICY "Authorized roles can view metrics"
  ON public.metrics FOR SELECT
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role, 'executive'::org_role, 'analyst'::org_role]));

-- 4. advisory_instances: restrict SELECT to owner/admin/executive
DROP POLICY IF EXISTS "Org members can view advisories" ON public.advisory_instances;
CREATE POLICY "Leadership can view advisories"
  ON public.advisory_instances FOR SELECT
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role, 'executive'::org_role]));

-- 5. simulation_results: restrict SELECT to owner/admin/executive
DROP POLICY IF EXISTS "Org members can view simulations" ON public.simulation_results;
CREATE POLICY "Leadership can view simulations"
  ON public.simulation_results FOR SELECT
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role, 'executive'::org_role]));

-- FIX 1: Restrict metrics INSERT to authenticated users only (was public)
DROP POLICY IF EXISTS "Admins can insert metrics" ON public.metrics;
CREATE POLICY "Admins can insert metrics" ON public.metrics
  FOR INSERT TO authenticated
  WITH CHECK (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- FIX 2: Restrict metrics SELECT view policy to authenticated users only (was public)
DROP POLICY IF EXISTS "Authorized roles can view metrics" ON public.metrics;
CREATE POLICY "Authorized roles can view metrics" ON public.metrics
  FOR SELECT TO authenticated
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role, 'executive'::org_role, 'analyst'::org_role]));
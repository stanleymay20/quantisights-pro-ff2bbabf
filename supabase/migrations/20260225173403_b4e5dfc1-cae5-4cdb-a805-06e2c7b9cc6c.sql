
-- Tighten metrics INSERT to admin/owner only (was: any org member)
DROP POLICY IF EXISTS "Org members can insert metrics" ON public.metrics;
CREATE POLICY "Admins can insert metrics"
  ON public.metrics FOR INSERT
  WITH CHECK (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- Remove client INSERT on insights (should be service-role only)
DROP POLICY IF EXISTS "System can insert insights" ON public.insights;

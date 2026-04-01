-- Fix connector_configs UPDATE: add USING clause to prevent read-during-update bypass
DROP POLICY IF EXISTS "Admins can update connector configs" ON public.connector_configs;

CREATE POLICY "Admins can update connector configs" ON public.connector_configs
  FOR UPDATE TO authenticated
  USING (get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'))
  WITH CHECK (get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));
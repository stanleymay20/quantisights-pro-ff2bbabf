-- Fix user_roles: replace has_role self-reference with org_member admin check
DROP POLICY IF EXISTS "Admins can manage roles in their org" ON public.user_roles;

CREATE POLICY "Org admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    get_user_org_role(auth.uid(), get_user_organization_id(user_id)) IN ('owner', 'admin')
  )
  WITH CHECK (
    get_user_org_role(auth.uid(), get_user_organization_id(user_id)) IN ('owner', 'admin')
  );
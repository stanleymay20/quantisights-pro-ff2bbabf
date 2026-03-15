
-- 1. SSO configs: restrict SELECT to owner/admin only (contains IdP certificates and secrets)
DROP POLICY IF EXISTS "Org members can read SSO configs" ON public.sso_configs;
CREATE POLICY "Admins can read SSO configs"
  ON public.sso_configs
  FOR SELECT
  TO authenticated
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- 2. Embed tokens: restrict SELECT to owner/admin only (contains plaintext secret tokens)
DROP POLICY IF EXISTS "Members view embed tokens" ON public.embed_tokens;
CREATE POLICY "Admins view embed tokens"
  ON public.embed_tokens
  FOR SELECT
  TO authenticated
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- 3. Calibration assessments: restrict team-wide SELECT to owner/admin only
-- Users can still view their own via the existing "Users can view own assessments" policy
DROP POLICY IF EXISTS "Org members can view team assessments" ON public.calibration_assessments;
CREATE POLICY "Admins can view team assessments"
  ON public.calibration_assessments
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role])
  );

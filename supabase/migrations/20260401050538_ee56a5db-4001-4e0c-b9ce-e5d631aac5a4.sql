-- Fix notification_preferences: change all policies from 'public' to 'authenticated'
DROP POLICY IF EXISTS "Admins/owners can delete notification prefs" ON public.notification_preferences;
DROP POLICY IF EXISTS "Admins/owners can insert notification prefs" ON public.notification_preferences;
DROP POLICY IF EXISTS "Admins/owners can update notification prefs" ON public.notification_preferences;
DROP POLICY IF EXISTS "Org admins can view notification prefs" ON public.notification_preferences;

CREATE POLICY "Admins/owners can view notification prefs" ON public.notification_preferences
  FOR SELECT TO authenticated
  USING (get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

CREATE POLICY "Admins/owners can insert notification prefs" ON public.notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

CREATE POLICY "Admins/owners can update notification prefs" ON public.notification_preferences
  FOR UPDATE TO authenticated
  USING (get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'))
  WITH CHECK (get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

CREATE POLICY "Admins/owners can delete notification prefs" ON public.notification_preferences
  FOR DELETE TO authenticated
  USING (get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));
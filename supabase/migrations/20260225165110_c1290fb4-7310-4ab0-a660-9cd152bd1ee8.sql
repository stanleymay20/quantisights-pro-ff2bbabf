
-- =============================================
-- PHASE C: SECURITY HARDENING - RLS TIGHTENING
-- =============================================

-- 1. Tighten subscriptions: only owners/admins can view billing data
DROP POLICY IF EXISTS "Org members can view subscription" ON public.subscriptions;
CREATE POLICY "Org admins can view subscription"
ON public.subscriptions FOR SELECT
USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- 2. Tighten notification_preferences: only admins can view webhook URLs
DROP POLICY IF EXISTS "Org members can view notification prefs" ON public.notification_preferences;
CREATE POLICY "Org admins can view notification prefs"
ON public.notification_preferences FOR SELECT
USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

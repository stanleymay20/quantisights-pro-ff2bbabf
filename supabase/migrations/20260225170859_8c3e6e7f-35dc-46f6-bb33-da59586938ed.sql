-- Fix audit_log: drop existing then recreate
DROP POLICY IF EXISTS "Org admins can view audit log" ON public.audit_log;
CREATE POLICY "Org admins can view audit log"
ON public.audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = audit_log.organization_id
    AND organization_members.user_id = auth.uid()
    AND organization_members.role IN ('owner', 'admin')
  )
);

-- Fix intelligence_audit_trail
DROP POLICY IF EXISTS "System can insert audit trail" ON public.intelligence_audit_trail;
DROP POLICY IF EXISTS "Org members can view audit trail" ON public.intelligence_audit_trail;
DROP POLICY IF EXISTS "Org admins can view intelligence audit trail" ON public.intelligence_audit_trail;
CREATE POLICY "Org admins can view intelligence audit trail"
ON public.intelligence_audit_trail FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = intelligence_audit_trail.organization_id
    AND organization_members.user_id = auth.uid()
    AND organization_members.role IN ('owner', 'admin')
  )
);
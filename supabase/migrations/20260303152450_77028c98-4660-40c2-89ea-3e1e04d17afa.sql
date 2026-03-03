
-- 1. Protect audit_log from tampering: deny INSERT/UPDATE/DELETE to all users
-- (only service-role edge functions can write)
CREATE POLICY "Deny user inserts on audit_log"
ON public.audit_log FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Deny user updates on audit_log"
ON public.audit_log FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "Deny user deletes on audit_log"
ON public.audit_log FOR DELETE
TO authenticated
USING (false);

-- 2. Protect intelligence_audit_trail similarly
CREATE POLICY "Deny user inserts on intelligence_audit_trail"
ON public.intelligence_audit_trail FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Deny user updates on intelligence_audit_trail"
ON public.intelligence_audit_trail FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "Deny user deletes on intelligence_audit_trail"
ON public.intelligence_audit_trail FOR DELETE
TO authenticated
USING (false);

-- 3. Add AI data boundary settings to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS ai_raw_text_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS data_retention_days integer NOT NULL DEFAULT 730;

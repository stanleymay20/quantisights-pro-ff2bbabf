-- ═══════════════════════════════════════════════════════════════
-- FIX: cron_run_log — restrict to service-role only (no authenticated SELECT)
-- Admins can view via edge functions using service-role
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can view cron logs" ON public.cron_run_log;

-- No policies at all — only service_role (which bypasses RLS) can access

-- ═══════════════════════════════════════════════════════════════
-- FIX: Add DELETE policies for storage buckets (org-admin scoped)
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "Org admins can delete dataset files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'datasets'
  AND public.is_org_member(
    auth.uid(),
    (storage.foldername(name))[1]::uuid
  )
);

CREATE POLICY "Org admins can delete report files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'reports'
  AND public.is_org_member(
    auth.uid(),
    (storage.foldername(name))[1]::uuid
  )
);

-- ═══════════════════════════════════════════════════════════════
-- FIX: Add UPDATE policies for storage buckets (org-member scoped)
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "Org members can update dataset files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'datasets'
  AND public.is_org_member(
    auth.uid(),
    (storage.foldername(name))[1]::uuid
  )
);

CREATE POLICY "Org members can update report files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'reports'
  AND public.is_org_member(
    auth.uid(),
    (storage.foldername(name))[1]::uuid
  )
);
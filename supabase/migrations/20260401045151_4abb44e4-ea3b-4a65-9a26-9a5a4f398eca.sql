-- ═══════════════════════════════════════════════════════════════
-- FIX 1: Storage bucket SELECT policies — scope to org membership
-- ═══════════════════════════════════════════════════════════════

-- Drop overly permissive SELECT policies
DROP POLICY IF EXISTS "Org members can read dataset files" ON storage.objects;
DROP POLICY IF EXISTS "Org members can read reports" ON storage.objects;

-- Re-create with org-scoped access via path convention: {org_id}/...
CREATE POLICY "Org members can read dataset files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'datasets'
  AND public.is_org_member(
    auth.uid(),
    (storage.foldername(name))[1]::uuid
  )
);

CREATE POLICY "Org members can read reports"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'reports'
  AND public.is_org_member(
    auth.uid(),
    (storage.foldername(name))[1]::uuid
  )
);

-- ═══════════════════════════════════════════════════════════════
-- FIX 2: Storage bucket INSERT policies — scope to org membership
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can upload datasets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload reports" ON storage.objects;

CREATE POLICY "Authenticated users can upload datasets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'datasets'
  AND public.is_org_member(
    auth.uid(),
    (storage.foldername(name))[1]::uuid
  )
);

CREATE POLICY "Authenticated users can upload reports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'reports'
  AND public.is_org_member(
    auth.uid(),
    (storage.foldername(name))[1]::uuid
  )
);

-- ═══════════════════════════════════════════════════════════════
-- FIX 3: user_roles admin policy — standardize to is_org_member()
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admins can manage roles in their org" ON public.user_roles;

CREATE POLICY "Admins can manage roles in their org"
ON public.user_roles FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.is_org_member(auth.uid(), public.get_user_organization_id(user_id))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.is_org_member(auth.uid(), public.get_user_organization_id(user_id))
);
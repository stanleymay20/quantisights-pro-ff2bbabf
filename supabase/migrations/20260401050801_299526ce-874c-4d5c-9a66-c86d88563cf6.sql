-- Fix storage DELETE policies: restrict to admin/owner only
DROP POLICY IF EXISTS "Org members can delete dataset files" ON storage.objects;
DROP POLICY IF EXISTS "Org members can delete report files" ON storage.objects;

CREATE POLICY "Admins can delete dataset files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'datasets'
    AND public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
    AND public.get_user_org_role(auth.uid(), (storage.foldername(name))[1]::uuid) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can delete report files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'reports'
    AND public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
    AND public.get_user_org_role(auth.uid(), (storage.foldername(name))[1]::uuid) IN ('owner', 'admin')
  );

-- Fix overly permissive INSERT on organizations - restrict to authenticated users who don't already own one
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

CREATE POLICY "Users can create organizations"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

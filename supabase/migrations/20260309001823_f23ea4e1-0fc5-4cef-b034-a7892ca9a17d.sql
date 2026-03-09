
-- 1. Harden UPDATE policy: prevent user from changing user_id or organization_id
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- 2. Add index on organization_id for org-scoped SELECT policy
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles (organization_id);

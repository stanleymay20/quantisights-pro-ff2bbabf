
-- Fix: Restrict profiles INSERT so organization_id must match an org the user is already a member of
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_org_member(auth.uid(), organization_id)
  );

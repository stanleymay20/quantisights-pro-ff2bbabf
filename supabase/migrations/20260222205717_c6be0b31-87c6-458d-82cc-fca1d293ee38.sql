
-- Fix: restrict organization creation - only allow if user has no org yet
DROP POLICY "Users can create organizations" ON public.organizations;
CREATE POLICY "Users can create organizations if no org"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND organization_id IS NOT NULL
    )
  );

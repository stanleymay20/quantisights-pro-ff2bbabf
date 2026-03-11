-- Remove overly permissive anon access to org_branding
-- Embedded dashboards should use validate_embed_token RPC instead
DROP POLICY IF EXISTS "Public branding read" ON public.org_branding;

-- industry_benchmarks: ensure policy is scoped to authenticated only
DROP POLICY IF EXISTS "Authenticated users can view benchmarks" ON public.industry_benchmarks;
CREATE POLICY "Authenticated users can view benchmarks"
  ON public.industry_benchmarks FOR SELECT
  TO authenticated
  USING (true);
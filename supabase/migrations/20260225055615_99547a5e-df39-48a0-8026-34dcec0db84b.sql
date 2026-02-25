
-- Enable pg_cron and pg_net for scheduled HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Immutable wrapper for date_trunc to use in index
CREATE OR REPLACE FUNCTION public.immutable_date_trunc_hour(ts timestamptz)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$ SELECT date_trunc('hour', ts); $$;

-- Prevent duplicate convergence writes within the same hour window
CREATE UNIQUE INDEX IF NOT EXISTS idx_convergence_org_hour
  ON public.executive_convergence_index (
    organization_id,
    public.immutable_date_trunc_hour(created_at)
  );

-- Performance index for cron lookups
CREATE INDEX IF NOT EXISTS idx_convergence_org_created
  ON public.executive_convergence_index (organization_id, created_at DESC);

-- Index on subscriptions for cron eligibility queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_active_tier
  ON public.subscriptions (status, tier)
  WHERE status = 'active' AND tier IN ('growth', 'enterprise');

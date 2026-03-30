-- 1. Add missing columns to sync_schedules for retry logic
ALTER TABLE public.sync_schedules
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS backoff_minutes integer NOT NULL DEFAULT 15;

-- 2. Create cron_run_log for observability tracking
CREATE TABLE IF NOT EXISTS public.cron_run_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  duration_ms integer,
  error_message text,
  records_processed integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.cron_run_log ENABLE ROW LEVEL SECURITY;

-- Only service role writes; admins can read via org membership
CREATE POLICY "service_role_manages_cron_log" ON public.cron_run_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. Create advisory lock helper for cron overlap protection
CREATE OR REPLACE FUNCTION public.try_cron_advisory_lock(_lock_id bigint)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT pg_try_advisory_lock(_lock_id);
$$;

CREATE OR REPLACE FUNCTION public.release_cron_advisory_lock(_lock_id bigint)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT pg_advisory_unlock(_lock_id);
$$;
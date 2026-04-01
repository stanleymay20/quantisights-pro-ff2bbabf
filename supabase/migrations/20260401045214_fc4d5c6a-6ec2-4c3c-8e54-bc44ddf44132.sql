-- Fix: cron_run_log should not be writable by any authenticated user
-- Only service-role (edge functions / cron) should write to it
-- Users may read it for observability

DROP POLICY IF EXISTS "service_role_manages_cron_log" ON public.cron_run_log;

-- Allow authenticated users to READ cron logs for observability
CREATE POLICY "Authenticated users can view cron logs"
ON public.cron_run_log FOR SELECT TO authenticated
USING (true);

-- No INSERT/UPDATE/DELETE for authenticated — service_role bypasses RLS automatically
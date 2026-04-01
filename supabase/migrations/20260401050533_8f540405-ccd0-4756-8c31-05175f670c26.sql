-- cron_run_log: ensure RLS blocks all authenticated access (service-role bypasses)
ALTER TABLE public.cron_run_log ENABLE ROW LEVEL SECURITY;
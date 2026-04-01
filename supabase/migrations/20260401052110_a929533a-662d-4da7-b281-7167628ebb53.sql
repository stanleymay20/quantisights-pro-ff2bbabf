-- Fix 1: Remove duplicate less-restrictive DELETE policies on storage.objects
DROP POLICY IF EXISTS "Org admins can delete dataset files" ON storage.objects;
DROP POLICY IF EXISTS "Org admins can delete report files" ON storage.objects;

-- Fix 2: Add explicit deny-all policies on cron_run_log for authenticated users
CREATE POLICY "deny_all_select_cron_run_log"
  ON public.cron_run_log FOR SELECT
  TO authenticated
  USING (false);

CREATE POLICY "deny_all_insert_cron_run_log"
  ON public.cron_run_log FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "deny_all_update_cron_run_log"
  ON public.cron_run_log FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "deny_all_delete_cron_run_log"
  ON public.cron_run_log FOR DELETE
  TO authenticated
  USING (false);
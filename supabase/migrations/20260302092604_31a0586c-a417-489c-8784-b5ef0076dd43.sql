-- Add week_start column for idempotency lock
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS week_start date;

-- Create unique index to prevent race-condition double-sends
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_log_weekly_lock
ON public.notification_log (organization_id, subject, week_start)
WHERE week_start IS NOT NULL;
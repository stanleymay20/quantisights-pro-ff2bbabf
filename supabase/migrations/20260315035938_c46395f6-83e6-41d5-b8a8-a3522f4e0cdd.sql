ALTER TABLE public.data_retention_policies 
  ADD COLUMN IF NOT EXISTS enforcement_status text NOT NULL DEFAULT 'configured',
  ADD COLUMN IF NOT EXISTS last_cleanup_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_scheduled_at timestamptz;

COMMENT ON COLUMN public.data_retention_policies.enforcement_status IS 'One of: configured, scheduled, enforced';
COMMENT ON COLUMN public.data_retention_policies.last_cleanup_at IS 'Timestamp of last automated cleanup run';
COMMENT ON COLUMN public.data_retention_policies.next_scheduled_at IS 'Timestamp of next scheduled cleanup';
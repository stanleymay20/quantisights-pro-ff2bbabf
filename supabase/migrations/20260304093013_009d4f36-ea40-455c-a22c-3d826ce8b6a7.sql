-- Drop the COALESCE-based functional index that can't work with ON CONFLICT
DROP INDEX IF EXISTS public.metrics_unique_series;

-- Create a plain unique index on raw columns (nulls handled at insert time)
-- We need to set defaults for nullable dimension columns so ON CONFLICT works
ALTER TABLE public.metrics ALTER COLUMN region SET DEFAULT '';
ALTER TABLE public.metrics ALTER COLUMN segment SET DEFAULT '';
ALTER TABLE public.metrics ALTER COLUMN source_id SET DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;

-- Normalize existing nulls
UPDATE public.metrics SET region = '' WHERE region IS NULL;
UPDATE public.metrics SET segment = '' WHERE segment IS NULL;
UPDATE public.metrics SET source_id = '00000000-0000-0000-0000-000000000000' WHERE source_id IS NULL;

-- Make columns NOT NULL now that defaults exist
ALTER TABLE public.metrics ALTER COLUMN region SET NOT NULL;
ALTER TABLE public.metrics ALTER COLUMN segment SET NOT NULL;
ALTER TABLE public.metrics ALTER COLUMN source_id SET NOT NULL;

-- Create plain unique index that ON CONFLICT can reference
CREATE UNIQUE INDEX metrics_unique_series ON public.metrics (
  organization_id, metric_type, date, region, segment, source_id
);
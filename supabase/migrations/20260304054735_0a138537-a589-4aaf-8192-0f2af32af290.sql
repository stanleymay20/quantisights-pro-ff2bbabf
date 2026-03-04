
-- Drop the old unique constraint that's missing region/segment dimensions
DROP INDEX IF EXISTS public.metrics_org_type_date_source_unique;

-- Create new unique constraint including all series dimensions
-- Uses COALESCE for nullable columns to ensure uniqueness works correctly
CREATE UNIQUE INDEX metrics_unique_series
ON public.metrics (
  organization_id,
  metric_type,
  date,
  COALESCE(region, ''),
  COALESCE(segment, ''),
  COALESCE(source_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

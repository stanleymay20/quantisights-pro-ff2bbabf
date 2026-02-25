
-- Fix search_path on the new function
CREATE OR REPLACE FUNCTION public.immutable_date_trunc_hour(ts timestamptz)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$ SELECT date_trunc('hour', ts); $$;

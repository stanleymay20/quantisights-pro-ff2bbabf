
CREATE OR REPLACE FUNCTION public.increment_copilot_usage(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.copilot_usage (organization_id, date, call_count)
  VALUES (_org_id, CURRENT_DATE, 1)
  ON CONFLICT (organization_id, date)
  DO UPDATE SET call_count = copilot_usage.call_count + 1;
END;
$$;

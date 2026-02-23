
-- Simulation usage tracking
CREATE TABLE public.simulation_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  call_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(organization_id, date)
);

ALTER TABLE public.simulation_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view simulation usage"
  ON public.simulation_usage FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE INDEX idx_simulation_usage_org_date ON public.simulation_usage(organization_id, date);

-- Increment function
CREATE OR REPLACE FUNCTION public.increment_simulation_usage(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.simulation_usage (organization_id, date, call_count)
  VALUES (_org_id, CURRENT_DATE, 1)
  ON CONFLICT (organization_id, date)
  DO UPDATE SET call_count = simulation_usage.call_count + 1;
END;
$$;

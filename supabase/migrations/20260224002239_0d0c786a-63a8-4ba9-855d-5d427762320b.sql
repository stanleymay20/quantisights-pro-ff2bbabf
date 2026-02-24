
-- Executive Convergence Index table
CREATE TABLE public.executive_convergence_index (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  score integer NOT NULL DEFAULT 0,
  dispersion numeric NOT NULL DEFAULT 0,
  conflict_penalty numeric NOT NULL DEFAULT 0,
  volatility_divergence numeric NOT NULL DEFAULT 0,
  alignment_status text NOT NULL DEFAULT 'aligned',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_convergence_org_created ON public.executive_convergence_index(organization_id, created_at DESC);

ALTER TABLE public.executive_convergence_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view convergence" ON public.executive_convergence_index
  FOR SELECT USING (is_org_member(auth.uid(), organization_id));

-- Executive Conflicts table
CREATE TABLE public.executive_conflicts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  rule_triggered text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  role_1 text NOT NULL,
  role_2 text NOT NULL,
  description text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone
);

ALTER TABLE public.executive_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view conflicts" ON public.executive_conflicts
  FOR SELECT USING (is_org_member(auth.uid(), organization_id));

-- Convergence Usage table
CREATE TABLE public.convergence_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  call_count integer NOT NULL DEFAULT 0,
  UNIQUE(organization_id, date)
);

ALTER TABLE public.convergence_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view convergence usage" ON public.convergence_usage
  FOR SELECT USING (is_org_member(auth.uid(), organization_id));

-- Increment function
CREATE OR REPLACE FUNCTION public.increment_convergence_usage(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.convergence_usage (organization_id, date, call_count)
  VALUES (_org_id, CURRENT_DATE, 1)
  ON CONFLICT (organization_id, date)
  DO UPDATE SET call_count = convergence_usage.call_count + 1;
END;
$$;

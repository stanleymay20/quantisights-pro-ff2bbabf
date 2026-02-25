
-- Monte Carlo simulation results table
CREATE TABLE public.simulation_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  metric_type text NOT NULL,
  forecast_horizon integer NOT NULL DEFAULT 6,
  simulation_runs integer NOT NULL DEFAULT 10000,
  expected_value numeric NOT NULL,
  median_value numeric NOT NULL,
  p10_value numeric NOT NULL,
  p25_value numeric NOT NULL,
  p75_value numeric NOT NULL,
  p90_value numeric NOT NULL,
  probability_negative numeric NOT NULL DEFAULT 0,
  value_at_risk_95 numeric,
  mean_growth_rate numeric,
  volatility numeric,
  raw_confidence integer,
  capped_confidence integer,
  confidence_cap_reason text,
  variance_score numeric,
  sample_size integer NOT NULL DEFAULT 0,
  data_sufficiency text NOT NULL DEFAULT 'insufficient',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.simulation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view simulations"
  ON public.simulation_results FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins/owners can insert simulations"
  ON public.simulation_results FOR INSERT
  WITH CHECK (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY "Admins/owners can delete simulations"
  ON public.simulation_results FOR DELETE
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- Add simulation_id reference to decision_ledger
ALTER TABLE public.decision_ledger
  ADD COLUMN IF NOT EXISTS simulation_id uuid REFERENCES public.simulation_results(id),
  ADD COLUMN IF NOT EXISTS expected_value_at_decision numeric,
  ADD COLUMN IF NOT EXISTS probability_of_success numeric;


-- Decision impact simulations table
CREATE TABLE public.decision_simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  decision_id UUID REFERENCES public.decision_ledger(id),
  
  -- Impact assumptions
  revenue_delta_pct NUMERIC DEFAULT 0,
  cost_delta_pct NUMERIC DEFAULT 0,
  churn_change_pct NUMERIC DEFAULT 0,
  implementation_cost NUMERIC DEFAULT 0,
  time_to_impact_months INTEGER DEFAULT 3,
  
  -- Simulation outputs
  expected_net_impact NUMERIC,
  median_net_impact NUMERIC,
  p10_impact NUMERIC,
  p50_impact NUMERIC,
  p90_impact NUMERIC,
  probability_positive_roi NUMERIC,
  probability_cashflow_stress NUMERIC,
  risk_adjusted_expected_value NUMERIC,
  
  -- Epistemic metadata
  raw_confidence NUMERIC,
  capped_confidence NUMERIC,
  confidence_cap_reason TEXT,
  variance_score NUMERIC,
  sample_size INTEGER,
  data_sufficiency TEXT DEFAULT 'limited',
  correlation_assumptions JSONB DEFAULT '{}'::jsonb,
  model_version INTEGER DEFAULT 1,
  simulation_runs INTEGER DEFAULT 10000,
  
  -- Learning
  actual_net_impact NUMERIC,
  calibration_delta NUMERIC,
  measured_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.decision_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view decision simulations"
  ON public.decision_simulations FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins/owners can insert decision simulations"
  ON public.decision_simulations FOR INSERT
  WITH CHECK (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY "Admins/owners can update decision simulations"
  ON public.decision_simulations FOR UPDATE
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY "Admins/owners can delete decision simulations"
  ON public.decision_simulations FOR DELETE
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- Add learning calibration columns to decision_ledger
ALTER TABLE public.decision_ledger
  ADD COLUMN IF NOT EXISTS decision_simulation_id UUID REFERENCES public.decision_simulations(id),
  ADD COLUMN IF NOT EXISTS predicted_roi_probability NUMERIC,
  ADD COLUMN IF NOT EXISTS predicted_net_impact NUMERIC,
  ADD COLUMN IF NOT EXISTS model_calibration_adjustment NUMERIC DEFAULT 0;

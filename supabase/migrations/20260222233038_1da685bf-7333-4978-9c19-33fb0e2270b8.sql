
-- ============================================
-- Phase 4: Scenario Simulation Engine tables
-- ============================================

-- 1. Scenarios
CREATE TABLE public.scenarios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  forecast_start_date date NOT NULL,
  forecast_end_date date NOT NULL,
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scenarios_org ON public.scenarios(organization_id);
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view scenarios" ON public.scenarios
  FOR SELECT USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins/owners can insert scenarios" ON public.scenarios
  FOR INSERT WITH CHECK (
    get_user_org_role(auth.uid(), organization_id) = ANY(ARRAY['owner'::org_role, 'admin'::org_role])
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins/owners can update scenarios" ON public.scenarios
  FOR UPDATE USING (
    get_user_org_role(auth.uid(), organization_id) = ANY(ARRAY['owner'::org_role, 'admin'::org_role])
  );

CREATE POLICY "Admins/owners can delete scenarios" ON public.scenarios
  FOR DELETE USING (
    get_user_org_role(auth.uid(), organization_id) = ANY(ARRAY['owner'::org_role, 'admin'::org_role])
  );

CREATE TRIGGER update_scenarios_updated_at
  BEFORE UPDATE ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Scenario Assumptions
CREATE TABLE public.scenario_assumptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_id uuid NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  metric_type text NOT NULL,
  adjustment_type text NOT NULL DEFAULT 'percentage',
  adjustment_value numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scenario_assumptions_scenario ON public.scenario_assumptions(scenario_id);
ALTER TABLE public.scenario_assumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view scenario assumptions" ON public.scenario_assumptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.scenarios s WHERE s.id = scenario_id AND is_org_member(auth.uid(), s.organization_id))
  );

CREATE POLICY "Admins/owners can insert scenario assumptions" ON public.scenario_assumptions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.scenarios s WHERE s.id = scenario_id AND get_user_org_role(auth.uid(), s.organization_id) = ANY(ARRAY['owner'::org_role, 'admin'::org_role]))
  );

CREATE POLICY "Admins/owners can update scenario assumptions" ON public.scenario_assumptions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.scenarios s WHERE s.id = scenario_id AND get_user_org_role(auth.uid(), s.organization_id) = ANY(ARRAY['owner'::org_role, 'admin'::org_role]))
  );

CREATE POLICY "Admins/owners can delete scenario assumptions" ON public.scenario_assumptions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.scenarios s WHERE s.id = scenario_id AND get_user_org_role(auth.uid(), s.organization_id) = ANY(ARRAY['owner'::org_role, 'admin'::org_role]))
  );

-- 3. Scenario Results
CREATE TABLE public.scenario_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_id uuid NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  kpi_id uuid NOT NULL REFERENCES public.kpis(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  date date NOT NULL,
  baseline_value numeric NOT NULL,
  simulated_value numeric NOT NULL,
  delta_value numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scenario_results_scenario ON public.scenario_results(scenario_id);
CREATE INDEX idx_scenario_results_kpi ON public.scenario_results(kpi_id, date);
ALTER TABLE public.scenario_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view scenario results" ON public.scenario_results
  FOR SELECT USING (is_org_member(auth.uid(), organization_id));

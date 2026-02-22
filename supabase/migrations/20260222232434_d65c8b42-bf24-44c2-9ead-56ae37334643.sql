
-- ============================================
-- Phase 2: KPI Builder Engine tables
-- ============================================

-- 1. KPI definitions
CREATE TABLE public.kpis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  formula text NOT NULL,
  metric_dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  aggregation_type text NOT NULL DEFAULT 'sum',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active'
);

CREATE INDEX idx_kpis_org ON public.kpis(organization_id);
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view KPIs" ON public.kpis
  FOR SELECT USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins/owners can insert KPIs" ON public.kpis
  FOR INSERT WITH CHECK (
    get_user_org_role(auth.uid(), organization_id) = ANY(ARRAY['owner'::org_role, 'admin'::org_role])
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins/owners can update KPIs" ON public.kpis
  FOR UPDATE USING (
    get_user_org_role(auth.uid(), organization_id) = ANY(ARRAY['owner'::org_role, 'admin'::org_role])
  );

CREATE POLICY "Admins/owners can delete KPIs" ON public.kpis
  FOR DELETE USING (
    get_user_org_role(auth.uid(), organization_id) = ANY(ARRAY['owner'::org_role, 'admin'::org_role])
  );

CREATE TRIGGER update_kpis_updated_at
  BEFORE UPDATE ON public.kpis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. KPI computed values
CREATE TABLE public.kpi_values (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kpi_id uuid NOT NULL REFERENCES public.kpis(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  date date NOT NULL,
  value numeric NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kpi_values_kpi_date ON public.kpi_values(kpi_id, date);
CREATE INDEX idx_kpi_values_org ON public.kpi_values(organization_id);
ALTER TABLE public.kpi_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view KPI values" ON public.kpi_values
  FOR SELECT USING (is_org_member(auth.uid(), organization_id));

-- 3. KPI targets
CREATE TABLE public.kpi_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kpi_id uuid NOT NULL REFERENCES public.kpis(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  target_value numeric NOT NULL,
  target_date date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kpi_targets_kpi ON public.kpi_targets(kpi_id);
ALTER TABLE public.kpi_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view KPI targets" ON public.kpi_targets
  FOR SELECT USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins/owners can insert KPI targets" ON public.kpi_targets
  FOR INSERT WITH CHECK (
    get_user_org_role(auth.uid(), organization_id) = ANY(ARRAY['owner'::org_role, 'admin'::org_role])
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins/owners can delete KPI targets" ON public.kpi_targets
  FOR DELETE USING (
    get_user_org_role(auth.uid(), organization_id) = ANY(ARRAY['owner'::org_role, 'admin'::org_role])
  );

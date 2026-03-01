
-- ═══════════════════════════════════════════════════
-- 1. OKR Engine: Objectives & Key Results
-- ═══════════════════════════════════════════════════

CREATE TABLE public.objectives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL,
  parent_id UUID REFERENCES public.objectives(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  time_period TEXT NOT NULL DEFAULT 'Q1 2026',
  progress NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.key_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  objective_id UUID NOT NULL REFERENCES public.objectives(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  metric_type TEXT,
  kpi_id UUID REFERENCES public.kpis(id) ON DELETE SET NULL,
  target_value NUMERIC NOT NULL DEFAULT 0,
  current_value NUMERIC NOT NULL DEFAULT 0,
  unit TEXT DEFAULT '%',
  status TEXT NOT NULL DEFAULT 'on_track',
  weight NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- 2. Alert Playbooks
-- ═══════════════════════════════════════════════════

CREATE TABLE public.alert_playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_metric TEXT NOT NULL,
  trigger_condition TEXT NOT NULL DEFAULT 'exceeds',
  trigger_threshold NUMERIC NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  escalation_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.playbook_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playbook_id UUID NOT NULL REFERENCES public.alert_playbooks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trigger_value NUMERIC,
  status TEXT NOT NULL DEFAULT 'running',
  steps_completed INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 0,
  execution_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════
-- 3. Forecast Results (AI time-series predictions)
-- ═══════════════════════════════════════════════════

CREATE TABLE public.forecast_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  forecast_horizon_months INTEGER NOT NULL DEFAULT 6,
  model_used TEXT NOT NULL DEFAULT 'ai-trend',
  predictions JSONB NOT NULL DEFAULT '[]'::jsonb,
  seasonality_detected BOOLEAN DEFAULT false,
  trend_direction TEXT DEFAULT 'stable',
  confidence_interval NUMERIC DEFAULT 0.95,
  mape NUMERIC,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- ═══════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════

ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_results ENABLE ROW LEVEL SECURITY;

-- Objectives
CREATE POLICY "Org members can view objectives" ON public.objectives FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admins can insert objectives" ON public.objectives FOR INSERT WITH CHECK (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));
CREATE POLICY "Admins can update objectives" ON public.objectives FOR UPDATE USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));
CREATE POLICY "Admins can delete objectives" ON public.objectives FOR DELETE USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- Key Results
CREATE POLICY "Org members can view key results" ON public.key_results FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admins can insert key results" ON public.key_results FOR INSERT WITH CHECK (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));
CREATE POLICY "Admins can update key results" ON public.key_results FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admins can delete key results" ON public.key_results FOR DELETE USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- Alert Playbooks
CREATE POLICY "Org members can view playbooks" ON public.alert_playbooks FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admins can insert playbooks" ON public.alert_playbooks FOR INSERT WITH CHECK (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));
CREATE POLICY "Admins can update playbooks" ON public.alert_playbooks FOR UPDATE USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));
CREATE POLICY "Admins can delete playbooks" ON public.alert_playbooks FOR DELETE USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- Playbook Executions
CREATE POLICY "Org members can view executions" ON public.playbook_executions FOR SELECT USING (is_org_member(auth.uid(), organization_id));

-- Forecast Results
CREATE POLICY "Org members can view forecasts" ON public.forecast_results FOR SELECT USING (is_org_member(auth.uid(), organization_id));

-- Timestamps triggers
CREATE TRIGGER update_objectives_updated_at BEFORE UPDATE ON public.objectives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_key_results_updated_at BEFORE UPDATE ON public.key_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_playbooks_updated_at BEFORE UPDATE ON public.alert_playbooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

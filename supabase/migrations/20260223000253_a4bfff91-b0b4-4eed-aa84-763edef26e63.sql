
-- =============================================
-- Phase 5.1: Executive Signal Engine
-- =============================================

-- 1) executive_risk_index
CREATE TABLE public.executive_risk_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  role_type text NOT NULL CHECK (role_type IN ('ceo', 'cfo', 'cmo', 'coo')),
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  components jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (organization_id, role_type)
);

CREATE INDEX idx_exec_risk_org ON public.executive_risk_index(organization_id);

ALTER TABLE public.executive_risk_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view risk index"
  ON public.executive_risk_index FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

-- 2) executive_alerts
CREATE TABLE public.executive_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  role_type text NOT NULL CHECK (role_type IN ('ceo', 'cfo', 'cmo', 'coo')),
  kpi_id uuid REFERENCES public.kpis(id),
  metric_type text,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('critical', 'warning', 'info')),
  trigger_value numeric,
  threshold_value numeric,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone
);

CREATE INDEX idx_exec_alerts_org ON public.executive_alerts(organization_id);
CREATE INDEX idx_exec_alerts_status ON public.executive_alerts(organization_id, status);

ALTER TABLE public.executive_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view alerts"
  ON public.executive_alerts FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

-- 3) executive_briefs (historical storage)
CREATE TABLE public.executive_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  role_type text NOT NULL CHECK (role_type IN ('ceo', 'cfo', 'cmo', 'coo')),
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_score integer DEFAULT 0,
  generated_by text NOT NULL DEFAULT 'manual' CHECK (generated_by IN ('ai', 'scheduled', 'manual')),
  generated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_exec_briefs_org ON public.executive_briefs(organization_id);
CREATE INDEX idx_exec_briefs_lookup ON public.executive_briefs(organization_id, role_type, generated_at DESC);

ALTER TABLE public.executive_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view briefs"
  ON public.executive_briefs FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

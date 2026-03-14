
-- Add 'steward' to org_role enum
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'steward';

-- Create data retention policies table
CREATE TABLE public.data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  data_category TEXT NOT NULL,
  retention_days INTEGER NOT NULL DEFAULT 90,
  auto_cleanup BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, data_category)
);

ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view retention policies"
  ON public.data_retention_policies FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins can manage retention policies"
  ON public.data_retention_policies FOR ALL TO authenticated
  USING (public.get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'))
  WITH CHECK (public.get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

-- Create governance maturity assessments table
CREATE TABLE public.governance_maturity_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assessed_by UUID NOT NULL,
  overall_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  dimensions JSONB NOT NULL DEFAULT '{}',
  recommendations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.governance_maturity_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view maturity assessments"
  ON public.governance_maturity_assessments FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Authenticated users can insert maturity assessments"
  ON public.governance_maturity_assessments FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

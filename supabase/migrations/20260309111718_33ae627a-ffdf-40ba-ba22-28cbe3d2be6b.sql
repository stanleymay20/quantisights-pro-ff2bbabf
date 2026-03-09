
-- Organizational Identity Profile table
CREATE TABLE public.organizational_identity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Strategic Identity
  vision_statement text,
  mission_statement text,
  core_values jsonb DEFAULT '[]'::jsonb,
  strategic_priorities jsonb DEFAULT '[]'::jsonb,
  
  -- Culture & Decision Philosophy
  risk_appetite text DEFAULT 'moderate' CHECK (risk_appetite IN ('conservative', 'moderate', 'aggressive', 'visionary')),
  innovation_posture text DEFAULT 'balanced' CHECK (innovation_posture IN ('defender', 'balanced', 'explorer', 'disruptor')),
  decision_speed_preference text DEFAULT 'balanced' CHECK (decision_speed_preference IN ('deliberate', 'balanced', 'agile', 'rapid')),
  stakeholder_orientation text DEFAULT 'balanced' CHECK (stakeholder_orientation IN ('shareholder', 'balanced', 'stakeholder', 'community')),
  
  -- Decision Principles & Governance
  decision_principles jsonb DEFAULT '[]'::jsonb,
  ethical_boundaries jsonb DEFAULT '[]'::jsonb,
  governance_model text DEFAULT 'collaborative' CHECK (governance_model IN ('centralized', 'collaborative', 'delegated', 'consensus')),
  
  -- External Factors
  competitive_position text,
  regulatory_environment text,
  market_stage text DEFAULT 'growth' CHECK (market_stage IN ('startup', 'growth', 'mature', 'turnaround', 'decline')),
  industry_context text,
  
  -- Stakeholder Map
  key_stakeholders jsonb DEFAULT '[]'::jsonb,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.organizational_identity ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Members can view org identity"
  ON public.organizational_identity FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins can insert org identity"
  ON public.organizational_identity FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can update org identity"
  ON public.organizational_identity FOR UPDATE TO authenticated
  USING (
    public.get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin')
  );

-- Updated_at trigger
CREATE TRIGGER update_organizational_identity_updated_at
  BEFORE UPDATE ON public.organizational_identity
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index
CREATE INDEX idx_org_identity_org_id ON public.organizational_identity(organization_id);

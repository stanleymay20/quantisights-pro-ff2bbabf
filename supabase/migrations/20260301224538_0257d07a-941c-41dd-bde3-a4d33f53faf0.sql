
-- =============================================
-- COLLABORATIVE DECISION WORKFLOWS
-- =============================================

-- Decision comments with @mentions support
CREATE TABLE public.decision_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  decision_id uuid NOT NULL REFERENCES public.decision_ledger(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  mentions uuid[] DEFAULT '{}',
  parent_id uuid REFERENCES public.decision_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.decision_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view comments" ON public.decision_comments
  FOR SELECT USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert comments" ON public.decision_comments
  FOR INSERT WITH CHECK (is_org_member(auth.uid(), organization_id) AND user_id = auth.uid());

CREATE POLICY "Users can update own comments" ON public.decision_comments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own comments" ON public.decision_comments
  FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_decision_comments_updated_at
  BEFORE UPDATE ON public.decision_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Decision approvals workflow
CREATE TABLE public.decision_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  decision_id uuid NOT NULL REFERENCES public.decision_ledger(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  approver_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  verdict text,
  comments text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

ALTER TABLE public.decision_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view approvals" ON public.decision_approvals
  FOR SELECT USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins can create approvals" ON public.decision_approvals
  FOR INSERT WITH CHECK (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY "Approvers can update their approvals" ON public.decision_approvals
  FOR UPDATE USING (approver_id = auth.uid());

-- Scenario branches for what-if comparison
CREATE TABLE public.scenario_branches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  parameters jsonb NOT NULL DEFAULT '{}',
  results jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  comparison_group_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scenario_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view branches" ON public.scenario_branches
  FOR SELECT USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert branches" ON public.scenario_branches
  FOR INSERT WITH CHECK (is_org_member(auth.uid(), organization_id) AND created_by = auth.uid());

CREATE POLICY "Creators can update branches" ON public.scenario_branches
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Creators can delete branches" ON public.scenario_branches
  FOR DELETE USING (created_by = auth.uid());

CREATE TRIGGER update_scenario_branches_updated_at
  BEFORE UPDATE ON public.scenario_branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AI explainability audit records
CREATE TABLE public.ai_explanations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  feature_attributions jsonb NOT NULL DEFAULT '[]',
  model_used text,
  explanation_narrative text,
  confidence_breakdown jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_explanations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view explanations" ON public.ai_explanations
  FOR SELECT USING (is_org_member(auth.uid(), organization_id));

-- External data enrichment sources
CREATE TABLE public.external_signals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  signal_type text NOT NULL,
  source text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  relevance_score numeric DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.external_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view signals" ON public.external_signals
  FOR SELECT USING (is_org_member(auth.uid(), organization_id));

-- NLQ query history
CREATE TABLE public.nlq_queries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  query_text text NOT NULL,
  interpreted_intent jsonb DEFAULT '{}',
  results jsonb DEFAULT '{}',
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nlq_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own queries" ON public.nlq_queries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own queries" ON public.nlq_queries
  FOR INSERT WITH CHECK (is_org_member(auth.uid(), organization_id) AND user_id = auth.uid());

-- Enable realtime for comments (collaborative feature)
ALTER PUBLICATION supabase_realtime ADD TABLE public.decision_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.decision_approvals;

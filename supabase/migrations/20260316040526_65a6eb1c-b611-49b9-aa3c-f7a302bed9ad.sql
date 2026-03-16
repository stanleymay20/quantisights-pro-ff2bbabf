
-- Execution Plans: actions tied to decisions
CREATE TABLE public.execution_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.decision_ledger(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_title TEXT NOT NULL,
  action_description TEXT,
  owner_user_id UUID,
  priority TEXT NOT NULL DEFAULT 'medium',
  deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  trigger_type TEXT DEFAULT 'manual',
  trigger_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Execution Events: operational breadcrumbs
CREATE TABLE public.execution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_plan_id UUID NOT NULL REFERENCES public.execution_plans(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Decision Replays: re-evaluate past decisions with current data
CREATE TABLE public.decision_replays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.decision_ledger(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  replayed_by UUID NOT NULL,
  original_confidence NUMERIC,
  replayed_confidence NUMERIC,
  confidence_drift NUMERIC,
  original_recommendation TEXT,
  replayed_recommendation TEXT,
  recommendation_changed BOOLEAN DEFAULT false,
  current_data_summary JSONB DEFAULT '{}'::jsonb,
  replay_narrative TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_execution_plans_decision ON public.execution_plans(decision_id);
CREATE INDEX idx_execution_plans_org ON public.execution_plans(organization_id);
CREATE INDEX idx_execution_plans_status ON public.execution_plans(status);
CREATE INDEX idx_execution_events_plan ON public.execution_events(execution_plan_id);
CREATE INDEX idx_execution_events_org ON public.execution_events(organization_id);
CREATE INDEX idx_decision_replays_decision ON public.decision_replays(decision_id);
CREATE INDEX idx_decision_replays_org ON public.decision_replays(organization_id);

-- Enable RLS
ALTER TABLE public.execution_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_replays ENABLE ROW LEVEL SECURITY;

-- RLS: execution_plans
CREATE POLICY "execution_plans_select" ON public.execution_plans
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "execution_plans_insert" ON public.execution_plans
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "execution_plans_update" ON public.execution_plans
  FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "execution_plans_delete" ON public.execution_plans
  FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id)
    AND public.get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

-- RLS: execution_events (immutable - no update/delete for audit)
CREATE POLICY "execution_events_select" ON public.execution_events
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "execution_events_insert" ON public.execution_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- RLS: decision_replays
CREATE POLICY "decision_replays_select" ON public.decision_replays
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "decision_replays_insert" ON public.decision_replays
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- Updated_at trigger
CREATE TRIGGER set_execution_plans_updated_at
  BEFORE UPDATE ON public.execution_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for execution_plans
ALTER PUBLICATION supabase_realtime ADD TABLE public.execution_plans;

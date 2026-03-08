
-- Decision outcomes table for closed-loop evaluation
CREATE TABLE public.decision_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.decision_ledger(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  dataset_id UUID REFERENCES public.datasets(id),
  expected_metric TEXT NOT NULL,
  expected_direction TEXT NOT NULL DEFAULT 'increase',
  expected_change NUMERIC,
  evaluation_window_days INTEGER NOT NULL DEFAULT 30,
  observed_metric TEXT,
  observed_value_before NUMERIC,
  observed_value_after NUMERIC,
  outcome_status TEXT NOT NULL DEFAULT 'pending',
  evaluation_date TIMESTAMPTZ,
  accuracy_score NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_decision_outcomes_org ON public.decision_outcomes(organization_id);
CREATE INDEX idx_decision_outcomes_decision ON public.decision_outcomes(decision_id);
CREATE INDEX idx_decision_outcomes_status ON public.decision_outcomes(organization_id, outcome_status);
CREATE INDEX idx_decision_outcomes_dataset ON public.decision_outcomes(dataset_id);

-- RLS
ALTER TABLE public.decision_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org outcomes"
  ON public.decision_outcomes FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can insert own org outcomes"
  ON public.decision_outcomes FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can update own org outcomes"
  ON public.decision_outcomes FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

-- Enable realtime for outcome updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.decision_outcomes;


-- Decision Contexts: core entity for scoping all analysis
CREATE TABLE public.decision_contexts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  industry TEXT,
  decision_type TEXT NOT NULL DEFAULT 'general',
  objective TEXT,
  target_metrics JSONB DEFAULT '[]'::jsonb,
  datasets JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_decision_contexts_org ON public.decision_contexts(organization_id);
CREATE INDEX idx_decision_contexts_type ON public.decision_contexts(organization_id, decision_type);

-- RLS
ALTER TABLE public.decision_contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view decision contexts"
  ON public.decision_contexts FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert decision contexts"
  ON public.decision_contexts FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update decision contexts"
  ON public.decision_contexts FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can delete decision contexts"
  ON public.decision_contexts FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

-- Add decision_context_id to decision_ledger
ALTER TABLE public.decision_ledger 
  ADD COLUMN IF NOT EXISTS decision_context_id UUID REFERENCES public.decision_contexts(id);

CREATE INDEX idx_decision_ledger_context ON public.decision_ledger(decision_context_id);

-- Add decision_context_id to insights
ALTER TABLE public.insights
  ADD COLUMN IF NOT EXISTS decision_context_id UUID REFERENCES public.decision_contexts(id);

-- Add decision_context_id to advisory_instances
ALTER TABLE public.advisory_instances
  ADD COLUMN IF NOT EXISTS decision_context_id UUID REFERENCES public.decision_contexts(id);

-- Updated_at trigger
CREATE TRIGGER update_decision_contexts_updated_at
  BEFORE UPDATE ON public.decision_contexts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

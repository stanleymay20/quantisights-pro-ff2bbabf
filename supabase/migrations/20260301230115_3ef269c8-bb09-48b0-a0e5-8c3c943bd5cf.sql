
-- Causal Models: stores causal DAG structures and inference results
CREATE TABLE public.causal_models (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  dag_structure jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  inference_results jsonb DEFAULT '[]',
  confidence_score numeric,
  sample_size integer,
  model_status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.causal_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view causal models" ON public.causal_models FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admins can insert causal models" ON public.causal_models FOR INSERT WITH CHECK (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));
CREATE POLICY "Admins can update causal models" ON public.causal_models FOR UPDATE USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));
CREATE POLICY "Admins can delete causal models" ON public.causal_models FOR DELETE USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- Cognitive Bias Detections: stores detected biases in decision patterns
CREATE TABLE public.cognitive_bias_detections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  decision_id uuid REFERENCES public.decision_ledger(id),
  bias_type text NOT NULL,
  bias_name text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  confidence numeric,
  evidence jsonb DEFAULT '[]',
  mitigation_suggestion text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  dismissed_by uuid
);

ALTER TABLE public.cognitive_bias_detections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view bias detections" ON public.cognitive_bias_detections FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admins can dismiss bias detections" ON public.cognitive_bias_detections FOR UPDATE USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- Counterfactual Analyses: stores "what would need to change" explanations
CREATE TABLE public.counterfactual_analyses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  original_recommendation text NOT NULL,
  counterfactual_scenario text NOT NULL,
  factors_to_change jsonb NOT NULL DEFAULT '[]',
  sensitivity_ranking jsonb DEFAULT '[]',
  minimum_changes_required integer DEFAULT 1,
  confidence numeric,
  narrative text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.counterfactual_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view counterfactuals" ON public.counterfactual_analyses FOR SELECT USING (is_org_member(auth.uid(), organization_id));

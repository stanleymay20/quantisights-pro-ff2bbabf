
-- Adaptive Calibration Models: stores per-org learned correction factors
CREATE TABLE public.calibration_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  band_corrections jsonb NOT NULL DEFAULT '{}'::jsonb,
  band_sample_sizes jsonb NOT NULL DEFAULT '{}'::jsonb,
  overall_calibration_score numeric DEFAULT NULL,
  overall_bias_direction text DEFAULT 'neutral',
  total_decisions_analyzed integer NOT NULL DEFAULT 0,
  model_version integer NOT NULL DEFAULT 1,
  confidence_bands_count integer NOT NULL DEFAULT 0,
  mean_absolute_error numeric DEFAULT NULL,
  ai_narrative text DEFAULT NULL,
  computed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Each org should only have the latest model easily queryable
CREATE INDEX idx_calibration_models_org_computed ON public.calibration_models (organization_id, computed_at DESC);

-- Enable RLS
ALTER TABLE public.calibration_models ENABLE ROW LEVEL SECURITY;

-- Org members can view calibration models
CREATE POLICY "Org members can view calibration models"
ON public.calibration_models
FOR SELECT
TO authenticated
USING (is_org_member(auth.uid(), organization_id));

-- No direct client insert/update/delete - managed by edge function via service role

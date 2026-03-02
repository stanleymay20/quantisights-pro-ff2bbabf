
-- Calibration assessments: stores each user's calibration test results
CREATE TABLE public.calibration_assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  responses jsonb NOT NULL DEFAULT '[]'::jsonb,
  overconfidence_score numeric,
  underconfidence_score numeric,
  brier_score numeric,
  calibration_profile text DEFAULT 'uncalibrated',
  bias_markers jsonb DEFAULT '[]'::jsonb,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calibration_assessments ENABLE ROW LEVEL SECURITY;

-- Users can view own assessments
CREATE POLICY "Users can view own assessments"
  ON public.calibration_assessments FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert own assessments
CREATE POLICY "Users can insert own assessments"
  ON public.calibration_assessments FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update own assessments
CREATE POLICY "Users can update own assessments"
  ON public.calibration_assessments FOR UPDATE
  USING (user_id = auth.uid());

-- Org members can view team assessments (for leaderboards)
CREATE POLICY "Org members can view team assessments"
  ON public.calibration_assessments FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

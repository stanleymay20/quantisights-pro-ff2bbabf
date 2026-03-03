
-- Add model metadata fields for defensibility
ALTER TABLE public.calibration_models
  ADD COLUMN success_metric text NOT NULL DEFAULT 'prediction_accuracy_score',
  ADD COLUMN window_start timestamp with time zone DEFAULT NULL,
  ADD COLUMN window_end timestamp with time zone DEFAULT NULL,
  ADD COLUMN window_decisions_count integer NOT NULL DEFAULT 0,
  ADD COLUMN smoothing_alpha numeric NOT NULL DEFAULT 1,
  ADD COLUMN smoothing_beta numeric NOT NULL DEFAULT 1,
  ADD COLUMN low_sample_bands jsonb NOT NULL DEFAULT '[]'::jsonb;

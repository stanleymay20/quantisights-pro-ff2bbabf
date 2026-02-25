
-- Add raw vs capped confidence metadata to advisory_instances
ALTER TABLE public.advisory_instances
  ADD COLUMN IF NOT EXISTS raw_confidence integer,
  ADD COLUMN IF NOT EXISTS capped_confidence integer,
  ADD COLUMN IF NOT EXISTS confidence_cap_reason text,
  ADD COLUMN IF NOT EXISTS variance_score numeric,
  ADD COLUMN IF NOT EXISTS data_quality_index integer DEFAULT 100;

-- Add raw vs capped confidence metadata to insights
ALTER TABLE public.insights
  ADD COLUMN IF NOT EXISTS raw_confidence integer,
  ADD COLUMN IF NOT EXISTS capped_confidence integer,
  ADD COLUMN IF NOT EXISTS confidence_cap_reason text,
  ADD COLUMN IF NOT EXISTS sample_size integer,
  ADD COLUMN IF NOT EXISTS variance_score numeric,
  ADD COLUMN IF NOT EXISTS data_quality_index integer DEFAULT 100;

-- Add calibration scoring columns to decision_ledger
ALTER TABLE public.decision_ledger
  ADD COLUMN IF NOT EXISTS prediction_accuracy_score numeric,
  ADD COLUMN IF NOT EXISTS calibration_error numeric,
  ADD COLUMN IF NOT EXISTS raw_confidence numeric,
  ADD COLUMN IF NOT EXISTS capped_confidence numeric,
  ADD COLUMN IF NOT EXISTS confidence_cap_reason text;

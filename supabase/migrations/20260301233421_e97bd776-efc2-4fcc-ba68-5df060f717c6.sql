-- Add trial columns to subscriptions table
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_end timestamp with time zone;
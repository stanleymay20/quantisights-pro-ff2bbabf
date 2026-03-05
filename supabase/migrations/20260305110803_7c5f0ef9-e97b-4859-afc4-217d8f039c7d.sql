
-- Add dataset_id to reports
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS dataset_id uuid REFERENCES public.datasets(id);
CREATE INDEX IF NOT EXISTS idx_reports_dataset_id ON public.reports(dataset_id);

-- Add dataset_id to scenarios
ALTER TABLE public.scenarios ADD COLUMN IF NOT EXISTS dataset_id uuid REFERENCES public.datasets(id);
CREATE INDEX IF NOT EXISTS idx_scenarios_dataset_id ON public.scenarios(dataset_id);

-- Add dataset_id to simulation_results
ALTER TABLE public.simulation_results ADD COLUMN IF NOT EXISTS dataset_id uuid REFERENCES public.datasets(id);
CREATE INDEX IF NOT EXISTS idx_simulation_results_dataset_id ON public.simulation_results(dataset_id);

-- Add dataset_id to forecast_results
ALTER TABLE public.forecast_results ADD COLUMN IF NOT EXISTS dataset_id uuid REFERENCES public.datasets(id);
CREATE INDEX IF NOT EXISTS idx_forecast_results_dataset_id ON public.forecast_results(dataset_id);

-- Add dataset_id to external_signals
ALTER TABLE public.external_signals ADD COLUMN IF NOT EXISTS dataset_id uuid REFERENCES public.datasets(id);
CREATE INDEX IF NOT EXISTS idx_external_signals_dataset_id ON public.external_signals(dataset_id);

-- Add dataset_id to advisory_instances
ALTER TABLE public.advisory_instances ADD COLUMN IF NOT EXISTS dataset_id uuid REFERENCES public.datasets(id);
CREATE INDEX IF NOT EXISTS idx_advisory_instances_dataset_id ON public.advisory_instances(dataset_id);

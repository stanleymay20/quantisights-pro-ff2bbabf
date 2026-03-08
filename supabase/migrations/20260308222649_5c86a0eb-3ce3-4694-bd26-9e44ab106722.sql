
ALTER TABLE public.kpis ADD COLUMN IF NOT EXISTS dataset_id uuid REFERENCES public.datasets(id);
CREATE INDEX IF NOT EXISTS idx_kpis_dataset_id ON public.kpis(dataset_id);

ALTER TABLE public.portfolio_companies ADD COLUMN IF NOT EXISTS dataset_id UUID REFERENCES public.datasets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_portfolio_companies_dataset_id ON public.portfolio_companies(dataset_id);

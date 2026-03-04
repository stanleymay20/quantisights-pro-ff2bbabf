
-- 1. Add composite index on metrics(organization_id, dataset_id, date) for dataset-scoped queries
CREATE INDEX IF NOT EXISTS idx_metrics_org_dataset_date 
ON public.metrics (organization_id, dataset_id, date);

-- 2. Add index on metrics(dataset_id) for fast dataset-scoped lookups
CREATE INDEX IF NOT EXISTS idx_metrics_dataset_id 
ON public.metrics (dataset_id) WHERE dataset_id IS NOT NULL;

-- 3. Add dataset_id column to insights table for dataset-scoped intelligence
ALTER TABLE public.insights ADD COLUMN IF NOT EXISTS dataset_id uuid REFERENCES public.datasets(id) ON DELETE SET NULL;

-- 4. Add composite index on insights for dataset-scoped queries
CREATE INDEX IF NOT EXISTS idx_insights_org_dataset_created 
ON public.insights (organization_id, dataset_id, created_at DESC) WHERE dataset_id IS NOT NULL;

-- 5. Add index on datasets(organization_id) for org-scoped dataset listings
CREATE INDEX IF NOT EXISTS idx_datasets_organization_id 
ON public.datasets (organization_id);

-- 6. Add foreign key from metrics.dataset_id to datasets.id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'metrics_dataset_id_fkey' AND table_name = 'metrics'
  ) THEN
    ALTER TABLE public.metrics 
    ADD CONSTRAINT metrics_dataset_id_fkey 
    FOREIGN KEY (dataset_id) REFERENCES public.datasets(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 7. Add foreign key from projects.active_dataset_id to datasets.id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'projects_active_dataset_id_fkey' AND table_name = 'projects'
  ) THEN
    ALTER TABLE public.projects 
    ADD CONSTRAINT projects_active_dataset_id_fkey 
    FOREIGN KEY (active_dataset_id) REFERENCES public.datasets(id) ON DELETE SET NULL;
  END IF;
END $$;

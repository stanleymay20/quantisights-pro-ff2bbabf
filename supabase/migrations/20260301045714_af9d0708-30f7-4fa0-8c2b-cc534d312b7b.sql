
-- Composite unique index to support UPSERT in connector-pull
-- Uses COALESCE to handle nullable source_id
CREATE UNIQUE INDEX IF NOT EXISTS metrics_org_type_date_source_unique
ON public.metrics (organization_id, metric_type, date, COALESCE(source_id, '00000000-0000-0000-0000-000000000000'));

-- Performance indexes for decision intelligence queries
CREATE INDEX IF NOT EXISTS idx_decision_ledger_org_id ON public.decision_ledger (organization_id);
CREATE INDEX IF NOT EXISTS idx_decision_simulations_org_id ON public.decision_simulations (organization_id);
CREATE INDEX IF NOT EXISTS idx_data_sync_jobs_source_id ON public.data_sync_jobs (data_source_id);

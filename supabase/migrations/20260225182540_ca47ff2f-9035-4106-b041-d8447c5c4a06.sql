
-- ============================================
-- DECISION LEDGER: Track every advisory decision and measure outcomes
-- ============================================
CREATE TABLE public.decision_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  advisory_instance_id UUID REFERENCES public.advisory_instances(id),
  decision_type TEXT NOT NULL DEFAULT 'strategic',
  recommended_action TEXT NOT NULL,
  chosen_action TEXT,
  decision_status TEXT NOT NULL DEFAULT 'pending',
  execution_status TEXT NOT NULL DEFAULT 'not_started',
  outcome_delta NUMERIC,
  confidence_at_decision NUMERIC,
  confidence_updated NUMERIC,
  baseline_value NUMERIC,
  actual_value NUMERIC,
  kpi_id UUID REFERENCES public.kpis(id),
  decided_by UUID,
  decided_at TIMESTAMP WITH TIME ZONE,
  execution_started_at TIMESTAMP WITH TIME ZONE,
  execution_completed_at TIMESTAMP WITH TIME ZONE,
  outcome_measured_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.decision_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view decisions"
  ON public.decision_ledger FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins/owners can insert decisions"
  ON public.decision_ledger FOR INSERT
  WITH CHECK (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY "Admins/owners can update decisions"
  ON public.decision_ledger FOR UPDATE
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY "Admins/owners can delete decisions"
  ON public.decision_ledger FOR DELETE
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE TRIGGER update_decision_ledger_updated_at
  BEFORE UPDATE ON public.decision_ledger
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- INDUSTRY BENCHMARKS: Normalized KPI benchmarks by industry
-- ============================================
CREATE TABLE public.industry_benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  industry TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  revenue_band TEXT,
  size_band TEXT,
  region TEXT,
  p10 NUMERIC NOT NULL DEFAULT 0,
  p25 NUMERIC NOT NULL DEFAULT 0,
  p50 NUMERIC NOT NULL DEFAULT 0,
  p75 NUMERIC NOT NULL DEFAULT 0,
  p90 NUMERIC NOT NULL DEFAULT 0,
  sample_size INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'internal',
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(industry, metric_type, revenue_band, size_band, region, valid_from)
);

ALTER TABLE public.industry_benchmarks ENABLE ROW LEVEL SECURITY;

-- Benchmarks are readable by all authenticated users (they are anonymized/aggregated data)
CREATE POLICY "Authenticated users can view benchmarks"
  ON public.industry_benchmarks FOR SELECT
  USING (true);

-- Only system (service role) inserts benchmarks, no user insert policy needed

CREATE TRIGGER update_industry_benchmarks_updated_at
  BEFORE UPDATE ON public.industry_benchmarks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- BENCHMARK SCORES: Per-org percentile scoring against benchmarks
-- ============================================
CREATE TABLE public.benchmark_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  benchmark_id UUID NOT NULL REFERENCES public.industry_benchmarks(id),
  metric_type TEXT NOT NULL,
  current_value NUMERIC NOT NULL,
  percentile_rank NUMERIC NOT NULL DEFAULT 50,
  quartile INTEGER NOT NULL DEFAULT 2,
  gap_to_p75 NUMERIC,
  gap_to_p90 NUMERIC,
  trend TEXT DEFAULT 'stable',
  computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.benchmark_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view benchmark scores"
  ON public.benchmark_scores FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_decision_ledger_org ON public.decision_ledger(organization_id);
CREATE INDEX idx_decision_ledger_status ON public.decision_ledger(decision_status, execution_status);
CREATE INDEX idx_industry_benchmarks_lookup ON public.industry_benchmarks(industry, metric_type);
CREATE INDEX idx_benchmark_scores_org ON public.benchmark_scores(organization_id);

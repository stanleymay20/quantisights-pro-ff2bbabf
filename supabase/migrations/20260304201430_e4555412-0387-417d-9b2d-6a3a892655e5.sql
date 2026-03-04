
-- Portfolio companies table for PE/VC portfolio tracking
CREATE TABLE public.portfolio_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sector TEXT NOT NULL DEFAULT 'technology',
  investment_date DATE,
  investment_amount NUMERIC,
  ownership_pct NUMERIC,
  current_valuation NUMERIC,
  revenue_ltm NUMERIC DEFAULT 0,
  ebitda_ltm NUMERIC DEFAULT 0,
  revenue_growth_pct NUMERIC DEFAULT 0,
  ebitda_margin_pct NUMERIC DEFAULT 0,
  cash_runway_months INTEGER,
  headcount INTEGER,
  risk_score INTEGER DEFAULT 50,
  risk_trend TEXT DEFAULT 'stable',
  health_status TEXT DEFAULT 'on_track',
  last_board_date DATE,
  next_board_date DATE,
  fund_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portfolio_companies ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Org members can view portfolio companies"
  ON public.portfolio_companies FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins can insert portfolio companies"
  ON public.portfolio_companies FOR INSERT
  TO authenticated
  WITH CHECK (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY "Admins can update portfolio companies"
  ON public.portfolio_companies FOR UPDATE
  TO authenticated
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY "Admins can delete portfolio companies"
  ON public.portfolio_companies FOR DELETE
  TO authenticated
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- Index for fast org lookups
CREATE INDEX idx_portfolio_companies_org ON public.portfolio_companies(organization_id);

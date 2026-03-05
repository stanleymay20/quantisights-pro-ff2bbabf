import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PortfolioCompany {
  id: string;
  organization_id: string;
  dataset_id?: string | null;
  name: string;
  sector: string;
  investment_date: string | null;
  investment_amount: number | null;
  ownership_pct: number | null;
  current_valuation: number | null;
  revenue_ltm: number;
  ebitda_ltm: number;
  revenue_growth_pct: number;
  ebitda_margin_pct: number;
  cash_runway_months: number | null;
  headcount: number | null;
  risk_score: number;
  risk_trend: string;
  health_status: string;
  last_board_date: string | null;
  next_board_date: string | null;
  fund_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Hook to fetch portfolio companies — REQUIRES dataset_id (Active Data Contract).
 */
export const usePortfolioCompanies = (orgId: string | null, datasetId: string | null) => {
  const [companies, setCompanies] = useState<PortfolioCompany[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!orgId || !datasetId) { setCompanies([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("portfolio_companies")
      .select("*")
      .eq("organization_id", orgId)
      .eq("dataset_id", datasetId)
      .order("name");

    if (!error && data) setCompanies(data as PortfolioCompany[]);
    setLoading(false);
  }, [orgId, datasetId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addCompany = async (company: Partial<PortfolioCompany> & { name: string; organization_id: string }) => {
    const { data, error } = await supabase.from("portfolio_companies").insert(company).select().single();
    if (!error && data) { await fetch(); return data as PortfolioCompany; }
    throw error;
  };

  const updateCompany = async (id: string, updates: Partial<PortfolioCompany>) => {
    const { error } = await supabase.from("portfolio_companies").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
    if (!error) await fetch();
    else throw error;
  };

  const deleteCompany = async (id: string) => {
    const { error } = await supabase.from("portfolio_companies").delete().eq("id", id);
    if (!error) await fetch();
    else throw error;
  };

  // Aggregate metrics
  const totalAUM = companies.reduce((s, c) => s + (c.current_valuation ?? 0), 0);
  const totalRevenue = companies.reduce((s, c) => s + c.revenue_ltm, 0);
  const avgRisk = companies.length ? Math.round(companies.reduce((s, c) => s + c.risk_score, 0) / companies.length) : 0;
  const atRiskCount = companies.filter(c => c.risk_score >= 70).length;
  const avgEbitdaMargin = companies.length ? companies.reduce((s, c) => s + c.ebitda_margin_pct, 0) / companies.length : 0;

  return {
    companies, loading, refresh: fetch,
    addCompany, updateCompany, deleteCompany,
    totalAUM, totalRevenue, avgRisk, atRiskCount, avgEbitdaMargin,
  };
};

import { PortfolioCompany } from "@/hooks/usePortfolioCompanies";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, TrendingUp, DollarSign, Users, Calendar, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  company: PortfolioCompany;
  onClose: () => void;
}

const fmt = (n: number | null) => {
  if (n === null) return "—";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const riskLabel = (score: number) => {
  if (score <= 25) return { text: "Low", className: "bg-[hsl(var(--severity-success))]/10 text-[hsl(var(--severity-success))]" };
  if (score <= 50) return { text: "Moderate", className: "bg-[hsl(var(--severity-info))]/10 text-[hsl(var(--severity-info))]" };
  if (score <= 75) return { text: "Elevated", className: "bg-[hsl(var(--severity-warning))]/10 text-[hsl(var(--severity-warning))]" };
  return { text: "Critical", className: "bg-destructive/10 text-destructive" };
};

const PortfolioCompanyDetail = ({ company, onClose }: Props) => {
  const navigate = useNavigate();
  const risk = riskLabel(company.risk_score);

  const metrics = [
    { label: "Revenue LTM", value: fmt(company.revenue_ltm), icon: DollarSign },
    { label: "EBITDA LTM", value: fmt(company.ebitda_ltm), icon: DollarSign },
    { label: "Revenue Growth", value: `${company.revenue_growth_pct > 0 ? "+" : ""}${company.revenue_growth_pct.toFixed(1)}%`, icon: TrendingUp },
    { label: "EBITDA Margin", value: `${company.ebitda_margin_pct.toFixed(1)}%`, icon: Target },
    { label: "Valuation", value: fmt(company.current_valuation), icon: DollarSign },
    { label: "Headcount", value: company.headcount?.toString() ?? "—", icon: Users },
    { label: "Ownership", value: company.ownership_pct ? `${company.ownership_pct}%` : "—", icon: Target },
    { label: "Cash Runway", value: company.cash_runway_months ? `${company.cash_runway_months} mo` : "—", icon: Calendar },
  ];

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3 flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-lg">{company.name}</CardTitle>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground capitalize">{company.sector}</span>
            {company.fund_name && <span className="text-xs text-muted-foreground">· {company.fund_name}</span>}
            <Badge className={`${risk.className} border-none text-xs`}>{risk.text} Risk ({company.risk_score})</Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metrics.map(m => (
            <div key={m.label} className="rounded-lg bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <m.icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{m.label}</span>
              </div>
              <span className="text-base font-bold">{m.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate("/simulations")} className="text-xs">
            Run Simulation
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/scenarios")} className="text-xs">
            Scenario Analysis
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PortfolioCompanyDetail;

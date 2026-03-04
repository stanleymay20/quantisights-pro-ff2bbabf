import { PortfolioCompany } from "@/hooks/usePortfolioCompanies";

interface Props {
  companies: PortfolioCompany[];
  onSelect: (company: PortfolioCompany) => void;
}

const riskBg = (score: number) => {
  if (score <= 25) return "bg-[hsl(var(--severity-success))]";
  if (score <= 50) return "bg-[hsl(var(--severity-info))]";
  if (score <= 75) return "bg-[hsl(var(--severity-warning))]";
  return "bg-destructive";
};

const PortfolioRiskGrid = ({ companies, onSelect }: Props) => {
  if (companies.length === 0) return null;

  // Sort by risk score descending
  const sorted = [...companies].sort((a, b) => b.risk_score - a.risk_score);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Risk Heatmap</h3>
      <div className="flex flex-wrap gap-2">
        {sorted.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className={`${riskBg(c.risk_score)} rounded-lg px-3 py-2 text-white transition-all hover:scale-105 hover:shadow-lg cursor-pointer min-w-[100px]`}
            style={{ opacity: 0.7 + (c.risk_score / 333) }}
            title={`${c.name}: Risk ${c.risk_score}`}
          >
            <p className="text-xs font-bold truncate">{c.name}</p>
            <p className="text-lg font-black">{c.risk_score}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default PortfolioRiskGrid;

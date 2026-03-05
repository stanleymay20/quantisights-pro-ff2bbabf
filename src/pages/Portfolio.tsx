import { useState } from "react";
import { SidebarMobileToggle } from "@/components/layout/ProtectedShell";
import { useActiveDataContext } from "@/hooks/useActiveDataContext";
import { usePortfolioCompanies, PortfolioCompany } from "@/hooks/usePortfolioCompanies";
import PortfolioKPIBar from "@/components/portfolio/PortfolioKPIBar";
import PortfolioRiskHeatmap from "@/components/portfolio/PortfolioRiskHeatmap";
import PortfolioRiskGrid from "@/components/portfolio/PortfolioRiskGrid";
import PortfolioCompanyDetail from "@/components/portfolio/PortfolioCompanyDetail";
import AddPortfolioCompanyDialog from "@/components/portfolio/AddPortfolioCompanyDialog";
import DatasetRequired from "@/components/layout/DatasetRequired";
import { Briefcase } from "lucide-react";

const Portfolio = () => {
  const { orgId, datasetId } = useActiveDataContext();
  const { companies, loading, totalAUM, totalRevenue, avgRisk, atRiskCount, avgEbitdaMargin, addCompany } = usePortfolioCompanies(orgId, datasetId);
  const [selected, setSelected] = useState<PortfolioCompany | null>(null);

  return (
    <DatasetRequired moduleName="Portfolio">
      <main className="flex-1 flex flex-col overflow-auto">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SidebarMobileToggle />
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Portfolio Overview</h1>
                <p className="text-xs text-muted-foreground">Multi-company risk monitoring & performance tracking</p>
              </div>
            </div>
            {orgId && (
              <AddPortfolioCompanyDialog organizationId={orgId} onAdd={(c) => addCompany({ ...c, dataset_id: datasetId })} />
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <PortfolioKPIBar
                companyCount={companies.length}
                totalAUM={totalAUM}
                totalRevenue={totalRevenue}
                avgRisk={avgRisk}
                atRiskCount={atRiskCount}
                avgEbitdaMargin={avgEbitdaMargin}
              />
              <PortfolioRiskGrid companies={companies} onSelect={setSelected} />
              {selected && (
                <PortfolioCompanyDetail company={selected} onClose={() => setSelected(null)} />
              )}
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Portfolio Companies</h2>
                <PortfolioRiskHeatmap
                  companies={companies}
                  onSelect={setSelected}
                  selectedId={selected?.id}
                />
              </div>
            </>
          )}
        </div>
      </main>
    </DatasetRequired>
  );
};

export default Portfolio;

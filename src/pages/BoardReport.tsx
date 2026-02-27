import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReportHeader from "@/components/board-report/ReportHeader";
import ExecutiveSummary from "@/components/board-report/ExecutiveSummary";
import TrendIntelligence from "@/components/board-report/TrendIntelligence";
import RiskAttribution from "@/components/board-report/RiskAttribution";
import GovernanceActions from "@/components/board-report/GovernanceActions";
import ConflictsSection from "@/components/board-report/ConflictsSection";
import SimulationSection from "@/components/board-report/SimulationSection";

interface ReportData {
  organization_name: string;
  generated_at: string;
  generated_by: string;
  tier: string;
  governance_status: "green" | "amber" | "red";
  governance_headline: string;
  board_summary: string[];
  max_risk_score: number;
  has_escalation: boolean;
  active_conflicts_count: number;
  role_risks: any[];
  convergence: any;
  conflicts: any[];
  simulation: any[];
  eci_trend: any;
  convergence_history: any[];
  governance_actions: any[];
  ai_narrative: any;
}

const BoardReport = () => {
  const { user } = useAuth();
  const { currentOrgId } = useOrganization();
  const navigate = useNavigate();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      if (!currentOrgId) return;
      try {
        const { data, error: fnError } = await supabase.functions.invoke("generate-board-report", {
          body: { organization_id: currentOrgId },
        });
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        setReport(data);
      } catch (err: any) {
        setError(err.message || "Failed to generate report");
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [currentOrgId]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1426] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto" />
          <p className="text-slate-300 text-lg">Compiling Board Governance Report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0B1426] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">{error}</p>
          <Button variant="outline" onClick={() => navigate("/executive")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Executive
          </Button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <>
      {/* Print controls */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-3">
        <Button variant="outline" onClick={() => navigate("/executive")} className="bg-[#0B1426] border-slate-600 text-slate-200">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={handlePrint} className="bg-cyan-600 hover:bg-cyan-700 text-white">
          <Download className="w-4 h-4 mr-2" /> Export PDF
        </Button>
      </div>

      <div className="min-h-screen bg-[#0B1426] text-slate-200 print:bg-white print:text-slate-900">
        {/* Cover */}
        <ReportHeader
          organizationName={report.organization_name}
          generatedAt={report.generated_at}
          generatedBy={report.generated_by}
          tier={report.tier}
        />

        {/* Page 1: Executive Summary */}
        <ExecutiveSummary
          governanceStatus={report.governance_status}
          governanceHeadline={report.governance_headline}
          boardSummary={report.board_summary}
          maxRiskScore={report.max_risk_score}
          hasEscalation={report.has_escalation}
          activeConflictsCount={report.active_conflicts_count}
        />

        {/* Trend Intelligence */}
        <TrendIntelligence
          eciTrend={report.eci_trend}
          convergenceHistory={report.convergence_history}
          roleRisks={report.role_risks}
        />

        {/* Risk Attribution */}
        <RiskAttribution convergence={report.convergence} />

        {/* Governance Action Framework */}
        <GovernanceActions
          governanceActions={report.governance_actions}
          aiNarrative={report.ai_narrative}
          tier={report.tier}
        />

        {/* Active Conflicts */}
        <ConflictsSection conflicts={report.conflicts} />

        {/* Simulation Summary */}
        <SimulationSection simulation={report.simulation} />

        {/* Footer */}
        <div className="px-16 py-10 text-center space-y-3">
          <p className="text-xs text-slate-600 print:text-slate-400">
            Confidential — {report.organization_name} — Generated by Quantivis Executive Intelligence Platform
          </p>
          <p className="text-xs text-slate-700 print:text-slate-500">
            {new Date(report.generated_at).toISOString()}
          </p>
          <div className="max-w-2xl mx-auto pt-4 border-t border-slate-700/30 print:border-slate-300">
            <p className="text-[9px] text-slate-600 print:text-slate-400 leading-relaxed">
              DISCLAIMER: This report is generated for informational and decision-support purposes only. It does not constitute financial, legal, investment, or professional advice. All outputs are probabilistic estimates subject to data quality limitations and model assumptions. Strategic decisions remain solely the responsibility of the organization and its authorized decision-makers. Quantivis Global assumes no liability for business outcomes resulting from the use of this report.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          @page { margin: 0.5in; size: A4; }
        }
      `}</style>
    </>
  );
};

export default BoardReport;

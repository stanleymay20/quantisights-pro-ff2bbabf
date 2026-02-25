import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import quantivisLogo from "@/assets/quantivis-logo.png";

interface RoleRisk {
  role_type: string;
  score: number;
  components: { deviation: number; trend: number; volatility: number; forecast: number };
  escalation_required: boolean;
  escalation_reason?: string;
}

interface Conflict {
  rule_triggered: string;
  severity: string;
  role_1: string;
  role_2: string;
  description: string;
}

interface Convergence {
  score: number;
  dispersion: number;
  conflict_penalty: number;
  volatility_divergence: number;
  alignment_status: string;
}

interface AINarrative {
  governance_risk_statement: string;
  strategic_outlook: string;
  recommended_actions: string[];
  confidence_score: number;
}

interface ReportData {
  organization_name: string;
  generated_at: string;
  generated_by: string;
  tier: string;
  role_risks: RoleRisk[];
  convergence: Convergence | null;
  conflicts: Conflict[];
  simulation: any[];
  ai_narrative: AINarrative | null;
}

const getScoreColor = (score: number) => {
  if (score <= 25) return "#22c55e";
  if (score <= 50) return "#38bdf8";
  if (score <= 75) return "#f59e0b";
  return "#ef4444";
};

const getAlignmentColor = (status: string) => {
  switch (status) {
    case "aligned": return "#22c55e";
    case "tension": return "#f59e0b";
    case "misalignment": return "#f97316";
    case "structural_conflict": return "#ef4444";
    default: return "#94a3b8";
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "critical": return "#ef4444";
    case "high": return "#f97316";
    case "medium": return "#f59e0b";
    default: return "#38bdf8";
  }
};

const BoardReport = () => {
  const { user } = useAuth();
  const { currentOrgId } = useOrganization();
  const navigate = useNavigate();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

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

  const handlePrint = () => {
    window.print();
  };

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

  const maxRisk = report.role_risks.length > 0
    ? Math.max(...report.role_risks.map(r => r.score))
    : 0;

  return (
    <>
      {/* Print controls - hidden in print */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-3">
        <Button variant="outline" onClick={() => navigate("/executive")} className="bg-[#0B1426] border-slate-600 text-slate-200">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={handlePrint} className="bg-cyan-600 hover:bg-cyan-700 text-white">
          <Download className="w-4 h-4 mr-2" /> Export PDF
        </Button>
      </div>

      <div ref={reportRef} className="min-h-screen bg-[#0B1426] text-slate-200 print:bg-white print:text-slate-900">
        {/* Cover Section */}
        <div className="px-16 pt-20 pb-16 border-b border-slate-700/50 print:border-slate-200">
          <div className="flex items-center gap-4 mb-12">
            <img src={quantivisLogo} alt="Quantivis" className="h-10 print:h-8" />
          </div>
          <h1 className="text-5xl font-light tracking-tight mb-4 print:text-4xl">
            Board Governance Report
          </h1>
          <p className="text-2xl text-slate-400 print:text-slate-500 font-light mb-8">
            {report.organization_name}
          </p>
          <div className="flex gap-8 text-sm text-slate-500">
            <span>Generated: {new Date(report.generated_at).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
            <span>By: {report.generated_by}</span>
            <span className="uppercase tracking-wider">{report.tier} Plan</span>
          </div>
        </div>

        {/* Executive Risk Overview */}
        <div className="px-16 py-12 border-b border-slate-700/50 print:border-slate-200">
          <h2 className="text-xs uppercase tracking-[0.2em] text-cyan-400 print:text-cyan-700 mb-8 font-semibold">
            Executive Risk Overview
          </h2>

          {report.role_risks.length === 0 ? (
            <p className="text-slate-400 italic">No role risk indices computed yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              {report.role_risks.map((role) => (
                <div key={role.role_type} className="border border-slate-700/50 print:border-slate-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm uppercase tracking-wider text-slate-400 font-semibold">
                      {role.role_type}
                    </span>
                    {role.escalation_required && (
                      <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 print:bg-red-100 print:text-red-700 font-semibold">
                        ESCALATION
                      </span>
                    )}
                  </div>
                  <div className="text-4xl font-bold mb-3" style={{ color: getScoreColor(role.score) }}>
                    {role.score}
                  </div>
                  <div className="space-y-2 text-xs">
                    {(["deviation", "trend", "volatility", "forecast"] as const).map((comp) => (
                      <div key={comp} className="flex justify-between">
                        <span className="text-slate-500 capitalize">{comp}</span>
                        <span className="text-slate-300 print:text-slate-700 font-mono">{role.components?.[comp] ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Convergence Index */}
        <div className="px-16 py-12 border-b border-slate-700/50 print:border-slate-200">
          <h2 className="text-xs uppercase tracking-[0.2em] text-cyan-400 print:text-cyan-700 mb-8 font-semibold">
            Executive Convergence Index
          </h2>

          {report.convergence ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="border border-slate-700/50 print:border-slate-200 rounded-xl p-6 text-center">
                <div className="text-5xl font-bold mb-2" style={{ color: getAlignmentColor(report.convergence.alignment_status) }}>
                  {report.convergence.score}
                </div>
                <div className="text-sm text-slate-400">ECI Score</div>
              </div>
              <div className="border border-slate-700/50 print:border-slate-200 rounded-xl p-6 text-center">
                <div className="text-2xl font-semibold mb-2 capitalize" style={{ color: getAlignmentColor(report.convergence.alignment_status) }}>
                  {report.convergence.alignment_status.replace("_", " ")}
                </div>
                <div className="text-sm text-slate-400">Alignment Status</div>
              </div>
              <div className="border border-slate-700/50 print:border-slate-200 rounded-xl p-6 text-center">
                <div className="text-2xl font-semibold mb-2 text-slate-200 print:text-slate-800">
                  {report.convergence.dispersion}
                </div>
                <div className="text-sm text-slate-400">Dispersion</div>
              </div>
              <div className="border border-slate-700/50 print:border-slate-200 rounded-xl p-6 text-center">
                <div className="text-2xl font-semibold mb-2 text-slate-200 print:text-slate-800">
                  {report.convergence.conflict_penalty}
                </div>
                <div className="text-sm text-slate-400">Conflict Penalty</div>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 italic">Convergence index not yet computed.</p>
          )}
        </div>

        {/* Active Conflicts */}
        {report.conflicts.length > 0 && (
          <div className="px-16 py-12 border-b border-slate-700/50 print:border-slate-200">
            <h2 className="text-xs uppercase tracking-[0.2em] text-cyan-400 print:text-cyan-700 mb-8 font-semibold">
              Active Governance Conflicts ({report.conflicts.length})
            </h2>
            <div className="space-y-4">
              {report.conflicts.map((conflict, i) => (
                <div key={i} className="border border-slate-700/50 print:border-slate-200 rounded-xl p-5 flex items-start gap-4">
                  <div
                    className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: getSeverityColor(conflict.severity) }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-sm uppercase tracking-wider" style={{ color: getSeverityColor(conflict.severity) }}>
                        {conflict.severity}
                      </span>
                      <span className="text-xs text-slate-500">
                        {conflict.role_1.toUpperCase()} → {conflict.role_2.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 print:text-slate-700">{conflict.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Simulation Summary */}
        {report.simulation.length > 0 && (
          <div className="px-16 py-12 border-b border-slate-700/50 print:border-slate-200">
            <h2 className="text-xs uppercase tracking-[0.2em] text-cyan-400 print:text-cyan-700 mb-8 font-semibold">
              Strategic Simulation Summary
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {report.simulation.slice(0, 5).map((sim: any, i: number) => (
                <div key={i} className="border border-slate-700/50 print:border-slate-200 rounded-xl p-4 text-center">
                  <div className="text-xs text-slate-500 mb-2">Projection {i + 1}</div>
                  <div className="text-lg font-semibold text-slate-200 print:text-slate-800">
                    {Number(sim.simulated_value).toLocaleString()}
                  </div>
                  <div className={`text-sm font-mono ${Number(sim.delta_value) >= 0 ? "text-emerald-400 print:text-emerald-700" : "text-red-400 print:text-red-700"}`}>
                    {Number(sim.delta_value) >= 0 ? "+" : ""}{Number(sim.delta_value).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Narrative (Enterprise) */}
        {report.ai_narrative && (
          <div className="px-16 py-12 border-b border-slate-700/50 print:border-slate-200">
            <h2 className="text-xs uppercase tracking-[0.2em] text-cyan-400 print:text-cyan-700 mb-8 font-semibold">
              AI Governance Assessment
              <span className="ml-3 text-slate-500 normal-case tracking-normal">
                Confidence: {report.ai_narrative.confidence_score}/100
              </span>
            </h2>

            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Risk Statement
                </h3>
                <p className="text-base leading-relaxed text-slate-200 print:text-slate-800">
                  {report.ai_narrative.governance_risk_statement}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Strategic Outlook
                </h3>
                <p className="text-base leading-relaxed text-slate-200 print:text-slate-800">
                  {report.ai_narrative.strategic_outlook}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Recommended Board Actions
                </h3>
                <ol className="space-y-3">
                  {report.ai_narrative.recommended_actions.map((action, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 print:bg-cyan-100 text-cyan-400 print:text-cyan-700 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="text-slate-300 print:text-slate-700 leading-relaxed">{action}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-16 py-10 text-center">
          <p className="text-xs text-slate-600 print:text-slate-400">
            Confidential — {report.organization_name} — Generated by Quantivis Executive Intelligence Platform
          </p>
          <p className="text-xs text-slate-700 print:text-slate-500 mt-1">
            {new Date(report.generated_at).toISOString()}
          </p>
        </div>
      </div>

      {/* Print Styles */}
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

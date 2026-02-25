import { AlertTriangle, Clock, Zap } from "lucide-react";

interface GovernanceAction {
  action: string;
  priority: "immediate" | "medium_term";
  trigger: string;
}

interface AINarrative {
  governance_risk_statement: string;
  strategic_outlook: string;
  recommended_actions: string[];
  immediate_actions?: string[];
  medium_term_actions?: string[];
  governance_risk_if_ignored?: string;
  confidence_score: number;
}

interface GovernanceActionsProps {
  governanceActions: GovernanceAction[];
  aiNarrative: AINarrative | null;
  tier: string;
}

const GovernanceActions = ({ governanceActions, aiNarrative, tier }: GovernanceActionsProps) => {
  const immediateActions = governanceActions.filter((a) => a.priority === "immediate");
  const mediumTermActions = governanceActions.filter((a) => a.priority === "medium_term");

  return (
    <div className="px-16 py-12 border-b border-slate-700/50 print:border-slate-200 print:break-before-page">
      <h2 className="text-xs uppercase tracking-[0.2em] text-cyan-400 print:text-cyan-700 mb-8 font-semibold">
        Governance Action Framework
      </h2>

      {governanceActions.length === 0 && !aiNarrative ? (
        <p className="text-slate-400 italic">No governance interventions required at this time.</p>
      ) : (
        <div className="space-y-8">
          {/* Immediate Actions */}
          {immediateActions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-red-400 print:text-red-700" />
                <h3 className="text-sm font-semibold text-red-400 print:text-red-700 uppercase tracking-wider">
                  Immediate Intervention Required
                </h3>
              </div>
              <div className="space-y-3">
                {immediateActions.map((a, i) => (
                  <div
                    key={i}
                    className="border border-red-500/20 print:border-red-200 bg-red-500/5 print:bg-red-50 rounded-xl p-4"
                  >
                    <p className="text-sm font-medium text-slate-200 print:text-slate-800 mb-1">{a.action}</p>
                    <p className="text-xs text-slate-500">Trigger: {a.trigger}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medium-term Actions */}
          {mediumTermActions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-amber-400 print:text-amber-700" />
                <h3 className="text-sm font-semibold text-amber-400 print:text-amber-700 uppercase tracking-wider">
                  Medium-Term Recommendations
                </h3>
              </div>
              <div className="space-y-3">
                {mediumTermActions.map((a, i) => (
                  <div
                    key={i}
                    className="border border-amber-500/20 print:border-amber-200 bg-amber-500/5 print:bg-amber-50 rounded-xl p-4"
                  >
                    <p className="text-sm font-medium text-slate-200 print:text-slate-800 mb-1">{a.action}</p>
                    <p className="text-xs text-slate-500">Trigger: {a.trigger}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Enhanced Layer (Enterprise) */}
          {aiNarrative && (
            <div className="mt-8 border border-cyan-500/20 print:border-cyan-200 bg-cyan-500/5 print:bg-cyan-50 rounded-2xl p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-semibold text-cyan-400 print:text-cyan-700 uppercase tracking-wider">
                  AI Governance Assessment
                </h3>
                <span className="text-xs text-slate-500">
                  Confidence: {aiNarrative.confidence_score}/100
                </span>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-2">Risk Statement</h4>
                  <p className="text-sm leading-relaxed text-slate-200 print:text-slate-800">
                    {aiNarrative.governance_risk_statement}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-2">Strategic Outlook</h4>
                  <p className="text-sm leading-relaxed text-slate-200 print:text-slate-800">
                    {aiNarrative.strategic_outlook}
                  </p>
                </div>

                {aiNarrative.governance_risk_if_ignored && (
                  <div className="bg-red-500/10 print:bg-red-50 border border-red-500/20 print:border-red-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 print:text-red-700" />
                      <h4 className="text-xs uppercase tracking-wider text-red-400 print:text-red-700 font-semibold">
                        Risk if Ignored
                      </h4>
                    </div>
                    <p className="text-sm text-slate-300 print:text-slate-700">
                      {aiNarrative.governance_risk_if_ignored}
                    </p>
                  </div>
                )}

                {/* AI Recommended Actions */}
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-3">AI Recommended Actions</h4>
                  <ol className="space-y-2">
                    {aiNarrative.recommended_actions.map((action, i) => (
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
        </div>
      )}
    </div>
  );
};

export default GovernanceActions;

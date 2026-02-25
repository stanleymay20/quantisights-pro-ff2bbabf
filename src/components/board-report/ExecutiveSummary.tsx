import { AlertTriangle, Shield, ShieldAlert, ShieldCheck } from "lucide-react";

interface ExecutiveSummaryProps {
  governanceStatus: "green" | "amber" | "red";
  governanceHeadline: string;
  boardSummary: string[];
  maxRiskScore: number;
  hasEscalation: boolean;
  activeConflictsCount: number;
}

const statusConfig = {
  green: {
    label: "ALIGNED",
    bg: "bg-emerald-500/10 print:bg-emerald-50",
    border: "border-emerald-500/30 print:border-emerald-200",
    text: "text-emerald-400 print:text-emerald-700",
    icon: ShieldCheck,
  },
  amber: {
    label: "TENSION DETECTED",
    bg: "bg-amber-500/10 print:bg-amber-50",
    border: "border-amber-500/30 print:border-amber-200",
    text: "text-amber-400 print:text-amber-700",
    icon: Shield,
  },
  red: {
    label: "CRITICAL",
    bg: "bg-red-500/10 print:bg-red-50",
    border: "border-red-500/30 print:border-red-200",
    text: "text-red-400 print:text-red-700",
    icon: ShieldAlert,
  },
};

const ExecutiveSummary = ({
  governanceStatus,
  governanceHeadline,
  boardSummary,
  maxRiskScore,
  hasEscalation,
  activeConflictsCount,
}: ExecutiveSummaryProps) => {
  const cfg = statusConfig[governanceStatus];
  const Icon = cfg.icon;

  return (
    <div className="px-16 py-12 border-b border-slate-700/50 print:border-slate-200 print:break-after-page">
      <h2 className="text-xs uppercase tracking-[0.2em] text-cyan-400 print:text-cyan-700 mb-8 font-semibold">
        Executive Summary
      </h2>

      {/* Governance Posture Banner */}
      <div className={`rounded-2xl ${cfg.bg} ${cfg.border} border p-8 mb-8`}>
        <div className="flex items-center gap-4 mb-4">
          <Icon className={`w-8 h-8 ${cfg.text}`} />
          <span className={`text-sm font-bold uppercase tracking-[0.2em] ${cfg.text}`}>
            {cfg.label}
          </span>
        </div>
        <p className={`text-2xl font-semibold leading-tight ${cfg.text}`}>
          {governanceHeadline}
        </p>
      </div>

      {/* Critical Risk Signal */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="border border-slate-700/50 print:border-slate-200 rounded-xl p-6 text-center">
          <div
            className="text-4xl font-bold mb-2"
            style={{
              color:
                maxRiskScore > 75
                  ? "#ef4444"
                  : maxRiskScore > 50
                  ? "#f59e0b"
                  : maxRiskScore > 25
                  ? "#38bdf8"
                  : "#22c55e",
            }}
          >
            {maxRiskScore}
          </div>
          <div className="text-sm text-slate-400">Peak Risk Score</div>
        </div>
        <div className="border border-slate-700/50 print:border-slate-200 rounded-xl p-6 text-center">
          <div className={`text-4xl font-bold mb-2 ${hasEscalation ? "text-red-400 print:text-red-700" : "text-emerald-400 print:text-emerald-700"}`}>
            {hasEscalation ? "YES" : "NO"}
          </div>
          <div className="text-sm text-slate-400">Escalation Active</div>
        </div>
        <div className="border border-slate-700/50 print:border-slate-200 rounded-xl p-6 text-center">
          <div
            className="text-4xl font-bold mb-2"
            style={{
              color: activeConflictsCount > 2 ? "#ef4444" : activeConflictsCount > 0 ? "#f59e0b" : "#22c55e",
            }}
          >
            {activeConflictsCount}
          </div>
          <div className="text-sm text-slate-400">Active Conflicts</div>
        </div>
      </div>

      {/* Board-Level Summary */}
      <div className="border border-slate-700/50 print:border-slate-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Board-Level Assessment
        </h3>
        <div className="space-y-2">
          {boardSummary.map((line, i) => (
            <p key={i} className="text-base leading-relaxed text-slate-200 print:text-slate-800">
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExecutiveSummary;

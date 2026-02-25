interface Conflict {
  rule_triggered: string;
  severity: string;
  role_1: string;
  role_2: string;
  description: string;
}

interface ConflictsSectionProps {
  conflicts: Conflict[];
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "critical": return "#ef4444";
    case "high": return "#f97316";
    case "medium": return "#f59e0b";
    default: return "#38bdf8";
  }
};

const ConflictsSection = ({ conflicts }: ConflictsSectionProps) => {
  if (conflicts.length === 0) return null;

  return (
    <div className="px-16 py-12 border-b border-slate-700/50 print:border-slate-200">
      <h2 className="text-xs uppercase tracking-[0.2em] text-cyan-400 print:text-cyan-700 mb-8 font-semibold">
        Active Governance Conflicts ({conflicts.length})
      </h2>
      <div className="space-y-4">
        {conflicts.map((conflict, i) => (
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
  );
};

export default ConflictsSection;

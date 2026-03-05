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
    bg: "bg-success/10 print:bg-success/5",
    border: "border-success/30 print:border-success/20",
    text: "text-success print:text-success",
    icon: ShieldCheck,
  },
  amber: {
    label: "TENSION DETECTED",
    bg: "bg-warning/10 print:bg-warning/5",
    border: "border-warning/30 print:border-warning/20",
    text: "text-warning print:text-warning",
    icon: Shield,
  },
  red: {
    label: "CRITICAL",
    bg: "bg-destructive/10 print:bg-destructive/5",
    border: "border-destructive/30 print:border-destructive/20",
    text: "text-destructive print:text-destructive",
    icon: ShieldAlert,
  },
};

/** Data-driven risk score color using semantic tokens */
function getRiskScoreColor(score: number): string {
  if (score > 75) return "text-destructive";
  if (score > 50) return "text-warning";
  if (score > 25) return "text-primary";
  return "text-success";
}

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
    <div className="px-16 py-12 border-b border-border/50 print:border-border print:break-after-page">
      <h2 className="text-xs uppercase tracking-[0.2em] text-primary mb-8 font-semibold">
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
        <div className="border border-border/50 print:border-border rounded-xl p-6 text-center">
          <div className={`text-4xl font-bold mb-2 ${getRiskScoreColor(maxRiskScore)}`}>
            {maxRiskScore}
          </div>
          <div className="text-sm text-muted-foreground">Peak Risk Score</div>
        </div>
        <div className="border border-border/50 print:border-border rounded-xl p-6 text-center">
          <div className={`text-4xl font-bold mb-2 ${hasEscalation ? "text-destructive" : "text-success"}`}>
            {hasEscalation ? "YES" : "NO"}
          </div>
          <div className="text-sm text-muted-foreground">Escalation Active</div>
        </div>
        <div className="border border-border/50 print:border-border rounded-xl p-6 text-center">
          <div className={`text-4xl font-bold mb-2 ${activeConflictsCount > 2 ? "text-destructive" : activeConflictsCount > 0 ? "text-warning" : "text-success"}`}>
            {activeConflictsCount}
          </div>
          <div className="text-sm text-muted-foreground">Active Conflicts</div>
        </div>
      </div>

      {/* Board-Level Summary */}
      <div className="border border-border/50 print:border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Board-Level Assessment
        </h3>
        <div className="space-y-2">
          {boardSummary.map((line, i) => (
            <p key={i} className="text-base leading-relaxed text-foreground/90 print:text-foreground">
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExecutiveSummary;

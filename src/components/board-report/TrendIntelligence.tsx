import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ConvergencePoint {
  score: number;
  created_at: string;
}

interface RoleRisk {
  role_type: string;
  score: number;
  components: { deviation: number; trend: number; volatility: number; forecast: number };
  last_updated: string;
  escalation_required: boolean;
}

interface EciTrend {
  direction: "up" | "down" | "stable";
  percentChange: number;
  dataPoints: number;
}

interface TrendIntelligenceProps {
  eciTrend: EciTrend | null;
  convergenceHistory: ConvergencePoint[];
  roleRisks: RoleRisk[];
}

const getScoreColor = (score: number) => {
  if (score <= 25) return "#22c55e";
  if (score <= 50) return "#38bdf8";
  if (score <= 75) return "#f59e0b";
  return "#ef4444";
};

const TrendIntelligence = ({ eciTrend, convergenceHistory, roleRisks }: TrendIntelligenceProps) => {
  const TrendIcon = eciTrend?.direction === "up" ? TrendingUp : eciTrend?.direction === "down" ? TrendingDown : Minus;
  const trendColor = eciTrend?.direction === "down" ? "#22c55e" : eciTrend?.direction === "up" ? "#ef4444" : "#94a3b8";

  // Simple sparkline as a bar chart
  const maxScore = convergenceHistory.length > 0 ? Math.max(...convergenceHistory.map((p) => p.score), 100) : 100;

  return (
    <div className="px-16 py-12 border-b border-slate-700/50 print:border-slate-200">
      <h2 className="text-xs uppercase tracking-[0.2em] text-cyan-400 print:text-cyan-700 mb-8 font-semibold">
        Trend Intelligence — 30 Day Window
      </h2>

      {/* ECI Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="border border-slate-700/50 print:border-slate-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            ECI Movement
          </h3>
          {eciTrend ? (
            <div className="flex items-center gap-6">
              <TrendIcon className="w-12 h-12" style={{ color: trendColor }} />
              <div>
                <div className="text-3xl font-bold" style={{ color: trendColor }}>
                  {eciTrend.percentChange > 0 ? "+" : ""}
                  {eciTrend.percentChange}%
                </div>
                <div className="text-sm text-slate-400">
                  {eciTrend.direction === "up"
                    ? "Risk increasing"
                    : eciTrend.direction === "down"
                    ? "Risk decreasing"
                    : "Stable"}{" "}
                  · {eciTrend.dataPoints} data points
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 italic">Insufficient historical trend data</p>
          )}
        </div>

        {/* Sparkline */}
        <div className="border border-slate-700/50 print:border-slate-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            ECI History
          </h3>
          {convergenceHistory.length >= 2 ? (
            <div className="flex items-end gap-1 h-16">
              {convergenceHistory.map((p, i) => {
                const height = Math.max((p.score / maxScore) * 100, 5);
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t"
                    style={{
                      height: `${height}%`,
                      backgroundColor: getScoreColor(p.score),
                      opacity: 0.5 + (i / convergenceHistory.length) * 0.5,
                    }}
                    title={`${p.score} — ${new Date(p.created_at).toLocaleDateString()}`}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-slate-500 italic">Insufficient historical trend data</p>
          )}
        </div>
      </div>

      {/* Role Risk Movement */}
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Role Risk Movement
      </h3>
      {roleRisks.length === 0 ? (
        <p className="text-slate-400 italic">No role risk indices computed yet.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {roleRisks.map((role) => (
            <div
              key={role.role_type}
              className="border border-slate-700/50 print:border-slate-200 rounded-xl p-5"
            >
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-2 font-semibold">
                {role.role_type}
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold" style={{ color: getScoreColor(role.score) }}>
                  {role.score}
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-700/50 print:bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${role.score}%`,
                    backgroundColor: getScoreColor(role.score),
                  }}
                />
              </div>
              {role.escalation_required && (
                <span className="mt-2 inline-block text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 print:bg-red-100 print:text-red-700 font-semibold">
                  ESCALATION
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrendIntelligence;

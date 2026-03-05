import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Brain, TrendingUp, TrendingDown, Target, ArrowRight, AlertTriangle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface CalibrationProgressProps {
  organizationId: string;
}

interface CalibrationData {
  overallScore: number | null;
  biasDirection: string | null;
  modelVersion: number | null;
  totalDecisions: number;
  mae: number | null;
  improvementPp: number | null;
}

const CalibrationProgress = ({ organizationId }: CalibrationProgressProps) => {
  const [data, setData] = useState<CalibrationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;
    const fetch = async () => {
      setLoading(true);
      const { data: models } = await supabase
        .from("calibration_models")
        .select("overall_calibration_score, overall_bias_direction, model_version, total_decisions_analyzed, mean_absolute_error")
        .eq("organization_id", organizationId)
        .order("computed_at", { ascending: false })
        .limit(2);

      if (!models || models.length === 0) {
        setData(null);
        setLoading(false);
        return;
      }

      const current = models[0];
      const previous = models.length > 1 ? models[1] : null;
      const improvement = previous?.mean_absolute_error != null && current.mean_absolute_error != null
        ? previous.mean_absolute_error - current.mean_absolute_error
        : null;

      setData({
        overallScore: current.overall_calibration_score,
        biasDirection: current.overall_bias_direction,
        modelVersion: current.model_version,
        totalDecisions: current.total_decisions_analyzed ?? 0,
        mae: current.mean_absolute_error,
        improvementPp: improvement,
      });
      setLoading(false);
    };
    fetch();
  }, [organizationId]);

  if (loading || !data) return null;

  const scoreColor = data.overallScore != null
    ? data.overallScore >= 80 ? "text-success" : data.overallScore >= 60 ? "text-primary" : "text-warning"
    : "text-muted-foreground";

  const biasIcon = data.biasDirection === "overconfident"
    ? TrendingUp
    : data.biasDirection === "underconfident"
    ? TrendingDown
    : ShieldCheck;

  const biasLabel = data.biasDirection === "overconfident"
    ? "Your team tends to overestimate"
    : data.biasDirection === "underconfident"
    ? "Your team tends to underestimate"
    : "Well calibrated";

  const biasColor = data.biasDirection === "overconfident"
    ? "text-warning"
    : data.biasDirection === "underconfident"
    ? "text-primary"
    : "text-success";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-card p-5 rounded-xl"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Decision Intelligence
          </h3>
        </div>
        <Link
          to="/calibration"
          className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
        >
          Full Assessment <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Calibration Score */}
        <div className="text-center">
          <p className={`text-2xl font-bold ${scoreColor}`}>
            {data.overallScore != null ? `${data.overallScore}%` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Calibration Score</p>
        </div>

        {/* Bias Direction */}
        <div className="text-center">
          <div className={`flex items-center justify-center gap-1.5 ${biasColor}`}>
            {(() => { const Icon = biasIcon; return <Icon className="w-4 h-4" />; })()}
            <span className="text-sm font-semibold capitalize">{data.biasDirection || "—"}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{biasLabel}</p>
        </div>

        {/* Improvement */}
        <div className="text-center">
          {data.improvementPp != null ? (
            <>
              <p className={`text-2xl font-bold ${data.improvementPp > 0 ? "text-success" : data.improvementPp < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {data.improvementPp > 0 ? "+" : ""}{data.improvementPp.toFixed(1)}pp
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {data.improvementPp > 0 ? "Accuracy improved" : data.improvementPp < 0 ? "Accuracy declined" : "No change"}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-muted-foreground">—</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Needs more data</p>
            </>
          )}
        </div>
      </div>

      {/* Learning status */}
      <div className="mt-4 pt-3 border-t border-border/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-[11px] text-muted-foreground">
            {data.totalDecisions} decisions analyzed · Model v{data.modelVersion || 1}
          </span>
        </div>
        {data.totalDecisions < 12 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-warning shrink-0" />
            <span className="text-[11px] text-warning font-medium">
              {12 - data.totalDecisions} more to strengthen model
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default CalibrationProgress;

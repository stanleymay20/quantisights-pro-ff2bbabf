import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import OutputClassificationBadge from "@/components/dashboard/OutputClassificationBadge";
import {
  Activity, AlertTriangle, TrendingUp, TrendingDown, Minus, Zap,
  Search, ChevronRight,
} from "lucide-react";
import type { DiagnosticResult } from "@/pages/Diagnostics";

const SEVERITY_CONFIG = {
  critical: { bg: "bg-destructive/10", border: "border-destructive/30", text: "text-destructive", icon: AlertTriangle, label: "Critical" },
  warning: { bg: "bg-warning/10", border: "border-warning/30", text: "text-warning", icon: AlertTriangle, label: "Warning" },
  info: { bg: "bg-primary/10", border: "border-primary/30", text: "text-primary", icon: Activity, label: "Healthy" },
};

const TREND_ICONS = {
  improving: { icon: TrendingUp, color: "text-success" },
  declining: { icon: TrendingDown, color: "text-destructive" },
  stable: { icon: Minus, color: "text-muted-foreground" },
  volatile: { icon: Zap, color: "text-warning" },
};

interface DiagnosticCardProps {
  diagnostic: DiagnosticResult;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

const DiagnosticCard = ({ diagnostic: d, index, isExpanded, onToggle }: DiagnosticCardProps) => {
  const config = SEVERITY_CONFIG[d.severity];
  const trend = TREND_ICONS[d.trend_direction];
  const TrendIcon = trend.icon;
  const SevIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        className={`border ${config.border} cursor-pointer transition-all hover:shadow-lg`}
        onClick={onToggle}
      >
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
                <SevIcon className={`w-5 h-5 ${config.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h3 className="font-semibold text-base capitalize">{d.metric_type}</h3>
                  <Badge className={`${config.bg} ${config.text} border-none text-xs`}>
                    {config.label}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <TrendIcon className={`w-4 h-4 ${trend.color}`} />
                    <span className={`text-xs font-medium ${trend.color}`}>
                      {d.change_pct > 0 ? "+" : ""}{d.change_pct}%
                    </span>
                  </div>
                </div>
                <p className="text-sm text-foreground/80">{d.diagnosis}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <ConfidenceBadge
                confidence={{
                  raw_confidence: d.raw_confidence,
                  capped_confidence: d.capped_confidence,
                  confidence_cap_reason: d.confidence_cap_reason,
                  sample_size: d.sample_size,
                  data_sufficiency: d.data_sufficiency,
                  variance_score: d.variance_score,
                }}
              />
              <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            </div>
          </div>

          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="mt-6 pt-6 border-t border-border space-y-5"
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Search className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold">Root Cause Analysis</h4>
                  <OutputClassificationBadge classification="AI_RECOMMENDATION" compact />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{d.root_cause}</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Causal Factors</h4>
                <div className="flex flex-wrap gap-2">
                  {d.causal_factors.map((f, j) => (
                    <Badge key={j} variant="outline" className="text-xs">{f}</Badge>
                  ))}
                </div>
              </div>

              {d.recommendation && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    Recommended Action
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{d.recommendation}</p>
                </div>
              )}

              <div>
                <h4 className="text-xs text-muted-foreground mb-1">Diagnosis Confidence</h4>
                <div className="flex items-center gap-3">
                  <Progress value={d.confidence} className="flex-1 h-2" />
                  <span className="text-sm font-mono font-bold">{d.confidence}%</span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground/60">
                  <span>Sample: {d.sample_size} pts</span>
                  <span>Sufficiency: {d.data_sufficiency}</span>
                  <span>Cap: {d.confidence_cap_reason}</span>
                  {d.adaptive_calibration_applied && (
                    <span>Calibration: v{d.calibration_model_version} ({d.calibration_correction_applied_pp! > 0 ? "+" : ""}{d.calibration_correction_applied_pp}pp)</span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default DiagnosticCard;

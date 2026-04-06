import { Info, Shield } from "lucide-react";
import { useState, forwardRef } from "react";

interface IntelligenceDisclaimerProps {
  variant?: "banner" | "inline" | "footer";
  context?: "advisory" | "simulation" | "report" | "executive" | "general";
  /** When true, the banner cannot be dismissed (use on strategic surfaces for legal protection) */
  persistent?: boolean;
}

const CONTEXT_TEXT: Record<string, string> = {
  advisory:
    "Recommendations are probabilistic decision-support signals, not financial advice. All strategic decisions remain solely with authorized decision-makers within your organization.",
  simulation:
    "Simulation outputs are based on historical data patterns and statistical modeling. Actual outcomes may differ materially. Results do not constitute forecasts or guarantees.",
  report:
    "This report is generated for informational and decision-support purposes only. It does not constitute financial, legal, or professional advice. Independent verification is recommended.",
  executive:
    "Intelligence signals are derived from your operational data using probabilistic models. Confidence scores reflect data quality limitations. Executive judgment remains authoritative.",
  general:
    "Quantivis is a decision-support platform. All outputs are probabilistic estimates subject to data quality and model limitations. They do not constitute financial or professional advice.",
};

/** Strategic surfaces where the disclaimer must not be dismissible */
const PERSISTENT_CONTEXTS = new Set(["advisory", "simulation", "report", "executive"]);

const IntelligenceDisclaimer = ({ variant = "banner", context = "general", persistent }: IntelligenceDisclaimerProps) => {
  const [dismissed, setDismissed] = useState(false);

  // Determine if dismissal is allowed: explicit prop takes priority, otherwise infer from context
  const isDismissible = persistent === undefined
    ? !PERSISTENT_CONTEXTS.has(context)
    : !persistent;

  if (dismissed && isDismissible && variant === "banner") return null;

  const text = CONTEXT_TEXT[context] || CONTEXT_TEXT.general;

  if (variant === "footer") {
    return (
      <div className="mt-6 pt-4 border-t border-border/30">
        <p className="text-[10px] text-muted-foreground/60 flex items-start gap-1.5 leading-relaxed">
          <Shield className="w-3 h-3 mt-0.5 shrink-0" />
          {text}
        </p>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border/30 text-xs text-muted-foreground leading-relaxed">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
        <p>{text}</p>
      </div>
    );
  }

  // Banner variant
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30 border-b border-border/20 text-xs text-muted-foreground">
      <Shield className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />
      <p className="flex-1 leading-relaxed">{text}</p>
      {isDismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="text-[10px] font-medium text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0"
        >
          Dismiss
        </button>
      )}
    </div>
  );
};

export default IntelligenceDisclaimer;

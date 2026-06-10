import { FlaskConical, Upload, ArrowRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const DISMISS_KEY = "quantivis_demo_banner_dismissed";

/**
 * DemoBanner — full-width, impossible-to-miss sandbox warning.
 * Per audit edit #3: removes ambiguity about whether decisions are real or demo data.
 * Uses warning palette + sticky width so first-time users always understand context.
 */
const DemoBanner = () => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "true");

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, overflow: "hidden" }}
          transition={{ duration: 0.25 }}
          role="status"
          aria-live="polite"
          className="w-full border-y-2 border-warning/40 bg-warning/[0.08]"
        >
          <div className="w-full px-4 sm:px-6 md:px-8 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-warning/15 flex items-center justify-center shrink-0">
                <FlaskConical className="w-4 h-4 text-warning" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-warning text-warning-foreground">
                    Sandbox Mode
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    These are sample decisions.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Connect your data to generate real recommendations. Demo: Acme Corp · B2B SaaS · €4.2M ARR.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                onClick={() => navigate("/data-upload")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Upload className="w-3 h-3" />
                Connect your data
                <ArrowRight className="w-3 h-3" />
              </button>
              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Dismiss sandbox banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DemoBanner;

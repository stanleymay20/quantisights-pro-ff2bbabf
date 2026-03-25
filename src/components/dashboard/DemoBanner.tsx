import { FlaskConical, Upload, ArrowRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const DISMISS_KEY = "quantivis_demo_banner_dismissed";

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
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0, overflow: "hidden" }}
          transition={{ duration: 0.25 }}
          className="mx-3 sm:mx-4 md:mx-8 mt-3 sm:mt-4 md:mt-6 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FlaskConical className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Demo Environment</p>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
                  Sandbox
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                Acme Corp · B2B SaaS · €4.2M ARR · Declining conversion scenario · 15 months of data
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate("/data-upload")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Upload className="w-3 h-3" />
              <span className="hidden sm:inline">Use Your Data</span>
              <span className="sm:hidden">Upload</span>
              <ArrowRight className="w-3 h-3" />
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Dismiss demo banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DemoBanner;

import { FlaskConical, Upload, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const DemoBanner = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-3 sm:mx-4 md:mx-8 mt-3 sm:mt-4 md:mt-6 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FlaskConical className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Demo Workspace</p>
          <p className="text-[11px] text-muted-foreground truncate">
            15 months of B2B SaaS data · Fully simulated intelligence environment
          </p>
        </div>
      </div>
      <button
        onClick={() => navigate("/data-upload")}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Upload className="w-3 h-3" />
        <span className="hidden sm:inline">Use Your Own Data</span>
        <span className="sm:hidden">Upload</span>
        <ArrowRight className="w-3 h-3" />
      </button>
    </motion.div>
  );
};

export default DemoBanner;

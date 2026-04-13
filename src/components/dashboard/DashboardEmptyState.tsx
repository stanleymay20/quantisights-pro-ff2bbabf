import { useNavigate } from "react-router-dom";
import { Zap, Upload, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export const DashboardEmptyState = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-lg mx-auto mt-16 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <Zap className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Get started</h1>
      <p className="text-muted-foreground text-sm mb-8 max-w-sm mx-auto">
        Upload your data or try a demo to start making better decisions.
      </p>
      <div className="space-y-3 text-left">
        <div
          className="flex items-center gap-4 p-4 rounded-xl border border-primary/30 bg-primary/[0.04] hover:bg-primary/[0.06] cursor-pointer transition-all"
          onClick={() => navigate("/demo")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && navigate("/demo")}
          aria-label="Try with sample data"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Try with sample data</p>
            <p className="text-xs text-muted-foreground">See the full experience instantly</p>
          </div>
          <ArrowRight className="w-4 h-4 text-primary shrink-0" />
        </div>
        <div
          className="flex items-center gap-4 p-4 rounded-xl border border-border/30 bg-card/40 hover:bg-card/60 cursor-pointer transition-all"
          onClick={() => navigate("/data-upload")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && navigate("/data-upload")}
          aria-label="Upload your data"
        >
          <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
            <Upload className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Upload your data</p>
            <p className="text-xs text-muted-foreground">Any CSV — financial, operational, or custom</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>
      </div>
    </motion.div>
  );
};

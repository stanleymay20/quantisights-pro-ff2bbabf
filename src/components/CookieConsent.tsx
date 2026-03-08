import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Cookie, X, Shield } from "lucide-react";
import { Link } from "react-router-dom";

const CONSENT_KEY = "quantivis_cookie_consent";

type ConsentChoice = "accepted" | "essential_only";

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleChoice = (choice: ConsentChoice) => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, timestamp: new Date().toISOString() }));
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6"
        >
          <div className="max-w-3xl mx-auto bg-card border border-border/60 rounded-2xl shadow-2xl backdrop-blur-xl p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Cookie className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground mb-1">Cookie Preferences</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We use <strong>essential cookies</strong> for authentication and security. 
                  Optional <strong>preference cookies</strong> remember your settings (theme, sidebar state). 
                  We never use advertising or tracking cookies.{" "}
                  <Link to="/cookies" className="text-primary hover:underline">Learn more</Link>
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button size="sm" onClick={() => handleChoice("accepted")} className="text-xs">
                    Accept All
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleChoice("essential_only")} className="text-xs">
                    Essential Only
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-2 flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5" />
                  No third-party tracking · GDPR & CCPA compliant
                </p>
              </div>
              <button
                onClick={() => handleChoice("essential_only")}
                className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieConsent;

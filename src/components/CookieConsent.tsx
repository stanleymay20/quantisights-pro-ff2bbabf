import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Cookie, X, Shield } from "lucide-react";
import { Link } from "react-router-dom";

const CONSENT_KEY = "quantivis_cookie_consent";

type ConsentChoice = "accepted" | "essential_only";

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language?.startsWith("de");

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    const isDemo = sessionStorage.getItem("quantivis_demo_mode") === "true";
    if (isDemo && !stored) {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: "accepted", timestamp: new Date().toISOString() }));
      return;
    }
    if (!stored) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleChoice = (choice: ConsentChoice) => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, timestamp: new Date().toISOString() }));
    setExiting(true);
    setTimeout(() => setVisible(false), 300);
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[100] p-2 sm:p-4 md:p-6 pb-[env(safe-area-inset-bottom,8px)] transition-all duration-300 ease-out ${
        exiting ? "translate-y-full opacity-0" : "translate-y-0 opacity-100 animate-[slide-up_0.4s_ease-out]"
      }`}
      style={{ "--slide-up-from": "100px" } as React.CSSProperties}
    >
      <div className="max-w-3xl mx-auto bg-card border border-border/60 rounded-2xl shadow-2xl backdrop-blur-xl p-3 sm:p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Cookie className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground mb-1">
              {isGerman ? "Cookie-Einstellungen" : "Cookie Preferences"}
            </h3>
            <p
              className="text-xs text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: isGerman
                  ? `Wir verwenden <strong>notwendige Cookies</strong> für Authentifizierung und Sicherheit. Optionale <strong>Präferenz-Cookies</strong> speichern Ihre Einstellungen. Wir verwenden keine Werbe- oder Tracking-Cookies. <a href="/cookies" class="text-primary hover:underline">Mehr erfahren</a>`
                  : `We use <strong>essential cookies</strong> for authentication and security. Optional <strong>preference cookies</strong> remember your settings (theme, sidebar state). We never use advertising or tracking cookies. <a href="/cookies" class="text-primary hover:underline">Learn more</a>`,
              }}
            />
            <div className="flex flex-wrap gap-2 mt-4">
              <Button size="sm" onClick={() => handleChoice("accepted")} className="text-xs">
                {isGerman ? "Alle akzeptieren" : "Accept All"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleChoice("essential_only")} className="text-xs">
                {isGerman ? "Nur notwendige" : "Essential Only"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/50 mt-2 flex items-center gap-1">
              <Shield className="w-2.5 h-2.5" />
              {isGerman
                ? "Kein Tracking durch Dritte · DSGVO-konform"
                : "No third-party tracking · GDPR & CCPA compliant"}
            </p>
          </div>
          <button
            onClick={() => handleChoice("essential_only")}
            className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
            aria-label={isGerman ? "Schließen" : "Dismiss"}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;

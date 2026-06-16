import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/quantivis-logo.png";

const safeNext = (value: string | null) => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/onboarding";
  return value;
};

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState("Finalizing your secure sign-in…");
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const finalize = async () => {
      const next = safeNext(searchParams.get("next"));
      // Give Supabase a moment to process the OAuth tokens from the URL hash
      await new Promise(r => setTimeout(r, 800));
      if (cancelled) return;
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        navigate(next, { replace: true });
        return;
      }
      setError(true);
      setMessage("We could not confirm your session. Redirecting to sign in…");
      setTimeout(() => !cancelled && navigate("/login", { replace: true }), 2000);
    };
    finalize();
    return () => { cancelled = true; };
  }, [navigate, searchParams]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background gap-6 px-4">
      {/* Quantivis logo */}
      <img src={logo} alt="Quantivis" className="h-10 w-auto" />

      {/* Spinner */}
      {!error && (
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      )}

      {/* Status message */}
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">
          {error ? "Taking you back to sign in…" : "Setting up your secure session"}
        </p>
      </div>

      {/* Tagline */}
      <p className="text-xs text-muted-foreground/50 absolute bottom-6">
        Quantivis — Decision Intelligence OS
      </p>
    </div>
  );
};

export default AuthCallback;

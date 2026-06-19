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
    let settled = false;

    const next = safeNext(searchParams.get("next"));

    const finish = (ok: boolean) => {
      if (settled || cancelled) return;
      settled = true;
      if (ok) {
        navigate(next, { replace: true });
      } else {
        setError(true);
        setMessage("We could not confirm your session. Redirecting to sign in…");
        setTimeout(() => !cancelled && navigate("/login", { replace: true }), 1500);
      }
    };

    // Listen for the session being set (PKCE auto-exchange via detectSessionInUrl)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        subscription.unsubscribe();
        finish(true);
      }
    });

    const finalize = async () => {
      try {
        // Explicit fallback: if a code is present and auto-exchange didn't fire, force it.
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const errParam = url.searchParams.get("error_description") || url.searchParams.get("error");

        if (errParam) {
          console.error("[AuthCallback] OAuth provider error:", errParam);
          finish(false);
          return;
        }

        if (code) {
          // Some flows / re-renders need an explicit exchange.
          const { data, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (!exchangeErr && data.session) {
            subscription.unsubscribe();
            finish(true);
            return;
          }
          if (exchangeErr) {
            console.warn("[AuthCallback] exchangeCodeForSession:", exchangeErr.message);
          }
        }

        // Hash-based (implicit) flow or already-set session.
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          subscription.unsubscribe();
          finish(true);
          return;
        }

        // Last-resort timeout: give Supabase up to 4s, then bail.
        setTimeout(async () => {
          if (settled || cancelled) return;
          const { data: late } = await supabase.auth.getSession();
          subscription.unsubscribe();
          finish(Boolean(late.session));
        }, 4000);
      } catch (e) {
        console.error("[AuthCallback] finalize failed:", e);
        subscription.unsubscribe();
        finish(false);
      }
    };

    finalize();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate, searchParams]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background gap-6 px-4">
      <img src={logo} alt="Quantivis" className="h-10 w-auto" />
      {!error && (
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      )}
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">
          {error ? "Taking you back to sign in…" : "Setting up your secure session"}
        </p>
      </div>
      <p className="text-xs text-muted-foreground/50 absolute bottom-6">
        Quantivis — Decision Intelligence OS
      </p>
    </div>
  );
};

export default AuthCallback;

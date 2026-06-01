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

  useEffect(() => {
    let cancelled = false;
    const finalize = async () => {
      const next = safeNext(searchParams.get("next"));
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        navigate(next, { replace: true });
        return;
      }
      setMessage("We could not confirm your session. Please sign in again.");
      setTimeout(() => !cancelled && navigate('/login', { replace: true }), 1800);
    };
    finalize();
    return () => { cancelled = true; };
  }, [navigate, searchParams]);

  return <div className="min-h-dvh flex items-center justify-center"><div><img src={logo} alt="Quantivis" /><p>{message}</p></div></div>;
};

export default AuthCallback;

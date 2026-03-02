import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Loader2, AlertCircle } from "lucide-react";

const Demo = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Creating your demo environment…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const initDemo = async () => {
      try {
        // Sign out any existing session
        await supabase.auth.signOut();

        setStatus("Provisioning Acme Corp demo account…");

        const { data, error: fnErr } = await supabase.functions.invoke("create-demo-session");

        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);

        if (cancelled) return;

        setStatus("Seeding 15 months of intelligence data…");

        // Set the session from the returned tokens
        const { error: sessErr } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (sessErr) throw sessErr;

        if (cancelled) return;

        setStatus("Launching dashboard…");
        await new Promise(r => setTimeout(r, 800));

        navigate("/dashboard", { replace: true });
      } catch (err: any) {
        if (!cancelled) {
          console.error("Demo init error:", err);
          setError(err.message || "Failed to create demo session");
        }
      }
    };

    initDemo();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Brain className="w-8 h-8 text-primary" />
        </div>

        {error ? (
          <>
            <div className="flex items-center justify-center gap-2 text-destructive mb-3">
              <AlertCircle className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Demo Error</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:brightness-110 transition-all"
            >
              Try Again
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Setting Up Your Demo</h2>
            <p className="text-sm text-muted-foreground">{status}</p>
            <div className="mt-6 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Acme Corp</span> — a B2B SaaS company with $850K+ revenue, 420 customers, and 15 months of operational data.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Demo;

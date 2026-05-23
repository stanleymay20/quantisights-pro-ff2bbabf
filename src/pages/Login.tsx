import { useState, forwardRef } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useAuthThrottle } from "@/hooks/useAuthThrottle";
import { useAuthEvents } from "@/hooks/useAuthEvents";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import MFAChallenge from "@/components/auth/MFAChallenge";
import logo from "@/assets/quantivis-logo.png";
import { Shield, AlertTriangle, Loader2 } from "lucide-react";

const Login = forwardRef<HTMLDivElement>((_, ref) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showMFA, setShowMFA] = useState(false);
  const [ssoRedirect, setSsoRedirect] = useState<string | null>(null);
  const [ssoChecking, setSsoChecking] = useState(false);
  const [ssoEnforced, setSsoEnforced] = useState(false);
  const { user, signIn } = useAuth();
  const { logAuthEvent } = useAuthEvents();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/dashboard";
  const redirectTo = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/dashboard";
  const { toast } = useToast();
  const throttle = useAuthThrottle(5, 60_000);

  // Redirect already-authenticated users to dashboard
  if (user) return <Navigate to={redirectTo} replace />;

  // Check SSO for email domain
  const checkSSODomain = async (emailValue: string) => {
    if (!emailValue.includes("@")) {
      setSsoRedirect(null);
      setSsoEnforced(false);
      return;
    }
    setSsoChecking(true);
    try {
      const { data } = await supabase.rpc("resolve_sso_for_email", { _email: emailValue });
      if (data && Array.isArray(data) && data.length > 0) {
        const ssoConfig = data[0];
        setSsoRedirect(ssoConfig.idp_sso_url);
        setSsoEnforced(ssoConfig.enforce_sso);
      } else {
        setSsoRedirect(null);
        setSsoEnforced(false);
      }
    } catch (e: unknown) {
      // SSO lookup failure is non-blocking — fall back to password login
      console.error("[Login] SSO lookup failed:", e instanceof Error ? e.message : e);
      setSsoRedirect(null);
      setSsoEnforced(false);
    } finally {
      setSsoChecking(false);
    }
  };

  const handleSSOLogin = () => {
    if (ssoRedirect) {
      window.location.href = ssoRedirect;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ssoEnforced) {
      toast({ title: "SSO Required", description: "Your organization requires SSO login. Use the SSO button below.", variant: "destructive" });
      return;
    }
    const { allowed, waitSeconds } = throttle.check();
    if (!allowed) {
      toast({ title: "Too many attempts", description: `Please wait ${waitSeconds}s before trying again.`, variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await signIn(email, password);

      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const verifiedFactors = factorsData?.totp?.filter((f) => f.status === "verified") || [];

      if (verifiedFactors.length > 0) {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.currentLevel !== aal?.nextLevel) {
          setShowMFA(true);
          setIsLoading(false);
          return;
        }
      }

      // Check for login anomalies (fire-and-forget)
      supabase.functions.invoke("login-anomaly-detect", {
        body: {
          ip_address: null, // Server-side detection
          user_agent: navigator.userAgent,
        },
      }).then(({ data }) => {
        if (data?.is_anomalous) {
          toast({
            title: "Security Notice",
            description: data.message + ". If this wasn't you, change your password immediately.",
            variant: "destructive",
            duration: 10000,
          });
        }
      }).catch((err) => {
        console.warn("[login] Anomaly detection call failed:", err);
      }); // Non-blocking

      logAuthEvent({ eventType: "login", metadata: { method: "password" } });
      navigate(redirectTo);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logAuthEvent({ eventType: "failed_login", metadata: { email, reason: msg } });
      toast({ title: "Login failed", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMFAVerified = () => {
    navigate(redirectTo);
  };

  return (
    <div ref={ref} className="min-h-dvh flex items-center justify-center bg-background px-4 safe-area-bottom safe-area-top">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
      </div>
      <div className="glass-card p-8 w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <Link to="/"><img src={logo} alt="Quantivis Global" className="h-10" /></Link>
        </div>

        {showMFA ? (
          <MFAChallenge onVerified={handleMFAVerified} />
        ) : (
          <>
            <h1 className="text-2xl font-bold font-display text-center mb-2">Welcome Back</h1>
            <p className="text-muted-foreground text-center mb-8 text-sm">Sign in to your account</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    checkSSODomain(e.target.value);
                  }}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  placeholder="you@company.com"
                />
              </div>

              {ssoChecking && (
                <p className="text-xs text-muted-foreground">Checking organization sign-in options…</p>
              )}

              {/* SSO Detection Banner */}
              {ssoRedirect && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Shield className="w-4 h-4" />
                    SSO detected for your domain
                  </div>
                  {ssoEnforced && (
                    <p className="text-xs text-muted-foreground">
                      Your organization requires SSO login. Password authentication is disabled.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleSSOLogin}
                    disabled={ssoChecking}
                    className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    {ssoChecking ? "Checking…" : "Sign in with SSO"}
                  </button>
                </div>
              )}

              {!ssoEnforced && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required={!ssoRedirect}
                      className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading || ssoChecking}
                    className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </button>
                </>
              )}
            </form>

            {/* Divider */}
            {!ssoEnforced && (
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground">or continue with</span></div>
              </div>
            )}

            {/* Google Sign In */}
            {!ssoEnforced && (
              <button
                type="button"
                disabled={googleLoading || isLoading}
                onClick={async () => {
                  setGoogleLoading(true);
                  try {
                    const result = await lovable.auth.signInWithOAuth("google", {
                      redirect_uri: window.location.origin,
                    });
                    if (result.error) {
                      toast({ title: "Google sign-in failed", description: result.error instanceof Error ? result.error.message : String(result.error), variant: "destructive" });
                    }
                    if (result.redirected) return;
                    // Session set — navigate
                    logAuthEvent({ eventType: "login", metadata: { method: "google" } });
                    navigate(redirectTo);
                  } catch (err: unknown) {
                    toast({ title: "Google sign-in failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
                  } finally {
                    setGoogleLoading(false);
                  }
                }}
                className="w-full py-3 rounded-lg bg-secondary border border-border text-foreground font-medium text-sm hover:bg-accent transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                )}
                Continue with Google
              </button>
            )}

            <div className="text-center mt-6 space-y-2">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/register" className="text-primary hover:underline">Sign up</Link>
              </p>
              <p className="text-xs text-muted-foreground">
                <Link to="/forgot-password" className="text-primary/70 hover:text-primary hover:underline transition-colors">
                  Forgot your password?
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

Login.displayName = "Login";

export default Login;

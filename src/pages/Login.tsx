import { useState, forwardRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useAuthThrottle } from "@/hooks/useAuthThrottle";
import { useAuthEvents } from "@/hooks/useAuthEvents";
import { supabase } from "@/integrations/supabase/client";
import MFAChallenge from "@/components/auth/MFAChallenge";
import logo from "@/assets/quantivis-logo.png";
import { Shield, AlertTriangle } from "lucide-react";

const Login = forwardRef<HTMLDivElement>((_, ref) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showMFA, setShowMFA] = useState(false);
  const [ssoRedirect, setSsoRedirect] = useState<string | null>(null);
  const [ssoChecking, setSsoChecking] = useState(false);
  const [ssoEnforced, setSsoEnforced] = useState(false);
  const { signIn } = useAuth();
  const { logAuthEvent } = useAuthEvents();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/dashboard";
  const redirectTo = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/dashboard";
  const { toast } = useToast();
  const throttle = useAuthThrottle(5, 60_000);

  // Check SSO for email domain
  const checkSSODomain = async (emailValue: string) => {
    if (!emailValue.includes("@")) {
      setSsoRedirect(null);
      setSsoEnforced(false);
      return;
    }
    setSsoChecking(true);
    try {
      const { data } = await supabase.rpc("resolve_sso_for_email" as any, { _email: emailValue });
      if (data && Array.isArray(data) && data.length > 0) {
        const ssoConfig = data[0];
        setSsoRedirect(ssoConfig.idp_sso_url);
        setSsoEnforced(ssoConfig.enforce_sso);
      } else {
        setSsoRedirect(null);
        setSsoEnforced(false);
      }
    } catch {
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
      }).catch(() => {}); // Non-blocking

      logAuthEvent({ eventType: "login", metadata: { method: "password" } });
      navigate(redirectTo);
    } catch (err: any) {
      logAuthEvent({ eventType: "failed_login", metadata: { email, reason: err.message } });
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMFAVerified = () => {
    navigate(redirectTo);
  };

  return (
    <div ref={ref} className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-background px-4 safe-area-bottom safe-area-top">
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
                    className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    Sign in with SSO
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
                    disabled={isLoading}
                    className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </button>
                </>
              )}
            </form>

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

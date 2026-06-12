import { useState, useMemo, forwardRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useAuthThrottle } from "@/hooks/useAuthThrottle";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Loader2 } from "lucide-react";
import logo from "@/assets/quantivis-logo.png";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /\d/.test(p) },
  { label: "Special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const Register = forwardRef<HTMLDivElement>((_, ref) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const planParam = new URLSearchParams(location.search).get("plan");
  const PLAN_LABELS: Record<string, string> = { starter: "Starter — €99/mo", growth: "Growth — €499/mo" };
  const { toast } = useToast();
  const throttle = useAuthThrottle(3, 120_000);

  const passedRules = useMemo(() => PASSWORD_RULES.map(r => r.test(password)), [password]);
  const allPassed = passedRules.every(Boolean);
  const strength = passedRules.filter(Boolean).length;
  const strengthLabel = strength <= 1 ? "Weak" : strength <= 3 ? "Fair" : strength <= 4 ? "Good" : "Strong";
  const strengthColor = strength <= 1 ? "bg-destructive" : strength <= 3 ? "bg-warning" : strength <= 4 ? "bg-primary" : "bg-success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allPassed) {
      toast({ title: "Password too weak", description: "Please meet all password requirements", variant: "destructive" });
      return;
    }
    const { allowed, waitSeconds } = throttle.check();
    if (!allowed) {
      toast({ title: "Too many attempts", description: `Please wait ${waitSeconds}s before trying again.`, variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await signUp(email, password, fullName);
      toast({ title: "Verification email sent", description: "Confirm your email to continue setting up your Quantivis workspace." });
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({
        title: "Registration failed",
        description: message.includes("weak")
          ? "This password appears in a known weak-password database. Please choose a more unique password."
          : message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    const finishPath = "/onboarding";
    let completed = false;
    const timeoutRef: { current?: ReturnType<typeof setTimeout> } = {};
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && !completed) {
        completed = true;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        subscription.unsubscribe();
        navigate(finishPath, { replace: true });
      }
    });

    const finishIfSessionExists = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session && !completed) {
        completed = true;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        subscription.unsubscribe();
        navigate(finishPath, { replace: true });
        return true;
      }
      return Boolean(data.session);
    };

    timeoutRef.current = setTimeout(() => {
      finishIfSessionExists().then((hasSession) => {
        if (!hasSession && !completed) {
          subscription.unsubscribe();
          setGoogleLoading(false);
          toast({ title: "Google sign-up paused", description: "Complete the Google window, then try again if this page does not move forward.", variant: "destructive" });
        }
      }).catch(() => {
        subscription.unsubscribe();
        setGoogleLoading(false);
      });
    }, 15_000);

    try {
      const { lovable } = await import("@/integrations/lovable");
      const existingSession = await finishIfSessionExists();
      if (existingSession) return;
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (completed) return;
      if (result.error) throw result.error;
      if (!result.redirected && !(await finishIfSessionExists())) {
        navigate(finishPath, { replace: true });
      }
    } catch (err: unknown) {
      if (completed) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      subscription.unsubscribe();
      toast({ title: "Google sign-up failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
      setGoogleLoading(false);
    }
  };

  return (
    <div ref={ref} className="min-h-dvh flex flex-col bg-background safe-area-bottom safe-area-top">
      {/* Top nav bar with back link */}
      <div className="w-full flex items-center justify-between px-6 py-4 border-b border-border/30">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to home
        </Link>
        <Link to="/"><img src={logo} alt="Quantivis Global" className="h-8" /></Link>
        <Link to="/login" className="text-sm text-primary hover:underline">Sign in</Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-1/3 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
      </div>
      <div className="glass-card p-8 w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <Link to="/"><img src={logo} alt="Quantivis Global" className="h-10" /></Link>
        </div>
        <h1 className="text-2xl font-bold font-display text-center mb-2">Create Account</h1>
        <p className="text-muted-foreground text-center mb-6 text-sm">Start your free trial</p>
        {planParam && PLAN_LABELS[planParam] && (
          <div className="mb-6 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20 text-center">
            <p className="text-xs text-muted-foreground">You're signing up for</p>
            <p className="text-sm font-semibold text-primary">{PLAN_LABELS[planParam]}</p>
            <p className="text-xs text-muted-foreground mt-0.5">14-day free trial · No credit card required</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
          <div>
            <label className="block text-sm font-medium mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label htmlFor="register-password" className="block text-sm font-medium mb-1.5">Password</label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              placeholder="Min 12 characters"
            />
            {password.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${strengthColor}`} style={{ width: `${(strength / 5) * 100}%` }} />
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${strength <= 1 ? "text-destructive" : strength <= 3 ? "text-warning" : "text-success"}`}>
                    {strengthLabel}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {PASSWORD_RULES.map((rule, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      {passedRules[i] ? (
                        <Check className="w-3 h-3 text-success" />
                      ) : (
                        <X className="w-3 h-3 text-muted-foreground/50" />
                      )}
                      <span className={`text-[11px] ${passedRules[i] ? "text-success" : "text-muted-foreground/60"}`}>{rule.label}</span>
                    </div>
                  ))}
                </div>
                {allPassed && (
                  <p className="text-[11px] text-muted-foreground">
                    Final password approval happens securely on the server. Avoid reused or common passwords.
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading || !allPassed}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
          >
            {isLoading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground">or continue with</span></div>
        </div>

        {/* Google Sign Up */}
        <button
          type="button"
          disabled={googleLoading || isLoading}
          onClick={handleGoogleSignUp}
          className="w-full py-3 rounded-lg bg-secondary border border-border text-foreground font-medium text-sm hover:bg-accent transition-all disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {googleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          )}
          Continue with Google
        </button>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
      </div>
    </div>
  );
});

Register.displayName = "Register";

export default Register;

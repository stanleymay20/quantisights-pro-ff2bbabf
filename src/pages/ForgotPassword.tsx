import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuthThrottle } from "@/hooks/useAuthThrottle";
import logo from "@/assets/quantivis-logo.png";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast({ title: "Check your email", description: "We sent you a password reset link." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
      </div>
      <div className="glass-card p-8 w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <Link to="/"><img src={logo} alt="Quantivis Global" className="h-10" /></Link>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold font-display">Check Your Email</h1>
            <p className="text-muted-foreground text-sm">
              If an account exists for <span className="text-foreground font-medium">{email}</span>, you'll receive a password reset link shortly.
            </p>
            <Link to="/login" className="inline-block mt-4 text-sm text-primary hover:underline">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold font-display text-center mb-2">Reset Password</h1>
            <p className="text-muted-foreground text-center mb-8 text-sm">
              Enter your email and we'll send you a reset link
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  placeholder="you@company.com"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
              >
                {isLoading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
            <p className="text-center text-sm text-muted-foreground mt-6">
              Remember your password?{" "}
              <Link to="/login" className="text-primary hover:underline">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;

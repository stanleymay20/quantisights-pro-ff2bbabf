import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck } from "lucide-react";

interface MFAChallengeProps {
  onVerified: () => void;
}

const MAX_MFA_ATTEMPTS = 5;

const MFAChallenge = ({ onVerified }: MFAChallengeProps) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const attempts = useRef(0);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    setError("");
    setLoading(true);

    attempts.current += 1;
    if (attempts.current > MAX_MFA_ATTEMPTS) {
      setLocked(true);
      setError("Too many failed attempts. Please sign in again.");
      setLoading(false);
      return;
    }

    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totpFactor = factorsData?.totp?.[0];
      if (!totpFactor) {
        setError("No TOTP factor found.");
        return;
      }

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) throw verifyError;

      onVerified();
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-xl font-bold font-display">Two-Factor Authentication</h2>
        <p className="text-sm text-muted-foreground text-center">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          autoFocus
          className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground text-center text-2xl font-mono tracking-[0.5em] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <button
          type="submit"
          disabled={loading || code.length !== 6 || locked}
          className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
        >
          {locked ? "Locked — sign in again" : loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Verify"}
        </button>
      </form>
    </div>
  );
};

export default MFAChallenge;

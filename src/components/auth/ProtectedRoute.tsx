import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import MFAChallenge from "@/components/auth/MFAChallenge";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [mfaStatus, setMfaStatus] = useState<"loading" | "required" | "passed">("loading");

  useEffect(() => {
    if (!user) {
      setMfaStatus("passed"); // Will redirect via !user check
      return;
    }

    const checkMFA = async () => {
      try {
        const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (error) {
          // Supabase returned an error — fail CLOSED, not open
          console.error("MFA check error:", error);
          setMfaStatus("required");
          return;
        }

        // If user has enrolled MFA factors but hasn't verified this session
        if (data.nextLevel === "aal2" && data.currentLevel !== "aal2") {
          setMfaStatus("required");
        } else {
          setMfaStatus("passed");
        }
      } catch (e: unknown) {
        // MFA assurance check failed — fail CLOSED (deny access) to prevent bypass via network error
        // User can retry by refreshing; this prevents an attacker from triggering failures to skip MFA
        console.error("[ProtectedRoute] MFA assurance check failed:", e instanceof Error ? e.message : e);
        setMfaStatus("required");
      }
    };

    checkMFA();
  }, [user]);

  if (loading || mfaStatus === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (mfaStatus === "required") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="w-full max-w-md p-8">
          <MFAChallenge onVerified={() => setMfaStatus("passed")} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;

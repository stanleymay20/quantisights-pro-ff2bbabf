import { ReactNode } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import ProtectedShell from "@/components/layout/ProtectedShell";

/**
 * Full protected layout: ErrorBoundary + sidebar shell + context bar.
 * Used by most protected routes.
 */
const ProtectedLayout = ({ children }: { children: ReactNode }) => {
  return (
    <ErrorBoundary>
      <ProtectedShell>
        {children}
      </ProtectedShell>
    </ErrorBoundary>
  );
};

/**
 * Minimal protected layout: ErrorBoundary only (no sidebar/context bar).
 * Used by standalone pages like Onboarding and BoardReport.
 */
export const MinimalProtectedLayout = ({ children }: { children: ReactNode }) => {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
};

export default ProtectedLayout;

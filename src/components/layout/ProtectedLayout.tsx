import { ReactNode } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";

/**
 * Minimal layout shell for all protected routes.
 * Provides: per-route ErrorBoundary.
 * 
 * Pages are responsible for their own DashboardSidebar + GlobalContextBar
 * until fully migrated to a unified layout.
 */
const ProtectedLayout = ({ children }: { children: ReactNode }) => {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
};

export default ProtectedLayout;

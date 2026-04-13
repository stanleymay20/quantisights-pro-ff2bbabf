import { ReactNode } from "react";
import DashboardSidebar, { SidebarMobileToggle } from "@/components/dashboard/DashboardSidebar";
import GlobalContextBar from "@/components/layout/GlobalContextBar";

export { SidebarMobileToggle };

/**
 * Unified UI shell for all protected routes that need the sidebar + context bar.
 * Pages render only their content inside this shell.
 */
const ProtectedShell = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex min-h-screen min-h-[100dvh] bg-background">
      {/* Skip to main content — accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-screen min-h-[100dvh] overflow-hidden">
        <GlobalContextBar />
        {children}
      </div>
    </div>
  );
};

export default ProtectedShell;

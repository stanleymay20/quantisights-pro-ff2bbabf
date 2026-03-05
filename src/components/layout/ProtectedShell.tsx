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
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <GlobalContextBar />
        {children}
      </div>
    </div>
  );
};

export default ProtectedShell;

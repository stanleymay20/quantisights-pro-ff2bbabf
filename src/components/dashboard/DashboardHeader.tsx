import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, User, RefreshCw, LogOut, ChevronDown, Settings, CreditCard, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarMobileToggle } from "@/components/layout/ProtectedShell";
import OrgSwitcher from "@/components/dashboard/OrgSwitcher";
import ProjectSwitcher from "@/components/dashboard/ProjectSwitcher";
import { invokeWithRetry } from "@/lib/edge-function-retry";
import { embedInsightsBatch } from "@/lib/decision-lifecycle";
import { useToast } from "@/hooks/use-toast";

interface Insight {
  category?: string;
  message?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface DashboardHeaderProps {
  organizations: { id: string; name: string; role: string }[];
  currentOrg: { id: string; name: string; role: string } | null;
  switchOrganization: (id: string) => void;
  displayName: string;
  email?: string;
  hasData: boolean;
  criticalInsights: Insight[];
  currentOrgId: string | null;
  activeDatasetId: string | null;
  onSignOut: () => void;
}

export const DashboardHeader = ({
  organizations,
  currentOrg,
  switchOrganization,
  displayName,
  email,
  hasData,
  criticalInsights,
  currentOrgId,
  activeDatasetId,
  onSignOut,
}: DashboardHeaderProps) => {
  const [recalculating, setRecalculating] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleRecalculate = useCallback(async () => {
    if (!currentOrgId || !activeDatasetId) {
      toast({ title: "Select a dataset first", variant: "destructive" });
      return;
    }
    setRecalculating(true);
    try {
      await invokeWithRetry("generate-insights", {
        body: { organization_id: currentOrgId, dataset_id: activeDatasetId },
      });
      embedInsightsBatch(currentOrgId);

      try {
        await invokeWithRetry("prescriptive-advisory", {
          body: { organization_id: currentOrgId, dataset_id: activeDatasetId, role_type: "ceo" },
        });
        await invokeWithRetry("auto-create-decisions", {
          body: { organization_id: currentOrgId, dataset_id: activeDatasetId },
        });
      } catch {
        console.warn("[Dashboard] Advisory pipeline step failed");
      }

      toast({ title: "Analysis refreshed" });
      queryClient.invalidateQueries();
    } catch {
      toast({ title: "Refresh failed", variant: "destructive" });
    } finally {
      setRecalculating(false);
    }
  }, [currentOrgId, activeDatasetId, toast, queryClient]);

  return (
    <header className="h-12 border-b border-border/30 flex items-center justify-between px-3 sm:px-6 shrink-0 bg-background/60 backdrop-blur-sm">
      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
        <SidebarMobileToggle />
        <OrgSwitcher organizations={organizations} currentOrg={currentOrg} onSwitch={switchOrganization} />
        <ProjectSwitcher />
      </div>
      <div className="flex items-center gap-1">
        {hasData && (
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all disabled:opacity-50"
            aria-label={recalculating ? "Analyzing data" : "Refresh analysis"}
          >
            <RefreshCw className={`w-3 h-3 ${recalculating ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{recalculating ? "Analyzing…" : "Refresh"}</span>
          </button>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <button className="p-2 rounded-lg hover:bg-secondary/60 transition-colors relative" aria-label="Notifications">
              <Bell className="w-4 h-4 text-muted-foreground" />
              {criticalInsights.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-0">
            <div className="p-3 border-b border-border/30">
              <h4 className="text-sm font-semibold">Notifications</h4>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {criticalInsights.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">No active alerts</p>
              ) : (
                criticalInsights.slice(0, 5).map((insight, i) => (
                  <div key={i} className="px-3 py-2.5 border-b border-border/10 last:border-0 hover:bg-muted/40 transition-colors">
                    <p className="text-xs font-medium truncate">{insight.category || "Alert"}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{insight.message}</p>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 ml-1 pl-2 border-l border-border/30 hover:bg-secondary/40 rounded-lg px-2 py-1 transition-colors" aria-label="User menu">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <Settings className="w-4 h-4 mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/billing")}>
              <CreditCard className="w-4 h-4 mr-2" /> Billing
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/team")}>
              <Users className="w-4 h-4 mr-2" /> Team
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

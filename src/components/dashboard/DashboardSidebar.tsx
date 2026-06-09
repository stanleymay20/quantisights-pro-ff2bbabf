import { createContext, useContext, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquareText,
  ClipboardList,
  BarChart2,
  FileText,
  Plug,
  Shield,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  BookOpen,
  ChevronDown,
  // sub-page icons
  Brain,
  Target,
  PlayCircle,
  Scale,
  Clock,
  ShieldAlert,
  Inbox,
  TrendingUp,
  BarChart3,
  Upload,
  Database,
  BookOpen as CatalogIcon,
  Activity,
  CheckSquare,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { useRoleNav } from "@/hooks/useRoleNav";
import { useIndustryLabels } from "@/hooks/useIndustryLanguage";
import { useIsMobile } from "@/hooks/use-mobile";
import logo from "@/assets/quantivis-logo.png";
import WorkspaceSwitcher from "@/components/dashboard/WorkspaceSwitcher";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

interface NavSection {
  icon: React.ElementType;
  label: string;
  path: string;           // primary route — clicking the label navigates here
  subItems?: NavItem[];   // sub-pages rendered as indented items
  defaultOpen?: boolean;
}

// ─── Navigation — 9 top-level items per IA v1.1 ──────────────────────────────
/**
 * Phase 2 sidebar restructure (IA Redesign v1.1).
 *
 * 9 outcome-oriented top-level items replace the 6 architecture-oriented groups.
 * Sub-pages are indented under their parent — they are NOT separate top-level entries.
 * "New" badges removed from all items — stable features do not signal beta status.
 *
 * Copilot (/copilot) is included as a first-class nav item.
 * It will be promoted to a dedicated page in Phase 4 once intent-routing is validated.
 */
const navSections: NavSection[] = [
  {
    icon: LayoutDashboard,
    label: "Home",
    path: "/dashboard",
  },
  {
    icon: MessageSquareText,
    label: "Copilot",
    path: "/copilot",
  },
  {
    icon: ClipboardList,
    label: "Decisions",
    path: "/decisions",
    subItems: [
      { icon: ClipboardList,  label: "Decision Ledger",  path: "/decisions" },
      { icon: Scale,          label: "Deliberation",     path: "/deliberation" },
      { icon: Users,          label: "AI Boardroom",     path: "/ai-boardroom" },
      { icon: PlayCircle,     label: "Execution",        path: "/execution" },
      { icon: Target,         label: "Outcomes",         path: "/outcomes" },
      { icon: Clock,          label: "History",          path: "/history" },
    ],
  },
  {
    icon: BarChart2,
    label: "Monitor",
    path: "/executive-intelligence",
    subItems: [
      { icon: ShieldAlert,    label: "Executive Intel",  path: "/executive-intelligence" },
      { icon: ShieldAlert,    label: "Interventions",    path: "/interventions" },
      { icon: Inbox,          label: "Intel Inbox",      path: "/intelligence-inbox" },
      { icon: BarChart3,      label: "Decision Accuracy",path: "/decision-accuracy" },
    ],
  },
  {
    icon: FileText,
    label: "Reports",
    path: "/reports",
    subItems: [
      { icon: FileText,       label: "Reports",          path: "/reports" },
      { icon: TrendingUp,     label: "Forecasting",      path: "/forecasting" },
      { icon: Brain,          label: "Simulations",      path: "/simulations" },
      { icon: BarChart3,      label: "Advisory",         path: "/advisory" },
    ],
  },
  {
    icon: Plug,
    label: "Data",
    path: "/data-upload",
    subItems: [
      { icon: Upload,         label: "Upload",           path: "/data-upload" },
      { icon: Plug,           label: "Connectors",       path: "/data-connectors" },
      { icon: Database,       label: "Dataset Explorer", path: "/dataset-explorer" },
      { icon: CatalogIcon,    label: "Data Catalog",     path: "/data-catalog" },
      { icon: Activity,       label: "Pipeline",         path: "/pipeline" },
    ],
  },
  {
    icon: Shield,
    label: "Governance",
    path: "/governance",
    subItems: [
      { icon: Shield,         label: "Command View",     path: "/governance" },
      { icon: CheckSquare,    label: "Compliance",       path: "/compliance" },
      { icon: Scale,          label: "Maturity",         path: "/governance-maturity" },
    ],
  },
  {
    icon: Users,
    label: "Team",
    path: "/team",
  },
  {
    icon: Settings,
    label: "Settings",
    path: "/settings",
    subItems: [
      { icon: Settings,       label: "Settings",         path: "/settings" },
      { icon: CreditCard,     label: "Billing",          path: "/billing" },
      { icon: Activity,       label: "System Health",    path: "/system-health" },
    ],
  },
];

// ─── Context ──────────────────────────────────────────────────────────────────
const SidebarContext = createContext<{ open: boolean; toggle: () => void; collapsed: boolean; toggleCollapsed: () => void }>({
  open: false,
  toggle: () => {},
  collapsed: false,
  toggleCollapsed: () => {},
});
export const useSidebarToggle = () => useContext(SidebarContext);
export const useSidebarCollapsed = () => useContext(SidebarContext).collapsed;

export const SidebarProvider = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar_collapsed") === "true"; } catch { return false; }
  });
  const toggleCollapsed = () => setCollapsed(p => {
    const next = !p;
    try { localStorage.setItem("sidebar_collapsed", String(next)); } catch {}
    return next;
  });
  return (
    <SidebarContext.Provider value={{ open, toggle: () => setOpen(p => !p), collapsed, toggleCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
};

/** Mobile hamburger */
export const SidebarMobileToggle = () => {
  const isMobile = useIsMobile();
  const { toggle } = useSidebarToggle();
  if (!isMobile) return null;
  return (
    <button
      onClick={toggle}
      className="p-2 -ml-2 rounded-lg hover:bg-secondary/60 transition-colors lg:hidden"
      aria-label="Open navigation menu"
    >
      <Menu className="w-5 h-5 text-muted-foreground" />
    </button>
  );
};

// ─── Section block ─────────────────────────────────────────────────────────────
const SectionBlock = ({
  section,
  location,
  onNavClick,
  labelOverride,
}: {
  section: NavSection;
  location: ReturnType<typeof useLocation>;
  onNavClick: () => void;
  labelOverride?: string;
}) => {
  const hasActiveChild =
    location.pathname === section.path ||
    (section.subItems?.some(item => location.pathname === item.path) ?? false);

  const [open, setOpen] = useState(section.defaultOpen || hasActiveChild);

  const isTopActive = location.pathname === section.path && !section.subItems;

  return (
    <div>
      {/* Top-level item */}
      {section.subItems ? (
        // Has sub-items — clicking label toggles collapse, also navigates
        <button
          onClick={() => { setOpen(p => !p); }}
          className={cn(
            "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
            hasActiveChild
              ? "bg-primary/10 text-primary"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <section.icon className={cn("w-4 h-4 shrink-0", hasActiveChild ? "text-primary" : "text-muted-foreground")} />
          <span className="flex-1 text-left">{labelOverride ?? section.label}</span>
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200 text-muted-foreground", open && "rotate-180")} />
        </button>
      ) : (
        // No sub-items — direct link
        <Link
          to={section.path}
          onClick={onNavClick}
          className={cn(
            "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
            isTopActive
              ? "bg-primary/10 text-primary"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <section.icon className={cn("w-4 h-4 shrink-0", isTopActive ? "text-primary" : "text-muted-foreground")} />
          <span className="flex-1">{labelOverride ?? section.label}</span>
          {isTopActive && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
        </Link>
      )}

      {/* Sub-items */}
      {section.subItems && open && (
        <div className="ml-4 pl-3 border-l border-border/40 mt-0.5 space-y-0.5">
          {section.subItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path + item.label}
                to={item.path}
                onClick={onNavClick}
                className={cn(
                  "group flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-accent-foreground")} />
                {item.label}
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Main sidebar ─────────────────────────────────────────────────────────────
const DashboardSidebar = () => {
  const { signOut } = useAuth();
  const { currentOrg } = useOrganization();
  const { orgRole } = usePermissions();
  const allowedPaths = useRoleNav(orgRole as any);
  const lang = useIndustryLabels(currentOrg?.industry);
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { open, toggle, collapsed, toggleCollapsed } = useSidebarToggle();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleNavClick = () => {
    if (isMobile) toggle();
  };

  const sidebarContent = (
    <aside
      aria-label="Main navigation"
      className={`${collapsed ? "w-16" : "w-56"} h-dvh bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 safe-area-left safe-area-top safe-area-bottom transition-all duration-200`}
    >
      {/* Logo */}
      <div className="p-4 pb-3 flex items-center justify-between">
        {!collapsed && (
          <Link to="/" onClick={handleNavClick}>
            <img src={logo} alt="Quantivis" className="h-7 w-auto" />
          </Link>
        )}
        {collapsed && (
          <Link to="/" onClick={handleNavClick} className="mx-auto">
            <img src={logo} alt="Quantivis" className="h-6 w-6 object-contain" />
          </Link>
        )}
        {isMobile ? (
          <button
            onClick={toggle}
            className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5 text-sidebar-foreground" />
          </button>
        ) : (
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors ml-auto"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${collapsed ? "-rotate-90" : "rotate-90"}`} />
          </button>
        )}
      </div>

      {/* Org switcher */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <WorkspaceSwitcher />
        </div>
      )}

      {/* Nav */}
      <nav aria-label="Dashboard navigation" className={`flex-1 ${collapsed ? "px-1" : "px-2"} overflow-y-auto space-y-0.5`}>
        {collapsed ? (
          // Icon-only mode — top-level icons only, no labels, no sub-items
          navSections.filter(s => allowedPaths.has(s.path)).map((section) => {
            const isActive = location.pathname === section.path ||
              (section.subItems?.some(i => location.pathname === i.path) ?? false);
            return (
              <Link
                key={section.path}
                to={section.path}
                onClick={handleNavClick}
                title={section.label}
                className={`flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <section.icon className="w-5 h-5" />
              </Link>
            );
          })
        ) : (
        navSections.filter(s => allowedPaths.has(s.path)).map((section) => {
          // Industry language layer: rename labels based on org industry
          const labelOverrides: Partial<Record<string, string>> = {
            "/decisions":   lang.decisions,
            "/governance":  lang.governance,
          };
          return (
            <SectionBlock
              key={section.label}
              section={section}
              location={location}
              onNavClick={handleNavClick}
              labelOverride={labelOverrides[section.path]}
            />
          );
        })
        )}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border space-y-0.5">
        {orgRole && orgRole !== "owner" && orgRole !== "admin" && (
          <div className="px-2.5 py-1 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 bg-muted/40 px-2 py-0.5 rounded-full capitalize">
              {orgRole}
            </span>
          </div>
        )}
        <Link
          to="/docs"
          onClick={handleNavClick}
          title="Help & Docs"
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors w-full",
            collapsed && "justify-center px-0",
            location.pathname === "/docs"
              ? "bg-primary/10 text-primary"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <BookOpen className="w-[15px] h-[15px] text-muted-foreground" />
          {!collapsed && "Help & Docs"}
        </Link>
        <button
          onClick={handleSignOut}
          title="Sign Out"
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="w-[15px] h-[15px] text-muted-foreground" />
          {!collapsed && "Sign Out"}
        </button>
      </div>
    </aside>
  );

  if (!isMobile) return sidebarContent;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={toggle}
        />
      )}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </div>
    </>
  );
};

export default DashboardSidebar;

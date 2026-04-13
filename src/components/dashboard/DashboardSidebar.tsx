import { createContext, useContext, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Upload, Settings, LogOut,
  Menu, X, BookOpen, Brain, Target,
  ChevronDown, Clock, BarChart3, Plus, Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import logo from "@/assets/quantivis-logo.png";
import WorkspaceSwitcher from "@/components/dashboard/WorkspaceSwitcher";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const navSections: NavSection[] = [
  {
    label: "Workflow",
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: "Review", path: "/dashboard" },
      { icon: Brain, label: "Decide", path: "/decisions" },
      { icon: Target, label: "Track", path: "/outcomes" },
    ],
  },
  {
    label: "More",
    items: [
      { icon: Clock, label: "History", path: "/history" },
      { icon: BarChart3, label: "Analytics", path: "/decision-accuracy" },
      { icon: Upload, label: "Upload Data", path: "/data-upload" },
      { icon: Plus, label: "Log Decision", path: "/decisions" },
    ],
  },
  {
    label: "Governance",
    items: [
      { icon: Shield, label: "Fairness & Drift", path: "/fairness" },
    ],
  },
  {
    label: "Admin",
    items: [
      { icon: Settings, label: "Settings", path: "/settings" },
    ],
  },
];

// Context for mobile sidebar toggle
const SidebarContext = createContext<{ open: boolean; toggle: () => void }>({ open: false, toggle: () => {} });
export const useSidebarToggle = () => useContext(SidebarContext);

export const SidebarProvider = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{ open, toggle: () => setOpen(p => !p) }}>
      {children}
    </SidebarContext.Provider>
  );
};

/** Mobile hamburger button — render in page headers */
export const SidebarMobileToggle = () => {
  const isMobile = useIsMobile();
  const { toggle } = useSidebarToggle();
  if (!isMobile) return null;
  return (
    <button onClick={toggle} className="p-2 -ml-2 rounded-lg hover:bg-secondary/60 transition-colors lg:hidden">
      <Menu className="w-5 h-5 text-muted-foreground" />
    </button>
  );
};

const SectionBlock = ({ section, location, onNavClick }: { section: NavSection; location: ReturnType<typeof useLocation>; onNavClick: () => void }) => {
  const hasActiveChild = section.items.some(item => location.pathname === item.path);
  const [open, setOpen] = useState(section.defaultOpen || hasActiveChild);

  return (
    <div>
      <button
        onClick={() => setOpen(p => !p)}
        className={cn(
          "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-colors",
          hasActiveChild
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
        )}
      >
        <span className="flex-1 text-left">{section.label}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="ml-3 pl-3 border-l border-border/40 mt-0.5 space-y-0.5">
          {section.items.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path + item.label}
                to={item.path}
                onClick={onNavClick}
                className={cn(
                  "group flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className={cn("w-4 h-4 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-accent-foreground")} />
                {item.label}
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

const DashboardSidebar = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { open, toggle } = useSidebarToggle();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleNavClick = () => {
    if (isMobile) toggle();
  };

  const sidebarContent = (
    <aside className="w-56 h-screen h-[100dvh] bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 safe-area-left safe-area-top safe-area-bottom">
      <div className="p-4 pb-3 flex items-center justify-between">
        <Link to="/" onClick={handleNavClick}>
          <img src={logo} alt="Quantivis" className="h-7 w-auto" />
        </Link>
        {isMobile && (
          <button onClick={toggle} className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors">
            <X className="w-5 h-5 text-sidebar-foreground" />
          </button>
        )}
      </div>

      <div className="px-3 pb-2">
        <WorkspaceSwitcher />
      </div>

      {/* 3-step visual */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold">1</span>
          Review
          <span className="text-border mx-1">→</span>
          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold">2</span>
          Decide
          <span className="text-border mx-1">→</span>
          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold">3</span>
          Track
        </div>
      </div>

      <nav className="flex-1 px-2 overflow-y-auto space-y-1">
        {navSections.map((section) => (
          <SectionBlock
            key={section.label}
            section={section}
            location={location}
            onNavClick={handleNavClick}
          />
        ))}
      </nav>

      <div className="p-2 border-t border-sidebar-border space-y-0.5">
        <Link
          to="/docs"
          onClick={handleNavClick}
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors w-full",
            location.pathname === "/docs"
              ? "bg-primary/10 text-primary"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <BookOpen className="w-[15px] h-[15px] text-muted-foreground" />
          Help
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
        >
          <LogOut className="w-[15px] h-[15px] text-muted-foreground" />
          Sign Out
        </button>
      </div>
    </aside>
  );

  if (!isMobile) return sidebarContent;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={toggle} />
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

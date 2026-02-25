import { createContext, useContext, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Upload, FileText, TrendingUp, Settings, CreditCard, LogOut,
  Database, BarChart3, Shuffle, Crown, Users, Building2, Search, Zap, Menu, X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import logo from "@/assets/quantivis-logo.png";

const navSections = [
  {
    label: "Intelligence",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
      { icon: BarChart3, label: "KPI Builder", path: "/kpis" },
      { icon: Search, label: "Diagnostics", path: "/diagnostics" },
      { icon: Zap, label: "Advisory", path: "/advisory" },
    ],
  },
  {
    label: "Strategy",
    items: [
      { icon: Shuffle, label: "Scenarios", path: "/scenarios" },
      { icon: Crown, label: "Executive Command", path: "/executive" },
      { icon: FileText, label: "Reports", path: "/reports" },
    ],
  },
  {
    label: "Data",
    items: [
      { icon: Database, label: "Data Sources", path: "/data-sources" },
      { icon: Upload, label: "Data Upload", path: "/data-upload" },
    ],
  },
  {
    label: "Organization",
    items: [
      { icon: Users, label: "Team", path: "/team" },
      { icon: Building2, label: "Client Portfolio", path: "/clients" },
      { icon: CreditCard, label: "Billing", path: "/billing" },
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
    <aside className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      <div className="p-6 pb-4 flex items-center justify-between">
        <Link to="/" onClick={handleNavClick}>
          <img src={logo} alt="Quantivis Global" className="h-9 w-auto" />
        </Link>
        {isMobile && (
          <button onClick={toggle} className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors">
            <X className="w-5 h-5 text-sidebar-foreground" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="section-label">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    onClick={handleNavClick}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm shadow-primary/5"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <item.icon className={`w-[18px] h-[18px] transition-colors ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"}`} />
                    {item.label}
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary glow-dot" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
        >
          <LogOut className="w-[18px] h-[18px] text-muted-foreground" />
          Sign Out
        </button>
      </div>
    </aside>
  );

  // Desktop: static sidebar
  if (!isMobile) return sidebarContent;

  // Mobile: overlay drawer
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={toggle} />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};

export default DashboardSidebar;

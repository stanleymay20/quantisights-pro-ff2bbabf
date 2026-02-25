import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Upload, FileText, TrendingUp, Settings, CreditCard, LogOut,
  Database, BarChart3, Shuffle, Crown, Users, Building2, Search, Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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

const DashboardSidebar = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <aside className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      <div className="p-6 pb-4">
        <Link to="/">
          <img src={logo} alt="Quantivis Global" className="h-9 w-auto" />
        </Link>
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
};

export default DashboardSidebar;
